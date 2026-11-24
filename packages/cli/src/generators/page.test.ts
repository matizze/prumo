import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemods/test-support.ts'
import { UsageError } from '../errors.ts'
import { generatePage, parseRoutePath } from './page.ts'

/** Dá ao projeto a query `clientes` e a entidade `cliente`: o contrato, o schema e as fixtures que a tela lê. */
function withQuery(root: string, { detail = true, fields = '  name: z.string(),\n', fixture = "{ id: 'cliente-1', name: 'Exemplo 1', createdAt: 'x' }" } = {}) {
  const write = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), text)
  }
  write(
    'src/queries/clientes.ts',
    `export function useClientesList() {\n  return null\n}\n${detail ? 'export function useClienteDetail(id: string) {\n  return id\n}\n' : ''}`,
  )
  write(
    'src/repositories/clientes/repository.contract.ts',
    "export interface IClientesRepository {\n  list(): Promise<Page<ClienteSchema>>\n  get(id: string): Promise<ClienteSchema>\n}\n",
  )
  write(
    'src/schemas/entities/cliente.ts',
    `export const clienteSchema = z.object({\n  id: z.string(),\n${fields}  createdAt: z.string(),\n})\n`,
  )
  write('src/repositories/clientes/fixtures.ts', `export const MOCK_CLIENTES = [\n  ${fixture},\n]\n`)
}

const at = (plan: { project: { root: string }; source: (file: string) => { getFullText(): string } }, file: string) =>
  plan.source(path.join(plan.project.root, file)).getFullText()

describe('generatePage (só o título)', () => {
  it('planeja index, model, view, teste, mensagens, índices e a rota, sem escrever nada', () => {
    const project = fixtureProject()
    const { plan, names, route } = generatePage(project, { name: 'pedidos-recentes' })

    expect(names.pascal).toBe('PedidosRecentes')
    expect(route).toBe('/pedidos-recentes')
    expect(plan.summary()).toEqual({
      created: [
        'src/messages/en/pedidos-recentes.json',
        'src/messages/pt-BR/pedidos-recentes.json',
        'src/pages/pedidos-recentes/index.test.tsx',
        'src/pages/pedidos-recentes/index.tsx',
        'src/pages/pedidos-recentes/model.ts',
        'src/pages/pedidos-recentes/view.tsx',
      ],
      modified: ['src/App.tsx', 'src/messages/en/index.ts', 'src/messages/pt-BR/index.ts'],
    })
    expect(readFileSync(project.app, 'utf8')).not.toContain('PedidosRecentesPage')
  })

  it('grava no commit: a rota, o import e o namespace de mensagens', () => {
    const project = fixtureProject()
    generatePage(project, { name: 'clientes', route: '/lista' }).plan.commit()

    const app = readFileSync(project.app, 'utf8')
    expect(app).toContain("import ClientesPage from '@/pages/clientes'")
    expect(app).toContain('<Route path="/lista">')
    const model = readFileSync(path.join(project.pages, 'clientes/model.ts'), 'utf8')
    expect(model).toContain("useTranslations('clientes')")
    expect(readFileSync(path.join(project.messages, 'en/index.ts'), 'utf8')).toContain(
      "import clientes from './clientes.json'",
    )
    expect(
      JSON.parse(readFileSync(path.join(project.messages, 'pt-BR/clientes.json'), 'utf8')),
    ).toEqual({ title: 'Clientes' })
  })

  it('recusa nome inválido, reservado, tela que existe e rota inválida, sem planejar nada', () => {
    const project = fixtureProject()
    expect(() => generatePage(project, { name: 'Clientes' })).toThrow(UsageError)
    expect(() => generatePage(project, { name: 'new' })).toThrow(/palavra reservada/)
    expect(() => generatePage(project, { name: 'a', route: 'a' })).toThrow(/precisa começar com \//)
    expect(() => generatePage(project, { name: 'a', route: '/a//b' })).toThrow(UsageError)
    expect(() => generatePage(project, { name: 'a', route: '/a/:x/:y' })).toThrow(/2 parâmetros/)
    generatePage(project, { name: 'clientes' }).plan.commit()
    expect(() => generatePage(project, { name: 'clientes' })).toThrow(/já existe/)
  })
})

describe('generatePage com --query (a lista)', () => {
  it('o model lê a lista, a view mostra o carregando, o erro e a lista, e há textos nos dois idiomas', () => {
    const project = fixtureProject()
    withQuery(project.root)
    const { plan, query, warnings } = generatePage(project, { name: 'clientes', query: 'clientes' })

    expect(query?.kebab).toBe('clientes')
    expect(warnings).toEqual([])
    expect(at(plan, 'src/pages/clientes/model.ts')).toContain('const list = useClientesList()')
    expect(at(plan, 'src/pages/clientes/view.tsx')).toContain('<li key={i.id}>{i.name}</li>')
    expect(at(plan, 'src/pages/clientes/view.tsx')).toContain('m.loading ?')
    plan.commit()
    expect(JSON.parse(readFileSync(path.join(project.root, 'src/messages/en/clientes.json'), 'utf8'))).toEqual({
      title: 'Clientes',
      loading: 'Loading…',
      failed: 'Could not load the list.',
    })
    expect(readFileSync(path.join(project.root, 'src/messages/pt-BR/clientes.json'), 'utf8')).toContain(
      '"loading": "Carregando…"',
    )
  })

  it('mostra o primeiro campo de texto obrigatório do schema que existe, não o name', () => {
    const project = fixtureProject()
    withQuery(project.root, {
      fields: '  ano: z.number(),\n  apelido: z.string().optional(),\n  titulo: z.string(),\n',
      fixture: "{ id: 'cliente-1', ano: 10, titulo: 'Titulo 1', createdAt: 'x' }",
    })
    const { plan, warnings } = generatePage(project, { name: 'clientes', query: 'clientes' })

    expect(at(plan, 'src/pages/clientes/view.tsx')).toContain('<li key={i.id}>{i.titulo}</li>')
    expect(warnings).toEqual([])
  })

  it('sem campo de texto no schema, mostra o id e avisa, sem falhar', () => {
    const project = fixtureProject()
    withQuery(project.root, { fields: '  ano: z.number(),\n', fixture: "{ id: 'cliente-1' }" })
    const { plan, warnings } = generatePage(project, { name: 'clientes', query: 'clientes' })

    expect(at(plan, 'src/pages/clientes/view.tsx')).toContain('<li key={i.id}>{i.id}</li>')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('não tem campo de texto')
  })

  it('sem conseguir ler o schema, mostra o id e avisa', () => {
    const project = fixtureProject()
    withQuery(project.root)
    rmSync(path.join(project.root, 'src/schemas/entities/cliente.ts'))
    const { warnings } = generatePage(project, { name: 'clientes', query: 'clientes' })

    expect(warnings[0]).toContain('não consegui ler o schema')
  })

  it('a entidade sai do contrato do repositório, mesmo com o nome do domínio fora da regra do s', () => {
    const project = fixtureProject()
    withQuery(project.root)
    writeFileSync(
      path.join(project.root, 'src/repositories/clientes/repository.contract.ts'),
      'export interface IClientesRepository {\n  list(): Promise<Page<PessoaSchema>>\n}\n',
    )
    mkdirSync(path.join(project.root, 'src/schemas/entities'), { recursive: true })
    writeFileSync(
      path.join(project.root, 'src/schemas/entities/pessoa.ts'),
      'export const pessoaSchema = z.object({\n  id: z.string(),\n  apelido: z.string(),\n})\n',
    )
    const { plan } = generatePage(project, { name: 'clientes', query: 'clientes' })
    expect(at(plan, 'src/pages/clientes/view.tsx')).toContain('{i.apelido}')
  })

  it('a tela pode ter outro nome que o do domínio', () => {
    const project = fixtureProject()
    withQuery(project.root)
    const { plan } = generatePage(project, { name: 'lista-de-clientes', query: 'clientes' })

    expect(at(plan, 'src/pages/lista-de-clientes/model.ts')).toContain('useClientesList()')
  })

  it('recusa a query que falta, com a dica do make:query, e a que não tem o hook de lista', () => {
    const project = fixtureProject()
    expect(() => generatePage(project, { name: 'clientes', query: 'clientes' })).toThrow(
      /falta src\/queries\/clientes\.ts; rode prumo make:query clientes/,
    )
    mkdirSync(path.join(project.root, 'src/queries'), { recursive: true })
    writeFileSync(path.join(project.root, 'src/queries/clientes.ts'), 'export const x = 1\n')
    expect(() => generatePage(project, { name: 'clientes', query: 'clientes' })).toThrow(
      /não tem o hook useClientesList/,
    )
    expect(() => generatePage(project, { name: 'clientes', query: 'Meus_Clientes' })).toThrow(
      /o nome do domínio/,
    )
  })
})

describe('generatePage com --path (parâmetro)', () => {
  it('sem parâmetro: só troca a rota', () => {
    const project = fixtureProject()
    const { plan, route } = generatePage(project, { name: 'clientes', route: '/gente/lista' })

    expect(route).toBe('/gente/lista')
    expect(at(plan, 'src/App.tsx')).toContain('<Route path="/gente/lista">')
    expect(at(plan, 'src/pages/clientes/model.ts')).not.toContain('useParams')
  })

  it('com parâmetro: o model lê o useParams, a view o mostra e o teste renderiza dentro da <Route>', () => {
    const project = fixtureProject()
    const { plan } = generatePage(project, { name: 'livro', route: '/livros/:id' })

    expect(at(plan, 'src/pages/livro/model.ts')).toContain('const { id } = useParams<{ id: string }>()')
    expect(at(plan, 'src/pages/livro/view.tsx')).toContain('<p>{m.params.id}</p>')
    const test = at(plan, 'src/pages/livro/index.test.tsx')
    expect(test).toContain('<Route path="/livros/:id">')
    expect(test).toContain("{ path: '/livros/exemplo' }")
    expect(at(plan, 'src/App.tsx')).toContain('<Route path="/livros/:id">')
  })

  it('com --query e parâmetro: é o detalhe, que busca o registro pelo hook da entidade', () => {
    const project = fixtureProject()
    withQuery(project.root)
    const { plan } = generatePage(project, { name: 'cliente', query: 'clientes', route: '/clientes/:id' })

    expect(at(plan, 'src/pages/cliente/model.ts')).toContain('const detail = useClienteDetail(id)')
    expect(at(plan, 'src/pages/cliente/view.tsx')).toContain('m.item.name')
    const test = at(plan, 'src/pages/cliente/index.test.tsx')
    expect(test).toContain("{ path: '/clientes/cliente-1' }")
    expect(test).toContain("findByText('Exemplo 1')")
  })

  it('o detalhe sem o valor do campo nas fixtures cai no id e avisa', () => {
    const project = fixtureProject()
    withQuery(project.root, { fields: '  titulo: z.string(),\n', fixture: "{ id: 'cliente-1', titulo: titulos[0] }" })
    const { plan, warnings } = generatePage(project, { name: 'cliente', query: 'clientes', route: '/clientes/:id' })

    expect(at(plan, 'src/pages/cliente/view.tsx')).toContain('m.item.id')
    expect(at(plan, 'src/pages/cliente/index.test.tsx')).toContain("findByText('cliente-1')")
    expect(warnings[0]).toContain("não achei o valor de 'titulo'")
  })

  it('o detalhe recusa a query sem o hook de detalhe', () => {
    const project = fixtureProject()
    withQuery(project.root, { detail: false })

    expect(() => generatePage(project, { name: 'cliente', query: 'clientes', route: '/clientes/:id' })).toThrow(
      /use<Entidade>Detail/,
    )
  })

  it('recusa a rota que o App.tsx já tem e a que conflita, sem escrever nada', () => {
    const project = fixtureProject()

    expect(() => generatePage(project, { name: 'livro', route: '/blank' })).toThrow(/já tem uma rota '\/blank'/)
    expect(() => generatePage(project, { name: 'livro', route: '/blank/:id' })).not.toThrow()
  })
})

describe('parseRoutePath', () => {
  it('aceita a raiz, caminhos fixos e um parâmetro', () => {
    expect(parseRoutePath('/').param).toBeUndefined()
    expect(parseRoutePath('/a/b-c_d.e').param).toBeUndefined()
    const route = parseRoutePath('/livros/:livroId/capas')
    expect(route.param).toBe('livroId')
    expect(route.example('x')).toBe('/livros/x/capas')
  })

  it.each([
    ['livros', 'precisa começar com /'],
    ['/livros/', 'barra no fim'],
    ['/livros//x', 'barra no fim nem //'],
    ['', 'precisa começar com /'],
    ['/livros/:id?', 'modificador do wouter'],
    ['/livros/:id*', 'modificador do wouter'],
    ['/livros/*', 'só pode ter'],
    ['/livros/:', 'não é um parâmetro válido'],
    ['/livros/:1a', 'não é um parâmetro válido'],
    ['/livros/:class', 'não é um parâmetro válido'],
    ['/livros/ação', 'só pode ter'],
    ['/a/:x/b/:y', '2 parâmetros'],
  ])('recusa %j', (route, reason) => {
    expect(() => parseRoutePath(route)).toThrow(UsageError)
    expect(() => parseRoutePath(route)).toThrow(reason)
  })
})
