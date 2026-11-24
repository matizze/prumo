import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, expect } from 'vitest'
import { exec } from '../test-support.ts'

/**
 * O projeto temporário que os testes de compilação dos geradores compartilham: um projeto mínimo
 * numa pasta temporária recebe o schema (do `make:schema`) e o que o teste gera, e o `tsc` e o
 * `vitest` rodam nele. As dependências vêm por atalhos para o que o monorepo já instala (nada é baixado).
 */
const PACKAGES = path.resolve(import.meta.dirname, '../../..')
export const REQUIRE = createRequire(import.meta.url)

const DEPENDENCIES: Record<string, string> = { zod: 'core', vitest: 'cli', '@types/node': 'cli' }

/** As dependências a mais do projeto das queries: React, React Query e o Testing Library, que o monorepo já instala no pacote testing. */
const REACT_DEPENDENCIES = ['react', 'react-dom', '@tanstack/react-query', '@testing-library/react', '@testing-library/dom', 'jsdom', 'wouter', '@types/react', '@types/react-dom']

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
export const SETUP_STORAGE = `import { vi } from 'vitest'

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
export async function project(
  fields = 'nome:string,idade:int,ativo:boolean',
  { react = false }: { react?: boolean } = {},
): Promise<string> {
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
  if (react) {
    for (const dependency of REACT_DEPENDENCIES) {
      const link = path.join(root, 'node_modules', dependency)
      mkdirSync(path.dirname(link), { recursive: true })
      symlinkSync(realpathSync(path.join(PACKAGES, 'testing', 'node_modules', dependency)), link)
    }
  }
  const made = await exec(['make:schema', 'clientes', '--fields', fields], root)
  expect(made.code, made.stderr).toBe(0)
  return root
}

export function tsc(root: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [REQUIRE.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], {
    cwd: root,
    encoding: 'utf8',
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

export function vitest(root: string, env: Record<string, string> = {}): { status: number | null; output: string } {
  const bin = path.join(realpathSync(path.join(root, 'node_modules', 'vitest')), 'vitest.mjs')
  const result = spawnSync(process.execPath, [bin, 'run', '--reporter=verbose'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, API_TEST_URL: '', ...env },
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

