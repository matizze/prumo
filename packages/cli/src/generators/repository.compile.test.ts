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
import { afterAll, describe, expect, it } from 'vitest'
import { exec } from '../test-support.ts'

/**
 * O repositório gerado de verdade: um projeto mínimo numa pasta temporária recebe o schema (do
 * `make:schema`, às vezes editado à mão) e o repositório (do `make:repository`), e o `tsc` roda
 * nele. As dependências vêm por atalhos para o que o monorepo já instala (nada é baixado).
 */
const PACKAGES = path.resolve(import.meta.dirname, '../../..')
const REQUIRE = createRequire(import.meta.url)

const DEPENDENCIES: Record<string, string> = { zod: 'core', vitest: 'cli', '@types/node': 'cli' }

const OPTIONS = `import type { RepositoryOptions as CoreRepositoryOptions } from '@matizze/prumo-core/repositories'

export const DATA_SOURCES = ['mock'] as const

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
  const dataSource = options.dataSource ?? resolveDataSource(undefined, DATA_SOURCES, 'mock')
  return createRepositoryContainer(factories, { ...options, dataSource })
}
`

/** O `localStorage` em memória: o projeto de teste roda no Node, que não tem um (o app tem, pelo jsdom). */
const SETUP_STORAGE = `import { vi } from 'vitest'

const data = new Map<string, string>()

vi.stubGlobal('localStorage', {
  get length() {
    return data.size
  },
  clear: () => data.clear(),
  getItem: (key: string) => data.get(key) ?? null,
  key: (index: number) => [...data.keys()][index] ?? null,
  removeItem: (key: string) => void data.delete(key),
  setItem: (key: string, value: string) => void data.set(key, value),
} satisfies Storage)
`

/**
 * Uma API de clientes falsa, na memória, no lugar do \`fetch\` global: segue o formato do app
 * (\`{ items, total }\`, a lista com search, sort, page e page_size, \`PATCH\`, \`DELETE\` e o 404) e
 * volta às fixtures antes de cada teste.
 */
const SETUP_FAKE_API = `${SETUP_STORAGE}
import { beforeEach } from 'vitest'
import { matchesSearch, paginate, sortBy } from '@matizze/prumo-core/mock'
import { MOCK_CLIENTES } from '@/repositories/clientes/fixtures'

type Item = (typeof MOCK_CLIENTES)[number]

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

let items: Item[] = []
let sequence = 0
beforeEach(() => {
  items = MOCK_CLIENTES.map((item) => ({ ...item }))
  sequence = items.length
})

vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input))
  const method = init?.method ?? 'GET'
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
  if (url.origin !== 'http://api.test') return json(500)

  if (url.pathname === '/clientes' && method === 'GET') {
    const found = items.filter((item) =>
      matchesSearch(
        Object.entries(item).flatMap(([key, value]) =>
          key !== 'id' && key !== 'createdAt' && typeof value === 'string' ? [value] : [],
        ),
        url.searchParams.get('search') ?? undefined,
      ),
    )
    const [key = '', direction] = (url.searchParams.get('sort') ?? '').split(':')
    const sorted = key
      ? sortBy(found, { key, direction: direction === 'desc' ? 'desc' : 'asc' }, {
          [key]: (item: Item) => {
            const value = (item as Record<string, unknown>)[key]
            return typeof value === 'number' ? value : String(value ?? '')
          },
        })
      : found
    const page = Number(url.searchParams.get('page') ?? 1)
    const size = Number(url.searchParams.get('page_size') ?? 0)
    return json(200, paginate(sorted, page, size || undefined))
  }
  if (url.pathname === '/clientes' && method === 'POST') {
    sequence += 1
    const created = { id: \`cliente-\${sequence}\`, ...body, createdAt: new Date().toISOString() } as Item
    items.push(created)
    return json(201, created)
  }
  const id = /^\\/clientes\\/([^/]+)$/.exec(url.pathname)?.[1]
  const at = items.findIndex((item) => item.id === (id === undefined ? id : decodeURIComponent(id)))
  const found = items[at]
  if (!found) return json(404)
  if (method === 'PATCH') {
    items[at] = { ...found, ...body }
    return json(200, items[at])
  }
  if (method === 'DELETE') {
    items.splice(at, 1)
    return json(204)
  }
  return json(200, found)
})
`

const TSCONFIG = {
  compilerOptions: {
    target: 'es2023',
    lib: ['ES2023', 'DOM'],
    module: 'esnext',
    types: ['node'],
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

const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

/** Um projeto mínimo, com o schema `clientes` gerado e o repositório ainda por gerar. */
async function project(fields = 'nome:string,idade:int,ativo:boolean'): Promise<string> {
  const root = mkdtempSync(path.join(tmpdir(), 'prumo-repository-'))
  roots.push(root)
  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), content)
  }
  write('package.json', '{ "name": "app", "type": "module" }\n')
  write('tsconfig.json', `${JSON.stringify(TSCONFIG, null, 2)}\n`)
  write(
    'vitest.config.ts',
    `import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') }, dedupe: ['vitest'] },
  test: { include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['./src/test/setup.ts'] },
})
`,
  )
  write('src/test/setup.ts', SETUP_STORAGE)
  write('src/schemas/index.ts', "export * from '@matizze/prumo-core/data'\n")
  write('src/repositories/options.ts', OPTIONS)
  write('src/repositories/index.ts', REPOSITORIES_INDEX)
  for (const [dependency, owner] of Object.entries(DEPENDENCIES)) {
    const link = path.join(root, 'node_modules', dependency)
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync(realpathSync(path.join(PACKAGES, owner, 'node_modules', dependency)), link)
  }
  // O vite, para o `/// <reference types="vite/client" />` do src/vite-env.d.ts que o comando cria
  const vite = path.dirname(
    createRequire(path.join(realpathSync(path.join(root, 'node_modules', 'vitest')), 'package.json')).resolve(
      'vite/package.json',
    ),
  )
  symlinkSync(vite, path.join(root, 'node_modules', 'vite'))
  for (const name of ['core', 'testing']) {
    const link = path.join(root, 'node_modules', '@matizze', `prumo-${name}`)
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync(path.join(PACKAGES, name), link)
  }
  const made = await exec(['make:schema', 'clientes', '--fields', fields], root)
  expect(made.code, made.stderr).toBe(0)
  return root
}

const SCHEMA = 'src/schemas/entities/cliente.ts'

function edit(root: string, change: (text: string) => string): void {
  const file = path.join(root, SCHEMA)
  writeFileSync(file, change(readFileSync(file, 'utf8')))
}

async function generate(root: string, ...extra: string[]): Promise<void> {
  const result = await exec(['make:repository', 'clientes', ...extra], root)
  expect(result.code, `${result.stdout}${result.stderr}`).toBe(0)
}

function tsc(root: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [REQUIRE.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], {
    cwd: root,
    encoding: 'utf8',
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

function vitest(root: string, env: Record<string, string> = {}): { status: number | null; output: string } {
  const bin = path.join(realpathSync(path.join(root, 'node_modules', 'vitest')), 'vitest.mjs')
  const result = spawnSync(process.execPath, [bin, 'run', '--reporter=verbose'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, API_TEST_URL: '', ...env },
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

describe('o repositório gerado compila (tsc estrito) e passa no contrato', () => {
  it('com o schema sem edição', async () => {
    const root = await project()
    await generate(root)
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
  }, 120_000)

  it('com um campo acrescentado à mão ao z.object, ao pick e à SortKey', async () => {
    const root = await project()
    edit(root, (text) =>
      text
        .replace('  createdAt: z.string(),', '  peso: z.number(),\n  createdAt: z.string(),')
        .replace('.pick({ ', '.pick({ peso: true, ')
        .replace(/(export type ClienteSortKey =[^\n]*)/, "$1 | 'peso'"),
    )
    await generate(root)
    expect(readFileSync(path.join(root, 'src/repositories/clientes/repository.mock.ts'), 'utf8')).toContain(
      'peso: input.peso,',
    )
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
  }, 120_000)

  it('com um campo acrescentado só ao z.object (fora do pick e da SortKey)', async () => {
    const root = await project()
    edit(root, (text) => text.replace('  createdAt: z.string(),', '  calculado: z.number().int(),\n  createdAt: z.string(),'))
    await generate(root)
    expect(readFileSync(path.join(root, 'src/repositories/clientes/repository.mock.ts'), 'utf8')).not.toContain(
      'input.calculado',
    )
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
  }, 120_000)

  it('com um campo fora do pick, mas na SortKey', async () => {
    const root = await project()
    edit(root, (text) => text.replace(/\.pick\(\{[^)]*\}\)/, '.pick({ nome: true, ativo: true })'))
    await generate(root)
    const mock = readFileSync(path.join(root, 'src/repositories/clientes/repository.mock.ts'), 'utf8')
    expect(mock).not.toContain('input.idade')
    expect(mock).toContain('idade: (item) => item.idade')
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
  }, 120_000)

  it('com um campo fora da SortKey', async () => {
    const root = await project()
    edit(root, (text) => text.replace(/export type ClienteSortKey =[^\n]*/, "export type ClienteSortKey = 'nome' | 'createdAt'"))
    await generate(root)
    const mock = readFileSync(path.join(root, 'src/repositories/clientes/repository.mock.ts'), 'utf8')
    expect(mock).not.toContain('idade: (item)')
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
  }, 120_000)

  it('recusa um booleano na SortKey, em vez de gerar um mock que não compila', async () => {
    const root = await project()
    edit(root, (text) => text.replace(/export type ClienteSortKey =[^\n]*/, "export type ClienteSortKey = 'nome' | 'ativo' | 'createdAt'"))
    const result = await exec(['make:repository', 'clientes'], root)
    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(/cliente\.ts:\d+: o ClienteSortKey tem 'ativo', que é booleano/)
  })

  it('com uma SortKey sem createdAt e um campo obrigatório fora do pick', async () => {
    const root = await project()
    edit(root, (text) =>
      text
        .replace(/export type ClienteSortKey =[^\n]*/, "export type ClienteSortKey = 'idade'")
        .replace(/\.pick\(\{[^)]*\}\)/, '.pick({ nome: true })'),
    )
    await generate(root)
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
  }, 120_000)
})

describe('as fontes storage e http compilam (tsc estrito) e passam no contrato', () => {
  const LIVROS =
    'titulo:string,ano:number,paginas:int,situacao:enum(lido|lendo|desejado),disponivel:boolean,publicadoEm:date,lidoEm?:datetime,apelido?:string'

  it('storage: o contrato roda contra o localStorage, em cima do mock', async () => {
    const root = await project()
    await generate(root)
    await generate(root, '--data-source', 'storage')
    expect(readFileSync(path.join(root, 'src/repositories/options.ts'), 'utf8')).toContain(
      "['mock', 'storage']",
    )
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
    expect(tests.output).toMatch(/StorageClientesRepository > busca um registro/)
    expect(tests.output).not.toMatch(/skipped/)
  }, 120_000)

  it('storage num repositório que ainda não existe, com campos de todos os tipos', async () => {
    const root = await project(LIVROS)
    await generate(root, '--data-source', 'storage')
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
    expect(tests.output).toMatch(/StorageClientesRepository > ordena e pagina/)
  }, 120_000)

  it('storage: os dados sobrevivem a um repositório novo, e dado corrompido volta às fixtures', async () => {
    const root = await project('nome:string')
    await generate(root, '--data-source', 'storage')
    writeFileSync(
      path.join(root, 'src/repositories/clientes/persistence.test.ts'),
      `import { expect, it } from 'vitest'
import { MOCK_CLIENTES } from './fixtures'
import { STORAGE_KEY, StorageClientesRepository } from './repository.storage'

it('grava no localStorage com a chave do app e lê de volta', async () => {
  localStorage.removeItem(STORAGE_KEY)
  expect(STORAGE_KEY).toBe('app:clientes')
  const first = new StorageClientesRepository({ latencyMs: 0 })
  const created = await first.create({ nome: 'Gravado' })
  expect(localStorage.getItem(STORAGE_KEY)).toContain('Gravado')
  const second = new StorageClientesRepository({ latencyMs: 0 })
  expect(await second.get(created.id)).toEqual(created)
  localStorage.setItem(STORAGE_KEY, '{ não é json')
  expect((await second.list()).total).toBe(MOCK_CLIENTES.length)
})
`,
    )
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
  }, 120_000)

  it('http: o contrato fica pulado sem API_TEST_URL e roda contra uma API falsa em memória', async () => {
    const root = await project(LIVROS)
    await generate(root, '--data-source', 'http')
    writeFileSync(path.join(root, 'src/test/setup.ts'), SETUP_FAKE_API)
    expect(tsc(root)).toEqual({ status: 0, output: '' })

    const skipped = vitest(root)
    expect(skipped.status, skipped.output).toBe(0)
    expect(skipped.output).toMatch(/skipped/)
    expect(skipped.output).toMatch(/pulado: defina API_TEST_URL/)

    const ran = vitest(root, { API_TEST_URL: 'http://api.test' })
    expect(ran.status, ran.output).toBe(0)
    expect(ran.output).toMatch(/HttpClientesRepository > cria um registro/)
    expect(ran.output).toMatch(/HttpClientesRepository > remove um registro/)
    expect(ran.output).not.toMatch(/skipped/)
  }, 120_000)

  it('http e storage no mesmo domínio, com o app já tendo o cliente http', async () => {
    const root = await project()
    await generate(root, '--data-source', 'http')
    await generate(root, '--data-source', 'storage')
    writeFileSync(path.join(root, 'src/test/setup.ts'), SETUP_FAKE_API)
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root, { API_TEST_URL: 'http://api.test' })
    expect(tests.status, tests.output).toBe(0)
    expect(tests.output).toMatch(/StorageClientesRepository > lista as fixtures/)
    expect(tests.output).toMatch(/HttpClientesRepository > lista as fixtures/)
  }, 120_000)
})
