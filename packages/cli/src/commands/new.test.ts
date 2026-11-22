import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { listStarterFiles } from '../new/copy.ts'
import {
  makeStarterOrigin,
  makeTarballs,
  STARTER_FILES,
  type Manifest,
} from '../new/test-support.ts'
import { createRoot } from '../root.ts'
import { runCli } from '../run.ts'
import { captureRuntime, makeDir } from '../test-support.ts'

/** Roda `prumo new` numa pasta de trabalho nova, sem instalar (a não ser que os argumentos peçam). */
async function run(args: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
  const cwd = options.cwd ?? makeDir()
  const runtime = captureRuntime(cwd, { env: options.env })
  const code = await runCli(createRoot(runtime), ['new', ...args], runtime)
  return { code, stdout: runtime.stdout, stderr: runtime.stderr, cwd }
}

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')
const json = (root: string, file: string) => JSON.parse(read(root, file)) as Manifest

/** Todos os arquivos de uma pasta, como caminhos relativos com `/`, em ordem. */
function tree(root: string, dir = ''): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((entry) => {
      const relative = dir === '' ? entry.name : `${dir}/${entry.name}`
      return entry.isDirectory() ? tree(root, relative) : [relative]
    })
    .sort()
}

describe('prumo new', () => {
  it('cria o produto a partir do starter: copia, sem o que fica de fora, e troca o nome', async () => {
    const from = makeStarterOrigin()
    const { code, stdout, stderr, cwd } = await run(['meu-produto', '--from', from, '--no-install'])
    const product = path.join(cwd, 'meu-produto')

    expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
    expect(tree(product).filter((file) => !file.startsWith('.git/'))).toEqual([
      '.env.example',
      '.env.local',
      '.gitignore',
      '.mcp.json',
      '.npmrc',
      'AGENTS.md',
      'CLAUDE.md',
      'README.md',
      'index.html',
      'package.json',
      'src/main.tsx',
      'src/pages/blank/index.tsx',
      'tsconfig.node.json',
    ])
    expect(stdout).toContain(`Destino: ${product}`)
    expect(stdout).toContain('Próximos passos:')
    expect(stdout).toContain('cd meu-produto\n  pnpm install\n  pnpm dev')
  })

  it('troca o nome nos quatro lugares: package.json, index.html, AGENTS.md e README.md', async () => {
    const { cwd } = await run(['meu-produto', '--from', makeStarterOrigin(), '--no-install'])
    const product = path.join(cwd, 'meu-produto')

    expect(json(product, 'package.json').name).toBe('meu-produto')
    expect(read(product, 'index.html')).toContain('<title>Meu Produto</title>')
    expect(read(product, 'AGENTS.md')).toContain('# Instruções para agentes: meu-produto')
    expect(read(product, 'AGENTS.md')).toContain('`meu-produto`, produto React da Matizze')
    expect(read(product, 'README.md')).toMatch(/^# Meu Produto$/m)
    // Nenhum arquivo do produto cita o nome do starter
    for (const file of tree(product).filter((name) => !name.startsWith('.git/'))) {
      expect(read(product, file), file).not.toContain('prumo-starter')
    }
  })

  it('troca o workspace:* pela faixa da versão que a origem tem e tira o script do gerador', async () => {
    const { cwd } = await run(['meu-produto', '--from', makeStarterOrigin(), '--no-install'])
    const data = json(path.join(cwd, 'meu-produto'), 'package.json')

    expect(data.dependencies['@matizze/prumo-core']).toBe('^0.1.0')
    expect(data.devDependencies['@matizze/prumo-cli']).toBe('^0.2.0')
    expect(data.devDependencies['@matizze/prumo-rules']).toBe('^0.1.0')
    expect(data.scripts['starter:build']).toBeUndefined()
    expect(data.pnpm).toBeUndefined()
    expect(read(path.join(cwd, 'meu-produto'), 'tsconfig.node.json')).not.toContain('scripts/')
  })

  it('cria o .npmrc com o registry do escopo e sem o token', async () => {
    const token = 'ghp_segredo_de_quem_roda'
    const { cwd } = await run(['meu-produto', '--from', makeStarterOrigin(), '--no-install'], {
      env: { NODE_AUTH_TOKEN: token },
    })
    const npmrc = read(path.join(cwd, 'meu-produto'), '.npmrc')

    expect(npmrc).toContain('@matizze:registry=https://npm.pkg.github.com')
    expect(npmrc).toContain('_authToken=${NODE_AUTH_TOKEN}')
    expect(npmrc).not.toContain(token)
  })

  it('cria o .env.local a partir do .env.example, sem token, e mantém o .mcp.json do starter', async () => {
    const { cwd } = await run(['meu-produto', '--from', makeStarterOrigin(), '--no-install'])
    const product = path.join(cwd, 'meu-produto')

    // O .env.local do starter (de quem rodou o gerador) nunca vai junto: o produto nasce do exemplo
    expect(read(product, '.env.local')).toBe(STARTER_FILES['.env.example'])
    expect(read(product, '.env.local')).not.toContain('segredo')
    expect(read(product, '.mcp.json')).toBe(STARTER_FILES['.mcp.json'])
  })

  it('cria o .mcp.json padrão quando o starter não tem um', async () => {
    const files = { ...STARTER_FILES }
    delete files['.mcp.json']
    const { cwd } = await run(['meu-produto', '--from', makeStarterOrigin(files), '--no-install'])

    expect(json(path.join(cwd, 'meu-produto'), '.mcp.json').mcpServers?.shadcn?.command).toBe('npx')
  })

  it('roda git init no produto, sem fazer commit', async () => {
    const { cwd } = await run(['meu-produto', '--from', makeStarterOrigin(), '--no-install'])
    const product = path.join(cwd, 'meu-produto')

    expect(existsSync(path.join(product, '.git'))).toBe(true)
    const log = spawnSync('git', ['log', '--oneline'], { cwd: product, encoding: 'utf8' })
    expect(log.status).not.toBe(0)
  })

  it('cria dentro de --dir, relativa à pasta atual, e escreve o caminho no passo seguinte', async () => {
    const cwd = makeDir()
    mkdirSync(path.join(cwd, 'produtos'))
    const { code, stdout } = await run(
      ['loja', '--from', makeStarterOrigin(), '--dir', 'produtos', '--no-install'],
      { cwd },
    )

    expect(code).toBe(0)
    expect(existsSync(path.join(cwd, 'produtos/loja/package.json'))).toBe(true)
    expect(stdout).toContain('cd produtos/loja')
  })

  it('aceita uma pasta de destino que existe e está vazia', async () => {
    const cwd = makeDir()
    mkdirSync(path.join(cwd, 'loja'))
    const { code } = await run(['loja', '--from', makeStarterOrigin(), '--no-install'], { cwd })

    expect(code).toBe(0)
    expect(existsSync(path.join(cwd, 'loja/package.json'))).toBe(true)
  })
})

describe('prumo new --packages', () => {
  it('grava os pnpm.overrides com file: dos tarballs, sem .npmrc, e não exige token', async () => {
    const packages = makeTarballs()
    const { code, cwd } = await run([
      'meu-produto',
      '--from',
      makeStarterOrigin(),
      '--packages',
      packages,
      '--no-install',
    ])
    const product = path.join(cwd, 'meu-produto')

    expect(code).toBe(0)
    expect(existsSync(path.join(product, '.npmrc'))).toBe(false)
    expect(json(product, 'package.json').pnpm?.overrides).toEqual({
      '@matizze/prumo-cli': `file:${path.join(packages, 'matizze-prumo-cli-0.2.0.tgz')}`,
      '@matizze/prumo-core': `file:${path.join(packages, 'matizze-prumo-core-0.1.0.tgz')}`,
      '@matizze/prumo-rules': `file:${path.join(packages, 'matizze-prumo-rules-0.1.0.tgz')}`,
    })
    expect(json(product, 'package.json').dependencies['@matizze/prumo-core']).toBe('^0.1.0')
  })
})

describe('prumo new: o que valida antes de escrever (saída 2)', () => {
  const from = () => makeStarterOrigin()

  it.each(['MeuProduto', 'meu_produto', '-x', 'a b'])('recusa o nome %j', async (name) => {
    const { code, stderr, cwd } = await run([name, '--from', from(), '--no-install'])

    expect(code).toBe(2)
    expect(stderr).toContain('kebab-case')
    expect(readdirSync(cwd)).toEqual([])
  })

  it('recusa a pasta de destino que existe e não está vazia, sem mexer nela', async () => {
    const cwd = makeDir()
    mkdirSync(path.join(cwd, 'loja'))
    writeFileSync(path.join(cwd, 'loja/notas.txt'), 'meu trabalho')
    const { code, stderr } = await run(['loja', '--from', from(), '--no-install'], { cwd })

    expect(code).toBe(2)
    expect(stderr).toContain('já existe e não está vazia')
    expect(readdirSync(path.join(cwd, 'loja'))).toEqual(['notas.txt'])
  })

  it('recusa o destino que é um arquivo e o --dir que é um arquivo', async () => {
    const cwd = makeDir()
    writeFileSync(path.join(cwd, 'loja'), '')
    writeFileSync(path.join(cwd, 'pasta'), '')

    const file = await run(['loja', '--from', from(), '--no-install'], { cwd })
    const parent = await run(['x', '--from', from(), '--dir', 'pasta', '--no-install'], { cwd })

    expect([file.code, parent.code]).toEqual([2, 2])
    expect(file.stderr).toContain('não é uma pasta')
    expect(parent.stderr).toContain('não é uma pasta (--dir)')
  })

  it('recusa a origem sem starter e a pasta de --from que não existe', async () => {
    const empty = await run(['loja', '--from', makeDir(), '--no-install'])
    const missing = await run(['loja', '--from', 'nada', '--no-install'])

    expect(empty.code).toBe(2)
    expect(empty.stderr).toContain('falta starter/package.json (--from)')
    expect(missing.code).toBe(2)
    expect(readdirSync(empty.cwd)).toEqual([])
  })

  it('recusa --packages sem tarball de um pacote que o starter usa, sem escrever nada', async () => {
    const packages = makeTarballs({ '@matizze/prumo-core': '0.1.0' })
    const { code, stderr, cwd } = await run([
      'loja',
      '--from',
      from(),
      '--packages',
      packages,
      '--no-install',
    ])

    expect(code).toBe(2)
    expect(stderr).toContain('@matizze/prumo-cli, @matizze/prumo-rules')
    expect(readdirSync(cwd)).toEqual([])
  })

  it('recusa um starter que usa um pacote do workspace que a origem não tem, sem deixar a pasta', async () => {
    const files = {
      ...STARTER_FILES,
      'package.json': JSON.stringify({
        name: 'x',
        dependencies: { '@matizze/outro': 'workspace:*' },
      }),
    }
    const { code, stderr, cwd } = await run([
      'loja',
      '--from',
      makeStarterOrigin(files),
      '--no-install',
    ])

    expect(code).toBe(1)
    expect(stderr).toContain('@matizze/outro')
    expect(readdirSync(cwd)).toEqual([])
  })

  it('recusa instalar do registry sem NODE_AUTH_TOKEN, e diz as três saídas', async () => {
    const { code, stderr, cwd } = await run(['loja', '--from', from()])

    expect(code).toBe(2)
    expect(stderr).toContain('NODE_AUTH_TOKEN')
    expect(stderr).toContain('--packages')
    expect(stderr).toContain('--no-install')
    expect(readdirSync(cwd)).toEqual([])
  })

  it('exige o nome e recusa opção desconhecida', async () => {
    const missing = await run([])
    const unknown = await run(['loja', '--nao-existe'])

    expect(missing.code).toBe(2)
    expect(missing.stderr).toContain('falta o argumento <nome>')
    expect(unknown.code).toBe(2)
    expect(unknown.stderr).toContain("opção desconhecida: '--nao-existe'")
  })
})

describe('prumo new --dry-run', () => {
  it('lista o que seria feito e não escreve nada', async () => {
    const { code, stdout, cwd } = await run([
      'meu-produto',
      '--from',
      makeStarterOrigin(),
      '--dry-run',
      '--no-install',
    ])

    expect(code).toBe(0)
    expect(readdirSync(cwd)).toEqual([])
    expect(stdout).toContain('prumo new: meu-produto (simulação).')
    expect(stdout).toContain('Seriam copiados 6 arquivos de starter/')
    expect(stdout).toContain('Seriam alterados (5):')
    expect(stdout).toContain('Seriam criados (2):\n  .env.local\n  .npmrc')
    expect(stdout).toContain('Simulação (--dry-run): nada foi escrito.')
  })

  it('confere o nome e o destino como na execução de verdade', async () => {
    const cwd = makeDir()
    mkdirSync(path.join(cwd, 'loja'))
    writeFileSync(path.join(cwd, 'loja/notas.txt'), '')

    expect((await run(['Loja', '--from', makeStarterOrigin(), '--dry-run'], { cwd })).code).toBe(2)
    expect((await run(['loja', '--from', makeStarterOrigin(), '--dry-run'], { cwd })).code).toBe(2)
  })
})

describe('prumo new: o clone do repositório', () => {
  it('sem --from, baixa o starter de PRUMO_REPOSITORY e apaga o clone temporário', async () => {
    const origin = makeStarterOrigin()
    const git = (...args: string[]) =>
      spawnSync(
        'git',
        [
          '-c',
          'user.name=t',
          '-c',
          'user.email=t@example.com',
          '-c',
          'commit.gpgsign=false',
          ...args,
        ],
        { cwd: origin, encoding: 'utf8' },
      )
    git('init', '--quiet')
    git('add', '.')
    git('commit', '--quiet', '-m', 'origem')

    const { code, stdout, stderr, cwd } = await run(['meu-produto', '--no-install'], {
      env: { PRUMO_REPOSITORY: `file://${origin}` },
    })
    const product = path.join(cwd, 'meu-produto')

    expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
    expect(json(product, 'package.json').name).toBe('meu-produto')
    // O clone vem do git, e o git não traz o que o .gitignore deixou de fora: o produto sai igual
    expect(existsSync(path.join(product, 'src/main.tsx'))).toBe(true)
    const cloneDir = stdout.match(/Origem: (.*)/)?.[1] ?? ''
    expect(cloneDir).toContain('prumo-new-')
    expect(existsSync(cloneDir)).toBe(false)
  })

  it('diz o que conferir quando o clone falha, e não cria nada', async () => {
    const { code, stderr, cwd } = await run(['meu-produto', '--no-install'], {
      env: { PRUMO_REPOSITORY: `file://${path.join(makeDir(), 'nao-existe')}` },
    })

    expect(code).toBe(1)
    expect(stderr).toContain('não consegui baixar o starter')
    expect(stderr).toContain('Confira as credenciais do git')
    expect(readdirSync(cwd)).toEqual([])
  })
})

describe('prumo new: o pnpm install', () => {
  /** Um `pnpm` de mentira no PATH, que anota onde e com que argumentos rodou e sai com o código dado. */
  function fakePnpm(exitCode: number) {
    const bin = makeDir()
    const log = path.join(bin, 'calls.log')
    const script = path.join(bin, 'pnpm')
    writeFileSync(script, `#!/bin/sh\necho "$PWD :: $@" >> '${log}'\nexit ${exitCode}\n`)
    chmodSync(script, 0o755)
    return { env: { PATH: `${bin}:${process.env.PATH ?? ''}` }, log }
  }

  it('roda pnpm install na pasta do produto e não manda instalar de novo nos passos', async () => {
    const pnpm = fakePnpm(0)
    const { code, stdout, cwd } = await run(
      ['meu-produto', '--from', makeStarterOrigin(), '--packages', makeTarballs()],
      { env: pnpm.env },
    )

    expect(code).toBe(0)
    const product = path.join(cwd, 'meu-produto')
    expect(readFileSync(pnpm.log, 'utf8').trim()).toBe(`${realpathSync(product)} :: install`)
    expect(stdout).toContain('cd meu-produto\n  pnpm dev')
  })

  it('com o token definido, instala do registry', async () => {
    const pnpm = fakePnpm(0)
    const { code } = await run(['meu-produto', '--from', makeStarterOrigin()], {
      env: { ...pnpm.env, NODE_AUTH_TOKEN: 'tok' },
    })

    expect(code).toBe(0)
    expect(readFileSync(pnpm.log, 'utf8')).toContain(':: install')
  })

  it('não instala com --no-install', async () => {
    const pnpm = fakePnpm(0)
    await run(['meu-produto', '--from', makeStarterOrigin(), '--no-install'], { env: pnpm.env })

    expect(existsSync(pnpm.log)).toBe(false)
  })

  it('se o install falha, sai com 1, deixa o produto criado e diz como seguir', async () => {
    const pnpm = fakePnpm(1)
    const { code, stderr, cwd } = await run(
      ['meu-produto', '--from', makeStarterOrigin(), '--packages', makeTarballs()],
      { env: pnpm.env },
    )

    expect(code).toBe(1)
    expect(stderr).toContain('o pnpm install falhou')
    expect(stderr).toContain('rode pnpm install ali')
    expect(existsSync(path.join(cwd, 'meu-produto/package.json'))).toBe(true)
  })
})

describe('prumo new --help', () => {
  it('mostra a sintaxe em português, com --no-install para a opção que já vem ligada', async () => {
    const runtime = captureRuntime(makeDir())
    const code = await runCli(createRoot(runtime), ['new', '--help'], runtime)

    expect(code).toBe(0)
    expect(runtime.stdout).toContain(
      'Uso: prumo new <nome> [--dir <pasta>] [--from <pasta>] [--packages <pasta>] [--no-install] [--dry-run]',
    )
    expect(runtime.stdout).toContain('--no-install')
    expect(runtime.stdout).not.toMatch(/--install\b/)
  })
})

describe('prumo new com o starter de verdade', () => {
  it('copia exatamente o starter do monorepo, sem scripts/, e o AGENTS.md cita o produto', async () => {
    const repo = path.resolve(import.meta.dirname, '../../../..')
    const { code, stderr, cwd } = await run(['meu-produto', '--from', repo, '--no-install'])
    const product = path.join(cwd, 'meu-produto')

    expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
    const copied = tree(product).filter((file) => !file.startsWith('.git/'))
    const expected = [
      ...listStarterFiles(path.join(repo, 'starter')),
      '.env.local',
      '.npmrc',
    ].sort()
    expect(copied).toEqual(expected)
    expect(copied.some((file) => file.startsWith('scripts/'))).toBe(false)
    expect(copied.some((file) => file.includes('node_modules'))).toBe(false)

    const data = json(product, 'package.json')
    expect(data.name).toBe('meu-produto')
    expect(JSON.stringify(data)).not.toContain('workspace:')
    expect(data.scripts['starter:build']).toBeUndefined()
    expect(read(product, 'index.html')).toContain('<title>Meu Produto</title>')
    expect(read(product, 'AGENTS.md')).toContain('# Instruções para agentes: meu-produto')
    expect(read(product, 'AGENTS.md')).toContain('`meu-produto`, produto React da Matizze')
    expect(read(product, 'README.md')).toMatch(/^# Meu Produto$/m)
    expect(read(product, 'tsconfig.node.json')).not.toContain('scripts/')
  })
})
