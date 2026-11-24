import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../test/fixture-project.ts'
import { listProject, type ProjectListing } from '../lib/listing.ts'
import { makeDir, makeProject } from '../test/fs.ts'
import { exec } from '../test/run.ts'

async function make(root: string, ...commands: string[][]) {
  for (const args of commands) {
    const result = await exec(args, root)
    expect(result.code, result.stderr).toBe(0)
  }
}

/** Um projeto de fixture com todas as camadas: livros (as três fontes), uma lista, um detalhe e uma tela só com título. */
async function fullProject() {
  const { root } = fixtureProject()
  await make(
    root,
    ['make:schema', 'livros', '--fields', 'title:string,year?:int,status:enum(lido|lendo)'],
    ['make:repository', 'livros'],
    ['make:repository', 'livros', '--data-source', 'http'],
    ['make:repository', 'livros', '--data-source', 'storage'],
    ['make:query', 'livros'],
    ['make:page', 'livros-lista', '--query', 'livros'],
    ['make:page', 'livro', '--query', 'livros', '--path', '/livros/:id'],
    ['make:page', 'sobre'],
    ['make:page', 'item', '--path', '/item/:id'],
  )
  return root
}

describe('listProject', () => {
  it('lista um projeto com todas as camadas e as três fontes', async () => {
    const root = await fullProject()
    const listing = listProject({ ...fixtureProjectAt(root) })

    expect(listing.schemas).toEqual([
      {
        entity: 'Livro',
        file: 'src/schemas/entities/livro.ts',
        fields: [
          { name: 'title', type: 'string', optional: false },
          { name: 'year', type: 'int', optional: true },
          { name: 'status', type: 'enum', values: ['lido', 'lendo'], optional: false },
        ],
        problem: null,
      },
    ])
    expect(listing.repositories).toEqual([
      { domain: 'livros', entity: 'Livro', sources: ['mock', 'http', 'storage'] },
    ])
    expect(listing.queries).toHaveLength(1)
    expect(listing.queries[0]).toMatchObject({ domain: 'livros', entity: 'Livro', file: 'src/queries/livros.ts' })
    expect(listing.queries[0]?.hooks).toEqual([
      'useLivrosList',
      'useLivroDetail',
      'useCreateLivro',
      'useUpdateLivro',
      'useRemoveLivro',
    ])
    expect(listing.pages).toEqual([
      { name: 'item', route: '/item/:id', routeKind: 'literal', routePartial: false, variation: 'param', query: null },
      { name: 'livro', route: '/livros/:id', routeKind: 'literal', routePartial: false, variation: 'detail', query: 'livros' },
      { name: 'livros-lista', route: '/livros-lista', routeKind: 'literal', routePartial: false, variation: 'list', query: 'livros' },
      { name: 'sobre', route: '/sobre', routeKind: 'literal', routePartial: false, variation: 'title', query: null },
    ])
    expect(listing.languages).toEqual(['en', 'pt-BR'])
  })

  it('só com mock: a fonte que falta na fábrica não aparece', async () => {
    const { root } = fixtureProject()
    await make(root, ['make:schema', 'livros'], ['make:repository', 'livros'])
    const listing = listProject(fixtureProjectAt(root))
    expect(listing.repositories[0]?.sources).toEqual(['mock'])
  })

  it('schema editado à mão aparece sem campos e com o motivo', async () => {
    const { root } = fixtureProject()
    await make(root, ['make:schema', 'livros'])
    const file = path.join(root, 'src/schemas/entities/livro.ts')
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('name: z.string(),', 'name: z.string().min(2).max(9),'),
    )
    const [schema] = listProject(fixtureProjectAt(root)).schemas
    expect(schema?.entity).toBe('Livro')
    expect(schema?.fields).toBeNull()
    expect(schema?.problem).toMatch(/^linha \d+: campo 'name': não reconheço o tipo \(z\.string\(\)\.min\(2\)\.max\(9\)\)/)
    expect(schema?.problem?.length).toBeLessThanOrEqual(160)
  })

  it('tela sem rota no App.tsx tem route null', async () => {
    const { root } = fixtureProject()
    await make(root, ['make:page', 'sobre'])
    const app = path.join(root, 'src/App.tsx')
    writeFileSync(app, readFileSync(app, 'utf8').replace(/\s*<Route path="\/sobre">[\s\S]*?<\/Route>/, ''))
    expect(listProject(fixtureProjectAt(root)).pages).toEqual([
      { name: 'sobre', route: null, routeKind: null, routePartial: false, variation: 'title', query: null },
    ])
  })

  it('rota aninhada: compõe os <Route nest> de fora e usa a mais interna', () => {
    const root = appWith(
      `import { Route, Switch } from 'wouter'
import UsersPage from '@/pages/usuarios'
export default function App() {
  return (
    <Switch>
      <Route path="/admin" nest>
        <Route path="/usuarios/:id">
          <UsersPage />
        </Route>
      </Route>
    </Switch>
  )
}
`,
      ['usuarios'],
    )
    expect(listProject(fixtureProjectAt(root)).pages).toEqual([
      { name: 'usuarios', route: '/admin/usuarios/:id', routeKind: 'literal', routePartial: false, variation: 'param', query: null },
    ])
  })

  it('rota aninhada com o caminho de fora que não é literal: mostra a de dentro e marca parcial', () => {
    const root = appWith(
      `import { Route } from 'wouter'
import UsersPage from '@/pages/usuarios'
export default function App() {
  return (
    <Route path={BASE} nest>
      <Route path="/usuarios">
        <UsersPage />
      </Route>
    </Route>
  )
}
`,
      ['usuarios'],
    )
    const [page] = listProject(fixtureProjectAt(root)).pages
    expect(page).toMatchObject({ route: '/usuarios', routeKind: 'literal', routePartial: true })
  })

  it('curinga e path com expressão aparecem como rota, com o tipo', async () => {
    const root = appWith(
      `import { Route } from 'wouter'
import A from '@/pages/a'
import B from '@/pages/b'
import C from '@/pages/c'
export default function App() {
  return (
    <>
      <Route path={ROUTES.lenta}><A /></Route>
      <Route path="*"><B /></Route>
      <Route><C /></Route>
    </>
  )
}
`,
      ['a', 'b', 'c', 'd'],
    )
    const pages = listProject(fixtureProjectAt(root)).pages.map(({ name, route, routeKind }) => ({ name, route, routeKind }))
    expect(pages).toEqual([
      { name: 'a', route: '{ROUTES.lenta}', routeKind: 'expression' },
      { name: 'b', route: '*', routeKind: 'catchAll' },
      { name: 'c', route: '*', routeKind: 'catchAll' },
      { name: 'd', route: null, routeKind: null },
    ])
    const text = (await exec(['list'], root)).stdout
    expect(text).toContain('  a  rota: {ROUTES.lenta} (expressão)  título\n')
    expect(text).toContain('  b  rota: curinga  título\n')
    expect(text).toContain('  d  rota: nenhuma  título\n')
  })

  it('tela carregada com lazy tem rota', () => {
    const root = appWith(
      `import { lazy } from 'react'
import { Route } from 'wouter'
const Sobre = lazy(() => import('@/pages/sobre'))
export default function App() {
  return (
    <Route path="/sobre">
      <Sobre />
    </Route>
  )
}
`,
      ['sobre'],
    )
    expect(listProject(fixtureProjectAt(root)).pages[0]).toMatchObject({ name: 'sobre', route: '/sobre' })
  })

  it('pasta de tela com nome inválido não derruba o list', () => {
    const root = appWith(`export default function App() { return null }\n`, ['c++', 'a.b'])
    expect(listProject(fixtureProjectAt(root)).pages.map((page) => page.name)).toEqual(['a.b', 'c++'])
  })

  it('contrato vazio: a entidade vem do hook de detalhe da query, ou é null', () => {
    const root = makeProject({
      'src/repositories/livros/repository.contract.ts': '',
      'src/queries/livros.ts': 'export function useLivroDetail() {}\n',
      'src/repositories/vazio/repository.contract.ts': '',
    })
    const listing = listProject(fixtureProjectAt(root))
    expect(listing.queries[0]?.entity).toBe('Livro')
    expect(listing.repositories.map((r) => r.entity)).toEqual([null, null])
  })

  it('a ordem é a do código, não a do locale', () => {
    const root = makeProject({
      'src/pages/b/index.tsx': '',
      'src/pages/Z/index.tsx': '',
      'src/pages/a/index.tsx': '',
    })
    expect(listProject(fixtureProjectAt(root)).pages.map((page) => page.name)).toEqual(['Z', 'a', 'b'])
  })

  it('projeto vazio: só src', () => {
    const root = makeProject({}, ['src'])
    expect(listProject(fixtureProjectAt(root))).toEqual({
      schemas: [],
      repositories: [],
      queries: [],
      pages: [],
      languages: [],
    })
  })
})

/** Um projeto com o `App.tsx` dado e uma pasta (com `index.tsx`) por tela. */
function appWith(app: string, pages: string[]): string {
  return makeProject({
    'src/App.tsx': app,
    ...Object.fromEntries(pages.map((page) => [`src/pages/${page}/index.tsx`, ''])),
  })
}

function fixtureProjectAt(root: string) {
  return {
    root,
    src: path.join(root, 'src'),
    pages: path.join(root, 'src', 'pages'),
    messages: path.join(root, 'src', 'messages'),
    app: path.join(root, 'src', 'App.tsx'),
  }
}

describe('prumo list', () => {
  it('escreve o texto, uma seção por tipo', async () => {
    const root = await fullProject()
    const result = await exec(['list', '--root', root], process.cwd())

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain(
      'Schemas (1):\n  Livro  src/schemas/entities/livro.ts  title: string, year?: int, status: enum(lido|lendo)\n',
    )
    expect(result.stdout).toContain('Repositórios (1):\n  livros  Livro  fontes: mock, http, storage\n')
    expect(result.stdout).toContain('  livro  rota: /livros/:id  detalhe  query: livros\n')
    expect(result.stdout).toContain('  sobre  rota: /sobre  título\n')
    expect(result.stdout).toContain('Idiomas (2):\n  en\n  pt-BR\n')
  })

  it('schema editado à mão e tela sem rota no texto', async () => {
    const root = makeProject({
      'src/schemas/entities/livro.ts': 'export const livroSchema = z.object({ a: z.foo() })\n',
      'src/pages/solta/index.tsx': 'export default function P() { return null }\n',
    })
    const result = await exec(['list'], root)
    expect(result.stdout).toContain(
      "Livro  src/schemas/entities/livro.ts  editado à mão (linha 1: campo 'a': não reconheço o tipo (z.foo())",
    )
    expect(result.stdout).toContain('  solta  rota: nenhuma  título\n')
  })

  it('projeto vazio: cada seção diz nenhum', async () => {
    const root = makeProject({}, ['src'])
    const result = await exec(['list'], root)
    expect(result.stdout).toBe(
      'Schemas: nenhum\n\nRepositórios: nenhum\n\nQueries: nenhum\n\nTelas: nenhum\n\nIdiomas: nenhum\n',
    )
  })

  it('--json escreve o ProjectListing', async () => {
    const root = await fullProject()
    const result = await exec(['list', '--root', root, '--json'], process.cwd())
    const listing = JSON.parse(result.stdout) as ProjectListing

    expect(result.code, result.stderr).toBe(0)
    expect(Object.keys(listing)).toEqual(['schemas', 'repositories', 'queries', 'pages', 'languages'])
    expect(listing.repositories[0]?.sources).toEqual(['mock', 'http', 'storage'])
    expect(listing.pages.map((page) => page.name)).toEqual(['item', 'livro', 'livros-lista', 'sobre'])
  })

  it('não escreve nada no projeto', async () => {
    const root = await fullProject()
    const before = readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
    await exec(['list', '--root', root], process.cwd())
    expect(readFileSync(path.join(root, 'src/App.tsx'), 'utf8')).toBe(before)
  })

  it('sai com 2 na pasta que não é um projeto', async () => {
    const dir = makeDir()
    mkdirSync(path.join(dir, 'x'))
    for (const args of [['list'], ['list', '--json']]) {
      const result = await exec(args, dir)
      expect(result.code).toBe(2)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('nenhum projeto Prumo achado a partir de')
    }
  })
})
