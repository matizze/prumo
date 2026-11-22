import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { check } from '@matizze/prumo-rules/check'
import { defineCommand } from 'citty'
import { describe, expect, it } from 'vitest'
import { APP_FILES, listFiles } from '../generate/app.ts'
import { PRUMO_VERSIONS } from '../new/versions.ts'
import { createRoot } from '../root.ts'
import { runCli } from '../run.ts'
import { createNewCommand } from './new.ts'
import { captureRuntime, makeDir } from '../test-support.ts'

async function run(args: string[], cwd: string) {
  const runtime = captureRuntime(cwd)
  const code = await runCli(createRoot(runtime), args, runtime)
  return { code, stdout: runtime.stdout, stderr: runtime.stderr }
}

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')
const readJson = (root: string, file: string) => JSON.parse(read(root, file)) as unknown

/** Um tarball de mentira, só com o `package.json`, como o `pnpm pack` deixa (`package/package.json`). */
function fakeTarball(dir: string, name: string, version: string): void {
  const stage = mkdtempSync(path.join(tmpdir(), 'prumo-tar-'))
  try {
    mkdirSync(path.join(stage, 'package'))
    writeFileSync(path.join(stage, 'package/package.json'), JSON.stringify({ name, version }))
    const file = path.join(dir, `${name.replace('@', '').replace('/', '-')}-${version}.tgz`)
    const result = spawnSync('tar', ['-czf', file, '-C', stage, 'package'])
    expect(result.status).toBe(0)
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

function fakePackages(skip: string[] = []): string {
  const dir = makeDir()
  for (const [name, version] of Object.entries(PRUMO_VERSIONS)) {
    if (!skip.includes(name)) fakeTarball(dir, name, version)
  }
  // Um tarball de outro pacote é ignorado
  fakeTarball(dir, 'outro-pacote', '1.0.0')
  return dir
}

describe('prumo new', () => {
  it('cria o app mínimo sem instalar, com a tela inicial do make:page', async () => {
    const cwd = makeDir()
    const result = await run(['new', 'meu-app', '--no-install'], cwd)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    const root = path.join(cwd, 'meu-app')
    expect(listFiles(root).filter((file) => !file.startsWith('.git/'))).toEqual(
      [
        '.gitignore',
        '.mcp.json',
        'AGENTS.md',
        'README.md',
        'eslint.config.js',
        'index.html',
        'package.json',
        'src/App.tsx',
        'src/i18n.ts',
        'src/main.tsx',
        'src/messages/en/home.json',
        'src/messages/en/index.ts',
        'src/messages/pt-BR/home.json',
        'src/messages/pt-BR/index.ts',
        'src/pages/home/index.test.tsx',
        'src/pages/home/index.tsx',
        'src/pages/home/model.ts',
        'src/pages/home/view.tsx',
        'src/providers/app.tsx',
        'src/providers/repository/index.ts',
        'src/queries/index.ts',
        'src/repositories/index.ts',
        'src/repositories/options.ts',
        'src/schemas/index.ts',
        'src/test/render.tsx',
        'src/test/setup.ts',
        'tsconfig.json',
        'vite.config.ts',
      ].sort(),
    )
    expect(result.stdout).toContain(`Destino: ${root}`)
    expect(result.stdout).toContain('Criados (28):')
    expect(result.stdout).toContain('pnpm exec prumo make:domain clientes')
    expect(result.stdout).toContain('  pnpm install\n')
    // O app tem git, sem commit
    expect(existsSync(path.join(root, '.git'))).toBe(true)
  })

  it('troca o nome no package.json, no index.html e no AGENTS.md', async () => {
    const cwd = makeDir()
    await run(['new', 'loja-do-ze', '--no-install'], cwd)
    const root = path.join(cwd, 'loja-do-ze')

    expect(readJson(root, 'package.json')).toMatchObject({ name: 'loja-do-ze', private: true })
    expect(read(root, 'index.html')).toContain('<title>Loja Do Ze</title>')
    expect(read(root, 'AGENTS.md')).toContain('o Loja Do Ze')
    for (const file of listFiles(root).filter((file) => !file.startsWith('.git/'))) {
      expect(read(root, file), file).not.toMatch(/\{\{/)
    }
  })

  it('não grava .npmrc nem fala de token: os pacotes vêm do npm público', async () => {
    const cwd = makeDir()
    await run(['new', 'app-npmrc', '--no-install'], cwd)
    const root = path.join(cwd, 'app-npmrc')

    expect(listFiles(root)).not.toContain('.npmrc')
    for (const file of ['AGENTS.md', 'README.md']) {
      expect(read(root, file), file).not.toMatch(/GitHub Packages|NODE_AUTH_TOKEN|read:packages/)
      expect(read(root, file), file).toContain('npm público')
    }
  })

  it('grava os scripts e as dependências: os pacotes do Prumo por ^versão, sem pacote de interface', async () => {
    const cwd = makeDir()
    await run(['new', 'app-um', '--no-install'], cwd)
    const manifest = readJson(path.join(cwd, 'app-um'), 'package.json') as {
      scripts: Record<string, string>
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
      pnpm?: unknown
    }

    expect(Object.keys(manifest.scripts)).toEqual([
      'dev',
      'build',
      'typecheck',
      'lint',
      'check',
      'test',
      'verify',
    ])
    expect(manifest.scripts.verify).toBe('pnpm typecheck && pnpm lint && pnpm check && pnpm test')
    for (const [name, version] of Object.entries(PRUMO_VERSIONS)) {
      const section = name === '@matizze/prumo-core' ? 'dependencies' : 'devDependencies'
      expect(manifest[section][name], name).toBe(`^${version}`)
    }
    const all = { ...manifest.dependencies, ...manifest.devDependencies }
    expect(Object.keys(all)).toEqual(
      expect.arrayContaining(['react', 'wouter', '@tanstack/react-query', 'zod', 'i18next']),
    )
    // Sem interface: nada de CSS, design system, Storybook nem navegador
    for (const name of Object.keys(all)) {
      expect(name, name).not.toMatch(
        /tailwind|storybook|playwright|radix|base-ui|shadcn|mads|lucide|clsx/,
      )
    }
    expect(manifest.pnpm).toBeUndefined()
    // Ordem estável, para um diff limpo
    expect(Object.keys(manifest.dependencies)).toEqual(Object.keys(manifest.dependencies).sort())
  })

  it('a tela inicial é a do make:page, na rota /, com as mensagens nos dois idiomas', async () => {
    const cwd = makeDir()
    await run(['new', 'app-dois', '--no-install'], cwd)
    const root = path.join(cwd, 'app-dois')

    expect(read(root, 'src/App.tsx')).toBe(`import { Route, Switch } from 'wouter'
import HomePage from '@/pages/home'

export default function App() {
  return (
    <Switch>
      <Route path="/">
        <HomePage />
      </Route>
    </Switch>
  )
}
`)
    expect(read(root, 'src/pages/home/model.ts')).toContain("useTranslations('home')")
    expect(read(root, 'src/pages/home/view.tsx')).toContain('<h1>{m.title}</h1>')
    expect(readJson(root, 'src/messages/pt-BR/home.json')).toEqual({ title: 'Home' })
    expect(readJson(root, 'src/messages/en/home.json')).toEqual({ title: 'Home' })
    for (const language of ['pt-BR', 'en']) {
      const index = read(root, `src/messages/${language}/index.ts`)
      expect(index).toContain("import home from './home.json'")
      expect(index).toContain('home,')
    }
  })

  it('o .mcp.json tem só o servidor prumo, e o AGENTS.md diz as camadas e os comandos', async () => {
    const cwd = makeDir()
    await run(['new', 'app-tres', '--no-install'], cwd)
    const root = path.join(cwd, 'app-tres')

    expect(readJson(root, '.mcp.json')).toEqual({
      mcpServers: { prumo: { command: 'pnpm', args: ['exec', 'prumo-mcp'] } },
    })
    const agents = read(root, 'AGENTS.md')
    for (const text of [
      'pages/<tela>/',
      'make:page',
      'make:domain',
      'make:component',
      'pnpm verify',
    ]) {
      expect(agents).toContain(text)
    }
    expect(agents.split('\n').length).toBeLessThan(70)
  })

  it('o app gerado passa no prumo check', async () => {
    const cwd = makeDir()
    await run(['new', 'app-quatro', '--no-install'], cwd)
    expect(check({ root: path.join(cwd, 'app-quatro') })).toEqual([])
  })

  it('os geradores funcionam no app novo: domínio, tela com domínio e componente', async () => {
    const cwd = makeDir()
    await run(['new', 'app-cinco', '--no-install'], cwd)
    const root = path.join(cwd, 'app-cinco')

    for (const args of [
      ['make:domain', 'clientes'],
      ['make:page', 'clientes', '--domain', 'clientes'],
      ['make:component', 'resumo', '--page', 'home'],
    ]) {
      const result = await run([...args, '--root', root], cwd)
      expect(result.code, `${args.join(' ')}\n${result.stdout}${result.stderr}`).toBe(0)
    }
    const app = read(root, 'src/App.tsx')
    expect(app).toContain('<Route path="/">')
    expect(app).toContain('<Route path="/clientes">')
  })

  it('--dry-run lista o que faria e não escreve nada', async () => {
    const cwd = makeDir()
    const result = await run(['new', 'app-seco', '--dry-run'], cwd)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('prumo new: app-seco (simulação).')
    expect(result.stdout).toContain('Seriam criados (28):')
    expect(result.stdout).toContain('  src/pages/home/view.tsx\n')
    expect(result.stdout).toContain('Depois: git init e pnpm install.')
    expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(readdirSync(cwd)).toEqual([])
  })

  it('--dir escolhe a pasta onde criar, e cria a pasta que falta', async () => {
    const cwd = makeDir()
    const result = await run(['new', 'app-seis', '--dir', 'produtos/novos', '--no-install'], cwd)

    expect(result.code, result.stderr).toBe(0)
    expect(existsSync(path.join(cwd, 'produtos/novos/app-seis/package.json'))).toBe(true)
  })

  it('aceita criar numa pasta vazia que já existe', async () => {
    const cwd = makeDir()
    mkdirSync(path.join(cwd, 'app-vazio'))
    const result = await run(['new', 'app-vazio', '--no-install'], cwd)

    expect(result.code, result.stderr).toBe(0)
    expect(existsSync(path.join(cwd, 'app-vazio/package.json'))).toBe(true)
  })

  it('--packages grava os tarballs em pnpm.overrides, com file:', async () => {
    const cwd = makeDir()
    const packages = fakePackages()
    const result = await run(['new', 'app-sete', '--packages', packages, '--no-install'], cwd)

    expect(result.code, result.stderr).toBe(0)
    const manifest = readJson(path.join(cwd, 'app-sete'), 'package.json') as {
      pnpm: { overrides: Record<string, string> }
    }
    expect(Object.keys(manifest.pnpm.overrides)).toEqual(Object.keys(PRUMO_VERSIONS).sort())
    for (const [name, spec] of Object.entries(manifest.pnpm.overrides)) {
      expect(spec).toMatch(new RegExp(`^file:${packages}/.+\\.tgz$`))
      expect(existsSync(spec.slice('file:'.length)), name).toBe(true)
    }
    expect(result.stdout).toContain(`tarballs de ${packages}`)
  })

  describe('erros de uso (saída 2, sem escrever nada)', () => {
    it.each([
      ['Meu-App', 'kebab-case'],
      ['meu_app', 'kebab-case'],
      ['1app', 'kebab-case'],
      ['a'.repeat(215), 'longo demais'],
    ])('recusa o nome %#', async (name, reason) => {
      const cwd = makeDir()
      const result = await run(['new', name, '--no-install'], cwd)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain(reason)
      expect(readdirSync(cwd)).toEqual([])
    })

    it('recusa uma pasta de destino com conteúdo e não mexe nela', async () => {
      const cwd = makeDir()
      mkdirSync(path.join(cwd, 'app-cheio'))
      writeFileSync(path.join(cwd, 'app-cheio/arquivo.txt'), 'meu')
      const result = await run(['new', 'app-cheio', '--no-install'], cwd)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain('já existe e não está vazia')
      expect(readdirSync(path.join(cwd, 'app-cheio'))).toEqual(['arquivo.txt'])
    })

    it('recusa um destino que é um arquivo e um --dir que é um arquivo', async () => {
      const cwd = makeDir()
      writeFileSync(path.join(cwd, 'app-arquivo'), '')
      const first = await run(['new', 'app-arquivo', '--no-install'], cwd)
      expect(first.code).toBe(2)
      expect(first.stderr).toContain('já existe e não é uma pasta')

      const second = await run(['new', 'app', '--dir', 'app-arquivo', '--no-install'], cwd)
      expect(second.code).toBe(2)
      expect(second.stderr).toContain('não é uma pasta (--dir)')
    })

    it('recusa --packages sem a pasta, sem tarball do Prumo ou sem algum dos pacotes', async () => {
      const cwd = makeDir()
      const missingFolder = await run(
        ['new', 'a1', '--packages', 'nao-existe', '--no-install'],
        cwd,
      )
      expect(missingFolder.code).toBe(2)
      expect(missingFolder.stderr).toContain('não existe (--packages)')

      const empty = await run(['new', 'a2', '--packages', makeDir(), '--no-install'], cwd)
      expect(empty.code).toBe(2)
      expect(empty.stderr).toContain('não tem o tarball de @matizze/prumo-')

      const incomplete = await run(
        ['new', 'a3', '--packages', fakePackages(['@matizze/prumo-testing']), '--no-install'],
        cwd,
      )
      expect(incomplete.code).toBe(2)
      expect(incomplete.stderr).toContain('não tem o tarball de @matizze/prumo-testing')
      expect(readdirSync(cwd)).toEqual([])
    })

    it('exige o nome', async () => {
      const result = await run(['new'], makeDir())
      expect(result.code).toBe(2)
    })
  })
})

describe('os arquivos do app', () => {
  it('cada arquivo vai para um destino só', () => {
    const targets = APP_FILES.map((file) => file.to)
    expect(new Set(targets).size).toBe(targets.length)
  })
})

describe('prumo new: packageManager', () => {
  /** Roda o `new --no-install` com o ambiente e a resposta do `pnpm --version` simulados. */
  async function packageManagerOf(
    env: Record<string, string | undefined>,
    asked: string | undefined,
  ): Promise<{ manifest: Record<string, unknown>; askedCount: number }> {
    const cwd = makeDir()
    const runtime = captureRuntime(cwd, env)
    let askedCount = 0
    const root = defineCommand({
      meta: { name: 'prumo' },
      subCommands: {
        new: createNewCommand(runtime, () => {
          askedCount += 1
          return asked
        }),
      },
    })
    const code = await runCli(root, ['new', 'meu-app', '--no-install'], runtime)
    expect(code, runtime.stderr).toBe(0)
    const manifest = JSON.parse(readFileSync(path.join(cwd, 'meu-app', 'package.json'), 'utf8'))
    return { manifest, askedCount }
  }

  it('grava a versão do pnpm do user agent, sem perguntar ao pnpm', async () => {
    const { manifest, askedCount } = await packageManagerOf(
      { npm_config_user_agent: 'pnpm/10.5.2 npm/? node/v24.1.0 darwin arm64' },
      '9.0.0',
    )
    expect(manifest.packageManager).toBe('pnpm@10.5.2')
    expect(askedCount).toBe(0)
    // Perto do topo: depois de name, private, version e type
    expect(Object.keys(manifest).slice(0, 5)).toEqual([
      'name',
      'private',
      'version',
      'type',
      'packageManager',
    ])
  })

  it('aceita pré-lançamento no user agent', async () => {
    const { manifest } = await packageManagerOf(
      { npm_config_user_agent: 'pnpm/11.0.0-rc.1 node/v24' },
      undefined,
    )
    expect(manifest.packageManager).toBe('pnpm@11.0.0-rc.1')
  })

  it.each([
    ['outro gerenciador', { npm_config_user_agent: 'npm/10.0.0 node/v24.1.0 darwin arm64' }],
    ['user agent ausente', {}],
    ['user agent do pnpm com versão inválida', { npm_config_user_agent: 'pnpm/latest node/v24' }],
  ])('cai no pnpm --version com %s', async (_label, env) => {
    const { manifest, askedCount } = await packageManagerOf(env, '10.7.0\n')
    expect(manifest.packageManager).toBe('pnpm@10.7.0')
    expect(askedCount).toBe(1)
  })

  it.each([
    ['sem resposta', undefined],
    ['com resposta inválida', '10.0.0; rm -rf /'],
    ['com resposta vazia', ''],
  ])(
    'deixa o campo de fora quando o pnpm --version vem %s e o user agent não ajuda',
    async (_label, asked) => {
      const { manifest } = await packageManagerOf({ npm_config_user_agent: 'yarn/4.0.0' }, asked)
      expect(manifest).not.toHaveProperty('packageManager')
    },
  )
})
