import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, realpathSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { expect } from 'vitest'
import { generatedApp, patchText } from './app.ts'
import { makeDir, writeFiles } from './fs.ts'
import { exec } from './run.ts'

/**
 * O projeto temporário que os testes de compilação dos geradores compartilham: o app que o
 * `prumo new` gera (o `generatedApp`, montado dos modelos), com o schema `clientes` do
 * `make:schema`. O `tsc` e o `vitest` rodam nele, e as dependências vêm por atalhos para o que o
 * monorepo já instala (nada é baixado).
 */
const PACKAGES = path.resolve(import.meta.dirname, '../../..')
export const REQUIRE = createRequire(import.meta.url)

/** Cada dependência do app e o pacote do monorepo em cujo `node_modules` ela está. */
const DEPENDENCIES: Record<string, string> = {
  zod: 'core',
  vitest: 'cli',
  '@types/node': 'cli',
  react: 'testing',
  'react-dom': 'testing',
  '@tanstack/react-query': 'testing',
  '@testing-library/react': 'testing',
  '@testing-library/dom': 'testing',
  jsdom: 'testing',
  wouter: 'testing',
  '@types/react': 'testing',
  '@types/react-dom': 'testing',
  i18next: 'core',
  'react-i18next': 'core',
  'i18next-icu': 'core',
  'i18next-browser-languagedetector': 'core',
}

function link(root: string, name: string, target: string): void {
  const file = path.join(root, 'node_modules', name)
  mkdirSync(path.dirname(file), { recursive: true })
  symlinkSync(target, file)
}

/** Um projeto com o schema `clientes` gerado e o repositório ainda por gerar. */
export async function project(fields = 'nome:string,idade:int,ativo:boolean'): Promise<string> {
  const root = makeDir('prumo-compile-')
  const app = { ...generatedApp() }
  // Sem o plugin do React (o monorepo não o instala aqui): o esbuild compila o JSX pelo tsconfig
  app['vite.config.ts'] = patchText(
    patchText(app['vite.config.ts']!, "import react from '@vitejs/plugin-react'\n", ''),
    '  plugins: [react()],\n',
    "  resolve: { dedupe: ['react', 'vitest'] },\n",
  )
  // O tsconfig do app inclui o vite.config.ts, que importa o que o monorepo não instala
  app['tsconfig.json'] = patchText(app['tsconfig.json']!, '"include": ["src", "vite.config.ts"]', '"include": ["src"]')
  writeFiles(root, app)
  for (const [dependency, owner] of Object.entries(DEPENDENCIES)) {
    link(root, dependency, realpathSync(path.join(PACKAGES, owner, 'node_modules', dependency)))
  }
  // O vite, para o `/// <reference types="vite/client" />` do src/vite-env.d.ts do app
  const vite = path.dirname(
    createRequire(path.join(realpathSync(path.join(root, 'node_modules', 'vitest')), 'package.json')).resolve(
      'vite/package.json',
    ),
  )
  link(root, 'vite', vite)
  for (const name of ['core', 'testing']) link(root, `@matizze/prumo-${name}`, path.join(PACKAGES, name))
  const made = await exec(['make:schema', 'clientes', '--fields', fields], root)
  expect(made.code, made.stderr).toBe(0)
  return root
}

/** Escreve um arquivo no projeto (com as pastas). */
export function writeIn(root: string, file: string, content: string): void {
  writeFiles(root, { [file]: content })
}

/**
 * Acrescenta ao `setup.ts` do app um arquivo que troca o `fetch` por uma API falsa (o `source` vai
 * para `src/test/fake-api.ts`), sem substituir o que o modelo já faz ali.
 */
export function useFakeApi(root: string, source: string): void {
  writeIn(root, 'src/test/fake-api.ts', source)
  appendFileSync(path.join(root, 'src/test/setup.ts'), "\nimport './fake-api'\n")
}

export function tsc(root: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [REQUIRE.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], {
    cwd: root,
    encoding: 'utf8',
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

/** Roda o vitest do projeto, só nos arquivos de `only` (pastas ou nomes) quando dado. */
export function vitest(
  root: string,
  env: Record<string, string> = {},
  only: string[] = [],
): { status: number | null; output: string } {
  const bin = path.join(realpathSync(path.join(root, 'node_modules', 'vitest')), 'vitest.mjs')
  const result = spawnSync(process.execPath, [bin, 'run', '--reporter=verbose', ...only], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, API_TEST_URL: '', ...env },
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}
