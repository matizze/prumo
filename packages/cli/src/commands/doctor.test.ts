import { defineCommand } from 'citty'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DoctorSystem } from '../doctor/checks.ts'
import { runCli } from '../run.ts'
import { captureRuntime, makeProject } from '../test-support.ts'
import { createDoctorCommand, formatFinding, formatSummary, realSystem } from './doctor.ts'

const ROOT = '/proj'

/** O projeto que passa em tudo: Node 24, pnpm 10, pacotes na faixa e o servidor prumo no .mcp.json. */
const GOOD_FILES: Record<string, string> = {
  'package.json': JSON.stringify({
    packageManager: 'pnpm@10.0.0',
    engines: { node: '>=24' },
    dependencies: { '@matizze/prumo-core': 'workspace:*' },
    devDependencies: { '@matizze/prumo-cli': '^0.2.0', '@matizze/prumo-rules': '^0.2.0' },
  }),
  '.nvmrc': '24\n',
  '.mcp.json': JSON.stringify({
    mcpServers: { prumo: { command: 'pnpm', args: ['exec', 'prumo-mcp'] } },
  }),
  'node_modules/@matizze/prumo-core/package.json': '{ "version": "0.1.3" }',
  'node_modules/@matizze/prumo-rules/package.json': '{ "version": "0.2.0" }',
  'node_modules/@matizze/prumo-cli/package.json': '{ "version": "0.2.1" }',
}

interface Scenario {
  /** Mapa de caminho (relativo à raiz) para conteúdo; `null` remove um arquivo do projeto bom. */
  files?: Record<string, string | null>
  node?: string
  pnpm?: string | undefined
  cli?: string
  env?: Record<string, string>
}

function system(scenario: Scenario): DoctorSystem {
  const merged: Record<string, string | null> = { ...GOOD_FILES, ...scenario.files }
  return {
    nodeVersion: scenario.node ?? '24.1.0',
    cliVersion: scenario.cli ?? '0.2.0',
    pnpmVersion: () => ('pnpm' in scenario ? scenario.pnpm : '10.5.0'),
    readText: (file) => merged[path.relative(ROOT, file)] ?? undefined,
    env: (name) => scenario.env?.[name] || undefined,
  }
}

async function doctor(scenario: Scenario = {}, args: string[] = ['--root', ROOT]) {
  const runtime = captureRuntime(ROOT)
  const root = defineCommand({
    meta: { name: 'prumo' },
    subCommands: { doctor: createDoctorCommand(runtime, system(scenario)) },
  })
  const code = await runCli(root, ['doctor', ...args], runtime)
  return { code, stdout: runtime.stdout, stderr: runtime.stderr }
}

/** A linha do relatório que começa com o rótulo (depois do resultado). */
function line(stdout: string, label: string): string {
  const found = stdout.split('\n').find((text) => text.slice(7).startsWith(`${label}:`))
  if (!found) throw new Error(`sem linha '${label}' em:\n${stdout}`)
  return found
}

describe('prumo doctor', () => {
  it('sai com 0 e "tudo certo" quando o ambiente e o projeto estão em ordem', async () => {
    const result = await doctor()

    expect(result.code).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('prumo doctor: tudo certo.')
    expect(result.stdout).not.toMatch(/^(aviso|erro)/m)
    expect(line(result.stdout, 'Node')).toBe(
      'ok     Node: 24.1.0 (mínimo do Prumo: 24; .nvmrc: 24; engines: >=24).',
    )
    expect(line(result.stdout, 'pnpm')).toBe('ok     pnpm: 10.5.0 (packageManager: pnpm@10.0.0).')
    expect(line(result.stdout, '@matizze/prumo-core')).toBe(
      'ok     @matizze/prumo-core: 0.1.3 (esperado: >=0.1.0 <0.2.0).',
    )
    expect(line(result.stdout, '.mcp.json')).toBe('ok     .mcp.json: existe, com o servidor prumo.')
  })

  describe('Node', () => {
    it('erro quando o Node é menor que o mínimo do Prumo', async () => {
      const result = await doctor({ node: '22.11.0' })
      expect(result.code).toBe(1)
      expect(line(result.stdout, 'Node')).toMatch(
        /^erro {3}Node: 22\.11\.0 é antiga: o Prumo exige Node >= 24/,
      )
      expect(result.stdout).toContain('prumo doctor: 1 erro.')
    })

    it('aviso quando o .nvmrc pede outra versão', async () => {
      const result = await doctor({ files: { '.nvmrc': '25\n' }, node: '24.1.0' })
      expect(result.code).toBe(0)
      expect(line(result.stdout, 'Node')).toBe(
        'aviso  Node: 24.1.0: o .nvmrc pede 25: rode nvm use.',
      )
    })

    it('aviso quando o .nvmrc tem minor e patch e o Node está abaixo', async () => {
      const result = await doctor({ files: { '.nvmrc': 'v24.5.0' }, node: '24.1.0' })
      expect(line(result.stdout, 'Node')).toContain('o .nvmrc pede v24.5.0')
    })

    it('aviso quando o .nvmrc não é uma versão (lts/*)', async () => {
      const result = await doctor({ files: { '.nvmrc': 'lts/*' } })
      expect(line(result.stdout, 'Node')).toContain("não entendi o .nvmrc ('lts/*')")
    })

    it('aviso quando o engines do projeto pede mais que o Node tem', async () => {
      const manifest = JSON.stringify({
        ...JSON.parse(GOOD_FILES['package.json']!),
        engines: { node: '>=25' },
      })
      const result = await doctor({ files: { 'package.json': manifest, '.nvmrc': null } })
      expect(line(result.stdout, 'Node')).toBe(
        'aviso  Node: 24.1.0: o engines do package.json pede >=25.',
      )
    })

    it('acha o .nvmrc na pasta de cima (monorepo)', async () => {
      const result = await doctor(
        { files: { '.nvmrc': null, '../.nvmrc': '25' }, node: '24.1.0' },
        ['--root', ROOT],
      )
      expect(line(result.stdout, 'Node')).toContain('o .nvmrc pede 25')
    })
  })

  describe('pnpm', () => {
    it('erro quando o pnpm não existe', async () => {
      const result = await doctor({ pnpm: undefined })
      expect(result.code).toBe(1)
      expect(line(result.stdout, 'pnpm')).toMatch(/^erro {3}pnpm: o pnpm não foi encontrado/)
    })

    it('aviso quando o pnpm é mais antigo ou de outra major que o packageManager', async () => {
      const older = await doctor({ pnpm: '9.15.0' })
      expect(line(older.stdout, 'pnpm')).toContain('9.15.0, mas o packageManager pede pnpm@10.0.0')
      const newer = await doctor({ pnpm: '11.0.0' })
      expect(line(newer.stdout, 'pnpm')).toContain('11.0.0, mas o packageManager pede pnpm@10.0.0')
      expect(older.code).toBe(0)
    })

    it('aceita pnpm da mesma major, mais novo, e o packageManager com hash', async () => {
      const manifest = JSON.stringify({ packageManager: 'pnpm@10.0.0+sha512.abc' })
      const result = await doctor({ files: { 'package.json': manifest } })
      expect(line(result.stdout, 'pnpm')).toMatch(/^ok {5}pnpm: 10\.5\.0/)
    })

    it('aviso quando não há packageManager, ou quando ele não é pnpm', async () => {
      const none = await doctor({ files: { 'package.json': '{}' } })
      expect(line(none.stdout, 'pnpm')).toContain('o package.json não tem packageManager')
      const yarn = await doctor({ files: { 'package.json': '{"packageManager":"yarn@4.0.0"}' } })
      expect(line(yarn.stdout, 'pnpm')).toContain("o packageManager é 'yarn@4.0.0'")
    })

    it('usa o packageManager do package.json da pasta de cima', async () => {
      const result = await doctor({
        files: { 'package.json': '{}', '../package.json': '{"packageManager":"pnpm@10.1.0"}' },
      })
      expect(line(result.stdout, 'pnpm')).toBe('ok     pnpm: 10.5.0 (packageManager: pnpm@10.1.0).')
    })
  })

  describe('pacotes do Prumo', () => {
    it('aviso para atualizar o pacote quando o projeto está atrás da faixa', async () => {
      const result = await doctor({
        files: { 'node_modules/@matizze/prumo-core/package.json': '{ "version": "0.0.9" }' },
      })
      expect(result.code).toBe(0)
      expect(line(result.stdout, '@matizze/prumo-core')).toBe(
        'aviso  @matizze/prumo-core: 0.0.9 está atrás da faixa que esta CLI espera (>=0.1.0 <0.2.0): atualize o pacote.',
      )
    })

    it('aviso para atualizar a CLI quando o pacote está à frente da faixa', async () => {
      const result = await doctor({
        files: { 'node_modules/@matizze/prumo-rules/package.json': '{ "version": "0.3.0" }' },
      })
      expect(line(result.stdout, '@matizze/prumo-rules')).toBe(
        'aviso  @matizze/prumo-rules: 0.3.0 está à frente da faixa que esta CLI espera (>=0.2.0 <0.3.0): atualize a CLI (@matizze/prumo-cli).',
      )
    })

    it('compara o @matizze/prumo-cli do projeto com a versão da CLI que roda', async () => {
      const behind = await doctor({ cli: '0.3.0' })
      expect(line(behind.stdout, '@matizze/prumo-cli')).toContain(
        '0.2.1 está atrás da faixa que esta CLI espera (>=0.3.0 <0.4.0)',
      )
      const ahead = await doctor({ cli: '0.1.0' })
      expect(line(ahead.stdout, '@matizze/prumo-cli')).toContain('à frente da faixa')
      const same = await doctor({ cli: '0.2.0' })
      expect(line(same.stdout, '@matizze/prumo-cli')).toMatch(/^ok/)
    })

    it('erro quando o pacote está no package.json e não está instalado', async () => {
      const result = await doctor({
        files: { 'node_modules/@matizze/prumo-core/package.json': null },
      })
      expect(result.code).toBe(1)
      expect(line(result.stdout, '@matizze/prumo-core')).toBe(
        'erro   @matizze/prumo-core: está no package.json, mas não está instalado: rode "pnpm install".',
      )
    })

    it('confere o @matizze/prumo-mcp contra a faixa dele: a 0.1.x passa, a 0.0.x está atrás e a 0.2.0 à frente', async () => {
      const installed = (version: string) => ({
        'node_modules/@matizze/prumo-mcp/package.json': `{ "version": "${version}" }`,
      })
      for (const version of ['0.1.0', '0.1.3']) {
        const result = await doctor({ files: installed(version) })
        expect(line(result.stdout, '@matizze/prumo-mcp')).toBe(
          `ok     @matizze/prumo-mcp: ${version} (esperado: >=0.1.0 <0.2.0).`,
        )
      }
      const behind = await doctor({ files: installed('0.0.9') })
      expect(behind.code).toBe(0)
      expect(line(behind.stdout, '@matizze/prumo-mcp')).toBe(
        'aviso  @matizze/prumo-mcp: 0.0.9 está atrás da faixa que esta CLI espera (>=0.1.0 <0.2.0): atualize o pacote.',
      )
      const ahead = await doctor({ files: installed('0.2.0') })
      expect(ahead.code).toBe(0)
      expect(line(ahead.stdout, '@matizze/prumo-mcp')).toBe(
        'aviso  @matizze/prumo-mcp: 0.2.0 está à frente da faixa que esta CLI espera (>=0.1.0 <0.2.0): atualize a CLI (@matizze/prumo-cli).',
      )
    })

    it('erro quando o mcp está no package.json e não está instalado', async () => {
      const result = await doctor({
        files: {
          'package.json': JSON.stringify({
            packageManager: 'pnpm@10.0.0',
            devDependencies: { '@matizze/prumo-mcp': '^0.1.0' },
          }),
        },
      })
      expect(line(result.stdout, '@matizze/prumo-mcp')).toBe(
        'erro   @matizze/prumo-mcp: está no package.json, mas não está instalado: rode "pnpm install".',
      )
    })

    it('não lista o pacote que o projeto não usa', async () => {
      const result = await doctor()
      expect(result.stdout).not.toContain('@matizze/prumo-testing')
    })

    it('aviso quando o projeto não tem nenhum pacote do Prumo', async () => {
      const result = await doctor({
        files: {
          'package.json': '{"packageManager":"pnpm@10.0.0"}',
          'node_modules/@matizze/prumo-core/package.json': null,
          'node_modules/@matizze/prumo-rules/package.json': null,
          'node_modules/@matizze/prumo-cli/package.json': null,
        },
      })
      expect(line(result.stdout, 'Pacotes do Prumo')).toBe(
        'aviso  Pacotes do Prumo: nenhum pacote @matizze/prumo-* neste projeto.',
      )
    })

    it('aviso quando a versão instalada não é legível', async () => {
      const result = await doctor({
        files: { 'node_modules/@matizze/prumo-core/package.json': '{ "version": "latest" }' },
      })
      expect(line(result.stdout, '@matizze/prumo-core')).toContain("não entendi a versão 'latest'")
    })
  })

  describe('.mcp.json', () => {
    it('ok no .mcp.json com o servidor prumo, e os outros servidores são livres', async () => {
      const both = await doctor()
      expect(line(both.stdout, '.mcp.json')).toBe('ok     .mcp.json: existe, com o servidor prumo.')

      const withOthers = await doctor({
        files: {
          '.mcp.json':
            '{ "mcpServers": { "prumo": { "command": "pnpm" }, "outro": { "command": "npx" } } }',
        },
      })
      expect(withOthers.code).toBe(0)
      expect(line(withOthers.stdout, '.mcp.json')).toMatch(/^ok {5}\.mcp\.json/)
    })

    it.each([
      ['só com outro servidor', '{ "mcpServers": { "outro": { "command": "npx" } } }'],
      ['sem mcpServers', '{}'],
      ['com mcpServers que não é objeto', '{ "mcpServers": [] }'],
      ['com o servidor prumo sem command', '{ "mcpServers": { "prumo": { "args": [] } } }'],
      ['com o servidor prumo que não é objeto', '{ "mcpServers": { "prumo": "pnpm" } }'],
    ])('aviso, com o trecho a acrescentar, no .mcp.json %s', async (_name, text) => {
      const result = await doctor({ files: { '.mcp.json': text } })
      expect(result.code).toBe(0)
      const found = line(result.stdout, '.mcp.json')
      expect(found).toMatch(/^aviso {2}\.mcp\.json: sem o servidor prumo \(com "command"\)/)
      expect(found).toContain('"command": "pnpm", "args": ["exec", "prumo-mcp"]')
      expect(found).toContain('@matizze/prumo-mcp como devDependency')
    })

    it('aviso quando o .mcp.json não é um JSON de objeto', async () => {
      for (const text of ['{ quebrado', '[]', '"prumo"']) {
        const result = await doctor({ files: { '.mcp.json': text } })
        expect(result.code).toBe(0)
        expect(line(result.stdout, '.mcp.json')).toBe(
          'aviso  .mcp.json: não é um JSON de objeto válido.',
        )
      }
    })

    it('aviso quando falta o .mcp.json', async () => {
      const result = await doctor({ files: { '.mcp.json': null } })
      expect(result.code).toBe(0)
      expect(line(result.stdout, '.mcp.json')).toMatch(/^aviso {2}\.mcp\.json: não existe/)
    })
  })

  describe('.npmrc (GitHub Packages)', () => {
    const NPMRC = [
      '@matizze:registry=https://npm.pkg.github.com',
      '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN:-sem-token}',
      '',
    ].join('\n')

    it('sem .npmrc do GitHub Packages, não há linha', async () => {
      const result = await doctor()
      expect(result.stdout).not.toContain('.npmrc')
      const other = await doctor({ files: { '.npmrc': 'registry=https://registry.npmjs.org\n' } })
      expect(other.stdout).not.toContain('.npmrc')
    })

    it('aviso, sem falhar, quando o escopo ainda aponta para o GitHub Packages', async () => {
      const result = await doctor({ files: { '.npmrc': NPMRC } })
      expect(result.code).toBe(0)
      expect(line(result.stdout, '.npmrc')).toMatch(
        /^aviso {2}\.npmrc: o escopo @matizze aponta para o GitHub Packages .*npm público.*pode sair/,
      )
      expect(result.stdout).toContain('prumo doctor: 1 aviso.')
    })

    it('o aviso é o mesmo com ou sem a variável, e nunca imprime o valor', async () => {
      const secret = 'ghp_segredo_de_teste_123'
      const result = await doctor({ files: { '.npmrc': NPMRC }, env: { NODE_AUTH_TOKEN: secret } })
      expect(line(result.stdout, '.npmrc')).toMatch(/^aviso {2}\.npmrc: /)
      expect(result.stdout).not.toContain(secret)
      expect(result.stderr).not.toContain(secret)
    })
  })

  describe('uso', () => {
    it('sai com 2 quando a pasta não tem package.json', async () => {
      const result = await doctor({ files: { 'package.json': null } })
      expect(result.code).toBe(2)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain("a pasta '/proj' não tem package.json")
    })

    it('sai com 2 para opção desconhecida', async () => {
      const result = await doctor({}, ['--raiz', ROOT])
      expect(result.code).toBe(2)
      expect(result.stderr).toContain("opção desconhecida: '--raiz'")
    })

    it('usa a pasta atual quando não recebe --root e resolve --root relativo a ela', async () => {
      expect((await doctor({}, [])).code).toBe(0)
      expect((await doctor({}, ['--root', '../proj'])).code).toBe(0)
    })

    it('mostra a ajuda em português', async () => {
      const result = await doctor({}, ['--help'])
      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Uso: prumo doctor [--root <pasta>]')
      expect(result.stdout).toContain('Sai com 0 sem erro (avisos não falham)')
    })
  })
})

describe('formatFinding e formatSummary', () => {
  it('alinha o resultado em cinco colunas', () => {
    expect(formatFinding({ status: 'ok', label: 'Node', message: 'bom.' })).toBe(
      'ok     Node: bom.',
    )
    expect(formatFinding({ status: 'warn', label: 'Node', message: 'ruim.' })).toBe(
      'aviso  Node: ruim.',
    )
    expect(formatFinding({ status: 'error', label: 'Node', message: 'pior.' })).toBe(
      'erro   Node: pior.',
    )
  })

  it('conta erros e avisos no singular e no plural', () => {
    const f = (status: 'ok' | 'warn' | 'error') => ({ status, label: 'x', message: '' })
    expect(formatSummary([f('ok')])).toBe('prumo doctor: tudo certo.')
    expect(formatSummary([f('warn')])).toBe('prumo doctor: 1 aviso.')
    expect(formatSummary([f('error'), f('error'), f('warn'), f('warn'), f('ok')])).toBe(
      'prumo doctor: 2 erros e 2 avisos.',
    )
  })
})

describe('sistema de verdade', () => {
  it('lê arquivos do disco e devolve undefined para o que não existe ou não é arquivo', () => {
    const root = makeProject({ 'a.txt': 'oi' })
    const { readText } = realSystem()
    expect(readText(path.join(root, 'a.txt'))).toBe('oi')
    expect(readText(path.join(root, 'nao-existe'))).toBeUndefined()
    expect(readText(root)).toBeUndefined()
  })

  it('traz o Node que está rodando e a versão da CLI', () => {
    const system = realSystem()
    expect(system.nodeVersion).toBe(process.versions.node)
    expect(system.cliVersion).toMatch(/^\d+\.\d+\.\d+/)
  })
})
