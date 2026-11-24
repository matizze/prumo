import { mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { exec } from '../test-support.ts'
import { project, tsc, vitest } from './compile-test-support.ts'

/**
 * As telas geradas de verdade: o projeto temporário de `compile-test-support.ts` (com React, React
 * Query e o Testing Library), mais o i18n, o `App.tsx` e o `renderWithProviders` do `prumo new`,
 * recebe dois domínios (schema, repositório e query pelos comandos) e as quatro variações de tela.
 * O `tsc` estrito compila tudo e o teste que cada tela traz roda contra o mock.
 */
const TEMPLATES = path.resolve(import.meta.dirname, '../../templates')
const CORE = path.resolve(import.meta.dirname, '../../../core')

const template = (file: string) => readFileSync(path.join(TEMPLATES, 'app', file), 'utf8')

const PAGES = [
  ['sobre'],
  ['clientes', '--query', 'clientes'],
  ['cliente', '--query', 'clientes', '--path', '/clientes/:id'],
  ['livros', '--query', 'livros'],
  ['livro', '--query', 'livros', '--path', '/livros/:id'],
  ['perfil', '--path', '/perfil/:usuario'],
  ['fase', '--query', 'fases-2', '--path', '/fases/:id'],
] as const

let root: string

beforeAll(async () => {
  root = await project('nome:string', { react: true })
  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), content)
  }
  for (const dependency of ['i18next', 'react-i18next', 'i18next-icu', 'i18next-browser-languagedetector']) {
    symlinkSync(
      realpathSync(path.join(CORE, 'node_modules', dependency)),
      path.join(root, 'node_modules', dependency),
    )
  }
  write('package.json', '{ "name": "app", "type": "module", "scripts": { "test": "vitest run" } }\n')
  write(
    'vitest.config.ts',
    `import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') }, dedupe: ['vitest', 'react'] },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
})
`,
  )
  write(
    'src/test/setup.ts',
    `import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
`,
  )
  write('src/App.tsx', template('src/App.tsx.tpl'))
  write('src/i18n.ts', template('src/i18n.ts.tpl'))
  write('src/messages/pt-BR/index.ts', 'export default {}\n')
  write('src/messages/en/index.ts', 'export default {}\n')
  write('src/providers/repository/index.ts', template('src/providers/repository/index.ts.tpl'))
  write('src/queries/index.ts', template('src/queries-index.ts.tpl'))
  write('src/test/render.tsx', template('src/test/render.tsx.tpl'))

  const prumo = async (...args: string[]) => {
    const made = await exec(args, root)
    expect(made.code, `${args.join(' ')}\n${made.stdout}${made.stderr}`).toBe(0)
    return made
  }
  await prumo(
    'make:schema',
    'livros',
    '--fields',
    'titulo:string,ano:number,situacao:enum(lido|lendo),lidoEm?:datetime',
  )
  // Um domínio com dígito no nome da entidade (fase-2): o arquivo do schema e o id vêm dos arquivos
  await prumo('make:schema', 'fases-2', '--entity', 'fase-2', '--fields', 'titulo:string')
  for (const domain of ['clientes', 'livros']) {
    await prumo('make:repository', domain)
    await prumo('make:query', domain)
  }
  await prumo('make:repository', 'fases-2', '--entity', 'fase-2')
  await prumo('make:query', 'fases-2', '--entity', 'fase-2')
  for (const args of PAGES) await prumo('make:page', ...args)
}, 120_000)

describe('as telas geradas compilam (tsc estrito) e passam nos próprios testes', () => {
  it('registram as rotas e os namespaces, em ordem, nos dois idiomas', () => {
    const app = readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
    for (const route of ['/sobre', '/clientes', '/clientes/:id', '/livros', '/livros/:id', '/perfil/:usuario', '/fases/:id']) {
      expect(app).toContain(`<Route path="${route}">`)
    }
    for (const language of ['en', 'pt-BR']) {
      const index = readFileSync(path.join(root, `src/messages/${language}/index.ts`), 'utf8')
      expect(index).toContain('  cliente,\n  clientes,\n  fase,\n  livro,\n  livros,\n  perfil,\n  sobre,\n')
    }
  })

  it('as quatro variações: o que cada model usa', () => {
    const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
    expect(read('src/pages/sobre/model.ts')).not.toContain('@/queries')
    expect(read('src/pages/clientes/model.ts')).toContain('useClientesList')
    expect(read('src/pages/livros/view.tsx')).toContain('{i.titulo}')
    expect(read('src/pages/perfil/model.ts')).toContain('useParams<{ usuario: string }>()')
    expect(read('src/pages/livro/model.ts')).toContain('useLivroDetail(id)')
  })

  it('compilam com o tsc, no modo estrito do projeto', () => {
    expect(tsc(root)).toEqual({ status: 0, output: '' })
  }, 180_000)

  it('cada tela passa no teste que traz', () => {
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
    for (const page of ['sobre', 'clientes', 'cliente', 'livros', 'livro', 'perfil', 'fase']) {
      expect(tests.output).toContain(`src/pages/${page}/index.test.tsx`)
    }
  }, 180_000)

  it('o tsc de fato confere: um campo que não existe na tela gerada seria pego', () => {
    const file = path.join(root, 'src/pages/livros/view.tsx')
    const original = readFileSync(file, 'utf8')
    writeFileSync(file, original.replace('{i.titulo}', '{i.nome}'))
    try {
      const result = tsc(root)
      expect(result.status).not.toBe(0)
      expect(result.output).toContain('src/pages/livros/view.tsx')
    } finally {
      writeFileSync(file, original)
    }
  }, 180_000)
})
