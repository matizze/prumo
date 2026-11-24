import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { project, tsc, vitest } from '../test/compile.ts'
import { exec } from '../test/run.ts'

/**
 * As telas geradas de verdade: o projeto temporário de `test/compile.ts` (o app que o `prumo new` gera,
 * com o i18n, o `App.tsx` e o `renderWithProviders`) recebe dois domínios (schema, repositório e query pelos comandos) e as quatro variações de tela.
 * O `tsc` estrito compila tudo e o teste que cada tela traz roda contra o mock.
 */
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
  root = await project('nome:string')
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
      expect(index).toContain('  cliente,\n  clientes,\n  errors,\n  fase,\n  home,\n  livro,\n  livros,\n  perfil,\n  sobre,\n')
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
