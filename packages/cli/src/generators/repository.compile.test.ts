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

const DEPENDENCIES: Record<string, string> = { zod: 'core', vitest: 'cli' }

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
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
`,
  )
  write('src/schemas/index.ts', "export * from '@matizze/prumo-core/data'\n")
  write('src/repositories/options.ts', OPTIONS)
  write('src/repositories/index.ts', REPOSITORIES_INDEX)
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
  const made = await exec(['make:schema', 'clientes', '--fields', fields], root)
  expect(made.code, made.stderr).toBe(0)
  return root
}

const SCHEMA = 'src/schemas/entities/cliente.ts'

function edit(root: string, change: (text: string) => string): void {
  const file = path.join(root, SCHEMA)
  writeFileSync(file, change(readFileSync(file, 'utf8')))
}

async function generate(root: string): Promise<void> {
  const result = await exec(['make:repository', 'clientes'], root)
  expect(result.code, `${result.stdout}${result.stderr}`).toBe(0)
}

function tsc(root: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [REQUIRE.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], {
    cwd: root,
    encoding: 'utf8',
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

function vitest(root: string): { status: number | null; output: string } {
  const bin = path.join(realpathSync(path.join(root, 'node_modules', 'vitest')), 'vitest.mjs')
  const result = spawnSync(process.execPath, [bin, 'run'], { cwd: root, encoding: 'utf8' })
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
