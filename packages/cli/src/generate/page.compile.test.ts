import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runInProcess } from '../in-process.ts'

/**
 * A tela e o componente gerados de verdade: um projeto mínimo, como o `prumo new` o deixa (App
 * sem rota, índices de mensagens e de domínios vazios, i18n, provedores e `renderWithProviders`),
 * recebe um domínio, três telas e dois componentes, e o `tsc`, o Vitest e o `prumo check` rodam
 * nele. As dependências vêm por atalhos para o que o monorepo já instala (nada é baixado).
 */
const PACKAGES = path.resolve(import.meta.dirname, '../../..')
const REQUIRE = createRequire(import.meta.url)

/** De qual pacote do workspace vem cada dependência do projeto (a pasta que a tem em `node_modules`). */
const DEPENDENCIES: Record<string, string> = {
  zod: 'core',
  '@tanstack/react-query': 'core',
  react: 'core',
  'react-dom': 'core',
  '@types/react': 'core',
  wouter: 'core',
  i18next: 'core',
  'react-i18next': 'core',
  '@testing-library/react': 'testing',
  '@testing-library/dom': 'testing',
  jsdom: 'testing',
  vitest: 'cli',
}

const OPTIONS = `import type { RepositoryOptions as CoreRepositoryOptions } from '@matizze/prumo-core/repositories'

export const DATA_SOURCES = ['memory'] as const

export type DataSource = (typeof DATA_SOURCES)[number]

export type RepositoryOptions = CoreRepositoryOptions<DataSource>
`

const REPOSITORIES_INDEX = `import {
  createRepositoryContainer,
  resolveDataSource,
  type RepositoryContainerOf,
} from '@matizze/prumo-core/repositories'
import { DATA_SOURCES, type RepositoryOptions } from './options'

export { DATA_SOURCES, type DataSource, type RepositoryOptions } from './options'

const factories = {}

export type RepositoryContainer = RepositoryContainerOf<typeof factories>

export function createRepositories(options: Partial<RepositoryOptions> = {}): RepositoryContainer {
  const dataSource = options.dataSource ?? resolveDataSource(undefined, DATA_SOURCES, 'memory')
  return createRepositoryContainer(factories, { ...options, dataSource })
}
`

const PROVIDER = `import { createRepositoryContext } from '@matizze/prumo-core/repositories'
import { createRepositories, type RepositoryContainer } from '@/repositories'

export const { RepositoryProvider, useRepositories } =
  createRepositoryContext<RepositoryContainer>(createRepositories)
`

const TSCONFIG = {
  compilerOptions: {
    target: 'es2023',
    lib: ['ES2023', 'DOM'],
    module: 'esnext',
    types: [],
    skipLibCheck: true,
    moduleResolution: 'bundler',
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    verbatimModuleSyntax: true,
    moduleDetection: 'force',
    jsx: 'react-jsx',
    noEmit: true,
    strict: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    erasableSyntaxOnly: true,
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
    paths: { '@/*': ['./src/*'] },
  },
  include: ['src'],
}

const APP = `import { Route, Switch } from 'wouter'

export default function App() {
  return (
    <Switch>
    </Switch>
  )
}
`

const MESSAGES_INDEX = 'export default {}\n'

const I18N = `import { defineI18n } from '@matizze/prumo-core/i18n'
import en from './messages/en'
import ptBR from './messages/pt-BR'

export const { I18nProvider, useTranslations } = defineI18n({
  messages: { 'pt-BR': ptBR, en },
  defaultLocale: 'pt-BR',
  languages: {
    'pt-BR': { name: 'Português (Brasil)', shortName: 'PT' },
    en: { name: 'English', shortName: 'EN' },
  },
})
`

const RENDER = `import { QueryClient } from '@tanstack/react-query'
import { createRenderWithProviders, createTestQueryClient } from '@matizze/prumo-testing'
import type { ReactNode } from 'react'
import { I18nProvider } from '@/i18n'
import { RepositoryProvider } from '@/providers/repository'
import { createRepositories, type RepositoryContainer } from '@/repositories'

function Providers({
  children,
  repositories,
}: {
  children: ReactNode
  repositories: RepositoryContainer
}) {
  return (
    <I18nProvider>
      <RepositoryProvider value={repositories}>{children}</RepositoryProvider>
    </I18nProvider>
  )
}

export const renderWithProviders = createRenderWithProviders<RepositoryContainer>({
  Providers,
  createRepositories: (overrides) => ({
    ...createRepositories({ dataSource: 'memory', latencyMs: 0 }),
    ...overrides,
  }),
  createQueryClient: () => createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
})
`

let root: string

/** Roda o `prumo` em processo no projeto. */
async function prumo(...args: string[]) {
  return runInProcess(args, { cwd: root })
}

async function prumoOk(...args: string[]) {
  const result = await prumo(...args)
  expect(result.exitCode, `${result.stdout}${result.stderr}`).toBe(0)
  return result
}

function run(command: string, args: string[]) {
  return spawnSync(command, args, { cwd: root, encoding: 'utf8' })
}

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'prumo-page-'))
  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), content)
  }
  write(
    'package.json',
    '{ "name": "app", "type": "module", "scripts": { "test": "vitest run" } }\n',
  )
  write('tsconfig.json', `${JSON.stringify(TSCONFIG, null, 2)}\n`)
  write(
    'vitest.config.ts',
    `import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') }, dedupe: ['vitest', 'react'] },
  test: { environment: 'jsdom', setupFiles: ['./setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
})
`,
  )
  write(
    'setup.ts',
    `import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
`,
  )
  write('src/App.tsx', APP)
  write('src/i18n.ts', I18N)
  write('src/messages/pt-BR/index.ts', MESSAGES_INDEX)
  write('src/messages/en/index.ts', MESSAGES_INDEX)
  write('src/schemas/index.ts', "export * from '@matizze/prumo-core/data'\n")
  write('src/repositories/options.ts', OPTIONS)
  write('src/repositories/index.ts', REPOSITORIES_INDEX)
  write('src/queries/index.ts', '// Queries, uma por domínio.\n')
  write('src/providers/repository/index.ts', PROVIDER)
  write('src/test/render.tsx', RENDER)

  for (const [dependency, owner] of Object.entries(DEPENDENCIES)) {
    const link = path.join(root, 'node_modules', dependency)
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync(realpathSync(path.join(PACKAGES, owner, 'node_modules', dependency)), link)
  }
  for (const name of ['core', 'testing']) {
    const link = path.join(root, 'node_modules', '@matizze', `prumo-${name}`)
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync(path.join(PACKAGES, name), link)
  }

  await prumoOk('make:domain', 'clientes')
  await prumoOk('make:page', 'inicio')
  await prumoOk('make:page', 'clientes', '--domain', 'clientes')
  await prumoOk('make:page', 'pedidos-recentes')
  await prumoOk('make:component', 'resumo', '--page', 'inicio')
  // O componente shared ainda sem uso em duas telas: o check o mostra como esperado, e sai com 0
  await prumoOk('make:component', 'cartao', '--shared')
}, 60_000)

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

describe('as telas e os componentes gerados, num projeto de verdade', () => {
  it('registram as três rotas e os namespaces, em ordem, nos dois idiomas', () => {
    const app = readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
    for (const route of ['/clientes', '/inicio', '/pedidos-recentes'])
      expect(app).toContain(`<Route path="${route}">`)
    for (const language of ['en', 'pt-BR']) {
      const index = readFileSync(path.join(root, `src/messages/${language}/index.ts`), 'utf8')
      expect(index).toContain('  clientes,\n  inicio,\n  pedidosRecentes,\n')
    }
  })

  it('compilam com o tsc, no modo estrito do projeto', () => {
    const result = run(process.execPath, [
      REQUIRE.resolve('typescript/bin/tsc'),
      '-p',
      'tsconfig.json',
    ])
    expect(`${result.stdout}${result.stderr}`).toBe('')
    expect(result.status).toBe(0)
  }, 120_000)

  it('passam nos próprios testes: o título, a lista do domínio e os componentes', () => {
    const vitest = path.join(realpathSync(path.join(root, 'node_modules', 'vitest')), 'vitest.mjs')
    const result = run(process.execPath, [vitest, 'run', '--reporter=verbose'])
    const output = `${result.stdout}${result.stderr}`
    expect(result.status, output).toBe(0)
    for (const file of [
      'src/pages/inicio/index.test.tsx',
      'src/pages/clientes/index.test.tsx',
      'src/pages/pedidos-recentes/index.test.tsx',
      'src/pages/inicio/components/resumo.test.tsx',
      'src/components/shared/cartao.test.tsx',
    ]) {
      expect(output).toContain(file)
    }
  }, 120_000)

  it('o prumo check só acusa o componente shared que ainda não tem duas telas', async () => {
    const result = await prumo('check')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('src/components/shared/cartao.tsx  [shared-usage]')
    expect(result.stderr).toContain('prumo check: 1 violação.')
  })

  it('o tsc de fato confere: um tipo errado na tela gerada seria pego', () => {
    const file = path.join(root, 'src/pages/clientes/view.tsx')
    const original = readFileSync(file, 'utf8')
    writeFileSync(file, original.replace('{i.name}', '{i.nome}'))
    try {
      const result = run(process.execPath, [
        REQUIRE.resolve('typescript/bin/tsc'),
        '-p',
        'tsconfig.json',
      ])
      expect(result.status).not.toBe(0)
      expect(result.stdout).toContain('src/pages/clientes/view.tsx')
    } finally {
      writeFileSync(file, original)
    }
  }, 120_000)
})
