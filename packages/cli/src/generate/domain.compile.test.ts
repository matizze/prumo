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
 * O domínio gerado de verdade: um projeto mínimo (o que o `make:domain` toca: os índices de schemas,
 * repositórios e queries, o container e o provedor de repositórios) numa pasta temporária recebe três
 * domínios, e o `tsc` e o Vitest rodam nele. As dependências do projeto vêm por atalhos para o que o
 * monorepo já instala (nada é baixado), como o gerenciador de pacotes as poria em `node_modules`.
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

/** O índice de repositórios de um projeto novo: o container sem nenhum domínio ainda. */
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

/** Cada hook gerado roda de verdade: lista, detalhe e as três mutations, que invalidam a lista. */
const HOOKS_TEST = `// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it } from 'vitest'
import { RepositoryProvider } from '@/providers/repository'
import {
  useClientesList,
  useClienteDetail,
  useCreateCliente,
  useRemoveCliente,
  useUpdateCliente,
} from '@/queries'
import { createRepositories } from '@/repositories'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const repositories = createRepositories({ latencyMs: 0 })
  return (
    <RepositoryProvider value={repositories}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </RepositoryProvider>
  )
}

it('lista, busca, cria, edita e remove pelos hooks, e a lista acompanha as mutations', async () => {
  const { result } = renderHook(
    () => ({
      list: useClientesList(),
      detail: useClienteDetail('cliente-1'),
      create: useCreateCliente(),
      update: useUpdateCliente(),
      remove: useRemoveCliente(),
    }),
    { wrapper },
  )

  await waitFor(() => expect(result.current.list.data?.total).toBe(3))
  await waitFor(() => expect(result.current.detail.data?.name).toBe('Exemplo 1'))

  result.current.create.mutate({ name: 'Novo' })
  await waitFor(() => expect(result.current.list.data?.total).toBe(4))

  result.current.update.mutate({ id: 'cliente-2', input: { name: 'Renomeado' } })
  await waitFor(() =>
    expect(result.current.list.data?.items.map((item) => item.name)).toContain('Renomeado'),
  )

  result.current.remove.mutate('cliente-3')
  await waitFor(() => expect(result.current.list.data?.total).toBe(3))
})
`

let root: string

/** Roda o `prumo` em processo no projeto e confere que saiu sem erro. */
async function prumo(...args: string[]) {
  const result = await runInProcess(args, { cwd: root })
  expect(result.exitCode, `${result.stdout}${result.stderr}`).toBe(0)
  return result
}

function run(command: string, args: string[]) {
  return spawnSync(command, args, { cwd: root, encoding: 'utf8' })
}

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'prumo-domain-'))
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
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') }, dedupe: ['vitest'] },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
`,
  )
  write('src/schemas/index.ts', "export * from '@matizze/prumo-core/data'\n")
  write('src/repositories/options.ts', OPTIONS)
  write('src/repositories/index.ts', REPOSITORIES_INDEX)
  write('src/queries/index.ts', '// Queries, uma por domínio.\n')
  write('src/providers/repository/index.ts', PROVIDER)

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

  await prumo('make:domain', 'clientes')
  await prumo('make:domain', 'pedidos-recentes', '--entity', 'pedido-recente')
  await prumo('make:domain', 'categories', '--entity', 'category')
  write('src/queries/hooks.test.tsx', HOOKS_TEST)
}, 60_000)

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

describe('o domínio gerado, num projeto de verdade', () => {
  it('compila com o tsc, no modo estrito do projeto', () => {
    const tsc = REQUIRE.resolve('typescript/bin/tsc')
    const result = run(process.execPath, [tsc, '-p', 'tsconfig.json'])
    expect(`${result.stdout}${result.stderr}`).toBe('')
    expect(result.status).toBe(0)
  }, 120_000)

  it('passa nos próprios testes: o contrato de cada mock e os hooks', () => {
    const vitest = path.join(realpathSync(path.join(root, 'node_modules', 'vitest')), 'vitest.mjs')
    const result = run(process.execPath, [vitest, 'run', '--reporter=verbose'])
    const output = `${result.stdout}${result.stderr}`
    expect(result.status, output).toBe(0)
    for (const folder of ['clientes', 'pedidos-recentes', 'categories']) {
      expect(output).toContain(`src/repositories/${folder}/repository.contract.test.ts`)
    }
    expect(output).toContain('src/queries/hooks.test.tsx')
    // Sete casos de contrato por domínio, mais o dos hooks
    expect(output).toMatch(/Tests {2}22 passed \(22\)/)
  }, 120_000)

  it('o tsc de fato confere: um tipo errado no domínio gerado seria pego', () => {
    const file = path.join(root, 'src/repositories/clientes/fixtures.ts')
    const original = readFileSync(file, 'utf8')
    writeFileSync(file, original.replace("name: 'Exemplo 1'", 'name: 1'))
    try {
      const result = run(process.execPath, [
        REQUIRE.resolve('typescript/bin/tsc'),
        '-p',
        'tsconfig.json',
      ])
      expect(result.status).not.toBe(0)
      expect(result.stdout).toContain('src/repositories/clientes/fixtures.ts')
    } finally {
      writeFileSync(file, original)
    }
  }, 120_000)
})
