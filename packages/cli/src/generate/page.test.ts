import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemod/test-support.ts'
import { UsageError } from '../errors.ts'
import { generatePage, parseRoutePath } from './page.ts'

/** Dá ao projeto o domínio `clientes`, como o `make:domain` o deixa (só o que a tela confere). */
function withDomain(root: string, hook = 'useClientesList') {
  mkdirSync(path.join(root, 'src/queries'), { recursive: true })
  writeFileSync(
    path.join(root, 'src/queries/clientes.ts'),
    `export function ${hook}() {\n  return null\n}\nexport function useCreateCliente() {\n  return null\n}\n`,
  )
  withShape(root, '  name: z.string(),\n', "{ id: 'cliente-1', name: 'Exemplo 1', createdAt: 'x' }")
}

/** O schema e as fixtures do domínio `clientes`: o que a tela lê para saber o que mostrar. */
function withShape(root: string, fields: string, fixture: string) {
  mkdirSync(path.join(root, 'src/schemas/entities'), { recursive: true })
  mkdirSync(path.join(root, 'src/repositories/clientes'), { recursive: true })
  writeFileSync(
    path.join(root, 'src/schemas/entities/cliente.ts'),
    `export const clienteSchema = z.object({\n  id: z.string(),\n${fields}  createdAt: z.string(),\n})\n`,
  )
  writeFileSync(
    path.join(root, 'src/repositories/clientes/fixtures.ts'),
    `export const MOCK_CLIENTES = [\n  ${fixture},\n]\n`,
  )
}

describe('generatePage', () => {
  it('sem domínio: lista os seis arquivos novos e as três costuras', () => {
    const { plan, names, route, domain } = generatePage(fixtureProject(), {
      name: 'pedidos-recentes',
    })

    expect(names.kebab).toBe('pedidos-recentes')
    expect(route).toBe('/pedidos-recentes')
    expect(domain).toBeUndefined()
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
  })

  it('com route, registra a rota dada e não a /<nome> (a tela inicial de um app novo)', () => {
    const project = fixtureProject()
    const { plan, route } = generatePage(project, { name: 'home', route: '/' })
    plan.commit()

    expect(route).toBe('/')
    const app = readFileSync(project.app, 'utf8')
    expect(app).toContain('<Route path="/">')
    expect(app).not.toContain('/home"')
  })

  it('não escreve nada: só o commit grava', () => {
    const project = fixtureProject()
    const before = readFileSync(project.app, 'utf8')

    generatePage(project, { name: 'clientes' })

    expect(readFileSync(project.app, 'utf8')).toBe(before)
  })

  it('o index liga o model à view, o model não tem JSX e a view só tem HTML', () => {
    const project = fixtureProject()
    const { plan } = generatePage(project, { name: 'clientes' })
    const at = (file: string) => plan.source(path.join(project.root, file)).getFullText()

    expect(at('src/pages/clientes/index.tsx')).toBe(`import { useClientesModel } from './model'
import { ClientesView } from './view'

export default function ClientesPage() {
  const model = useClientesModel()
  return <ClientesView {...model} />
}
`)
    expect(at('src/pages/clientes/model.ts')).toBe(`import { useTranslations } from '@/i18n'

export function useClientesModel() {
  const t = useTranslations('clientes')
  return { title: t('title') }
}

export type ClientesModel = ReturnType<typeof useClientesModel>
`)
    expect(at('src/pages/clientes/view.tsx')).toBe(`import type { ClientesModel } from './model'

export function ClientesView(m: ClientesModel) {
  return (
    <main>
      <h1>{m.title}</h1>
    </main>
  )
}
`)
    expect(at('src/pages/clientes/index.test.tsx')).toContain(
      "renderWithProviders(<ClientesPage />, { path: '/clientes' })",
    )
    expect(at('src/pages/clientes/index.test.tsx')).toContain("{ name: 'Clientes' }")
  })

  it('o nome com hífen vira o camel no namespace e o título com espaço', () => {
    const project = fixtureProject()
    const { plan } = generatePage(project, { name: 'pedidos-recentes' })
    const at = (file: string) => plan.source(path.join(project.root, file)).getFullText()

    expect(at('src/pages/pedidos-recentes/model.ts')).toContain(
      "useTranslations('pedidosRecentes')",
    )
    plan.commit()
    expect(
      readFileSync(path.join(project.root, 'src/messages/pt-BR/pedidos-recentes.json'), 'utf8'),
    ).toBe('{\n  "title": "Pedidos recentes"\n}\n')
    expect(at('src/messages/en/index.ts')).toContain(
      "import pedidosRecentes from './pedidos-recentes.json'",
    )
    expect(at('src/messages/en/index.ts')).toContain('  pedidosRecentes,\n')
  })

  it('registra a rota depois da última, com o import na ordem de @/pages', () => {
    const project = fixtureProject()
    const { plan } = generatePage(project, { name: 'clientes' })
    const app = plan.source(project.app).getFullText()

    expect(app).toContain(
      "import BlankPage from '@/pages/blank'\nimport ClientesPage from '@/pages/clientes'\nimport ProfilePage",
    )
    expect(app).toContain(`      <Route path="/clientes">
        <ClientesPage />
      </Route>
    </Switch>`)
  })

  it('com domínio: o model lê a lista, a view mostra o carregando, o erro e a lista, e há textos nos dois idiomas', () => {
    const project = fixtureProject()
    withDomain(project.root)
    const { plan, domain } = generatePage(project, { name: 'clientes', domain: 'clientes' })
    const at = (file: string) => plan.source(path.join(project.root, file)).getFullText()

    expect(domain?.kebab).toBe('clientes')
    expect(at('src/pages/clientes/model.ts')).toBe(`import { useTranslations } from '@/i18n'
import { useClientesList } from '@/queries/clientes'

export function useClientesModel() {
  const t = useTranslations('clientes')
  const list = useClientesList()
  return {
    title: t('title'),
    loadingText: t('loading'),
    failedText: t('failed'),
    items: list.data?.items ?? [],
    loading: list.isPending,
    failed: list.isError,
  }
}

export type ClientesModel = ReturnType<typeof useClientesModel>
`)
    expect(at('src/pages/clientes/view.tsx')).toContain('<li key={i.id}>{i.name}</li>')
    expect(at('src/pages/clientes/view.tsx')).toContain('m.loading ?')
    plan.commit()
    expect(readFileSync(path.join(project.root, 'src/messages/en/clientes.json'), 'utf8')).toBe(
      '{\n  "title": "Clientes",\n  "loading": "Loading…",\n  "failed": "Could not load the list."\n}\n',
    )
    expect(
      readFileSync(path.join(project.root, 'src/messages/pt-BR/clientes.json'), 'utf8'),
    ).toContain('"loading": "Carregando…"')
  })

  it('com domínio: mostra o primeiro campo de texto obrigatório do schema que existe, não o name', () => {
    const project = fixtureProject()
    withDomain(project.root)
    withShape(
      project.root,
      '  ano: z.number(),\n  apelido: z.string().optional(),\n  titulo: z.string(),\n  publicadoEm: z.iso.date(),\n',
      "{ id: 'cliente-1', ano: 10, titulo: 'Titulo 1', createdAt: 'x' }",
    )
    const { plan, warnings } = generatePage(project, { name: 'clientes', domain: 'clientes' })

    expect(plan.source(path.join(project.root, 'src/pages/clientes/view.tsx')).getFullText()).toContain(
      '<li key={i.id}>{i.titulo}</li>',
    )
    expect(warnings).toEqual([])
  })

  it('com domínio: sem campo de texto no schema, mostra o id e avisa', () => {
    const project = fixtureProject()
    withDomain(project.root)
    withShape(project.root, '  ano: z.number(),\n  publicadoEm: z.iso.date(),\n', "{ id: 'cliente-1' }")
    const { plan, warnings } = generatePage(project, { name: 'clientes', domain: 'clientes' })

    expect(plan.source(path.join(project.root, 'src/pages/clientes/view.tsx')).getFullText()).toContain(
      '<li key={i.id}>{i.id}</li>',
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('não tem campo de texto')
    expect(warnings[0]).toContain('mostra o id')
  })

  it('com domínio: se não acha o schema, mostra o id e avisa', () => {
    const project = fixtureProject()
    withDomain(project.root)
    rmSync(path.join(project.root, 'src/schemas/entities/cliente.ts'))
    const { warnings } = generatePage(project, { name: 'clientes', domain: 'clientes' })

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('não consegui ler o schema')
  })

  it('a tela pode ter outro nome que o do domínio', () => {
    const project = fixtureProject()
    withDomain(project.root)
    const { plan } = generatePage(project, { name: 'lista-de-clientes', domain: 'clientes' })

    const model = plan
      .source(path.join(project.root, 'src/pages/lista-de-clientes/model.ts'))
      .getFullText()
    expect(model).toContain('export function useListaDeClientesModel()')
    expect(model).toContain('useClientesList()')
  })

  it('recusa nome inválido, reservado e domínio inválido, com UsageError', () => {
    const project = fixtureProject()

    expect(() => generatePage(project, { name: 'Clientes' })).toThrow(UsageError)
    expect(() => generatePage(project, { name: 'clientes', domain: 'Meus_Clientes' })).toThrow(
      /o nome do domínio/,
    )
    expect(() => generatePage(project, { name: 'class' })).toThrow(UsageError)
  })

  it('recusa a tela que já existe', () => {
    const project = fixtureProject()
    mkdirSync(path.join(project.root, 'src/pages/clientes'), { recursive: true })

    expect(() => generatePage(project, { name: 'clientes' })).toThrow("a tela 'clientes' já existe")
  })

  it('recusa o domínio que não existe e o que não tem o hook de lista', () => {
    const project = fixtureProject()
    expect(() => generatePage(project, { name: 'clientes', domain: 'clientes' })).toThrow(
      "o domínio 'clientes' não existe: falta src/queries/clientes.ts (crie-o com prumo make:domain clientes)",
    )

    withDomain(project.root, 'useOutraCoisa')
    expect(() => generatePage(project, { name: 'clientes', domain: 'clientes' })).toThrow(
      'não tem o hook useClientesList',
    )
  })

  it('recusa o App.tsx sem rota livre para o caminho, sem escrever nada', () => {
    const project = fixtureProject()
    writeFileSync(
      project.app,
      readFileSync(project.app, 'utf8').replace('path="/blank"', 'path="/clientes"'),
    )

    expect(() => generatePage(project, { name: 'clientes' })).toThrow(UsageError)
  })

  describe('com --path (route)', () => {
    it('sem parâmetro: só troca a rota, e o teste continua no caminho dela', () => {
      const project = fixtureProject()
      const { plan, route } = generatePage(project, { name: 'clientes', route: '/gente/lista' })

      expect(route).toBe('/gente/lista')
      expect(plan.source(project.app).getFullText()).toContain('<Route path="/gente/lista">')
      expect(
        plan.source(path.join(project.root, 'src/pages/clientes/model.ts')).getFullText(),
      ).not.toContain('useParams')
    })

    it('com parâmetro: o model lê o useParams, a view o mostra e o teste renderiza dentro da <Route>', () => {
      const project = fixtureProject()
      const { plan } = generatePage(project, { name: 'livro', route: '/livros/:id' })
      const at = (file: string) => plan.source(path.join(project.root, file)).getFullText()

      expect(at('src/pages/livro/model.ts')).toBe(`import { useParams } from 'wouter'
import { useTranslations } from '@/i18n'

export function useLivroModel() {
  const t = useTranslations('livro')
  const { id } = useParams<{ id: string }>()
  return { title: t('title'), params: { id } }
}

export type LivroModel = ReturnType<typeof useLivroModel>
`)
      expect(at('src/pages/livro/view.tsx')).toContain('<p>{m.params.id}</p>')
      const test = at('src/pages/livro/index.test.tsx')
      expect(test).toContain('<Route path="/livros/:id">')
      expect(test).toContain("{ path: '/livros/exemplo' }")
      expect(test).toContain("screen.getByText('exemplo')")
      expect(at('src/App.tsx')).toContain('<Route path="/livros/:id">')
    })

    it('com --domain e parâmetro: é a tela de detalhe, que busca o registro pelo hook do domínio', () => {
      const project = fixtureProject()
      withDomain(project.root, 'useClientesList')
      writeFileSync(
        path.join(project.root, 'src/queries/clientes.ts'),
        'export function useClientesList() {\n  return null\n}\nexport function useClienteDetail(id: string) {\n  return id\n}\n',
      )
      const { plan } = generatePage(project, {
        name: 'cliente',
        domain: 'clientes',
        route: '/clientes/:id',
      })
      const at = (file: string) => plan.source(path.join(project.root, file)).getFullText()

      const model = at('src/pages/cliente/model.ts')
      expect(model).toContain("import { useClienteDetail } from '@/queries/clientes'")
      expect(model).toContain('const detail = useClienteDetail(id)')
      expect(at('src/pages/cliente/view.tsx')).toContain('m.item.name')
      const test = at('src/pages/cliente/index.test.tsx')
      expect(test).toContain("{ path: '/clientes/cliente-1' }")
      expect(test).toContain("findByText('Exemplo 1')")
      plan.commit()
      expect(
        readFileSync(path.join(project.root, 'src/messages/pt-BR/cliente.json'), 'utf8'),
      ).toContain('"loading"')
    })

    it('com --domain e parâmetro, a tela de detalhe mostra o campo de texto e o teste espera o valor da fixture', () => {
      const project = fixtureProject()
      withDomain(project.root)
      writeFileSync(
        path.join(project.root, 'src/queries/clientes.ts'),
        'export function useClientesList() {\n  return null\n}\nexport function useClienteDetail(id: string) {\n  return id\n}\n',
      )
      withShape(
        project.root,
        '  titulo: z.string(),\n',
        "{ id: 'cliente-1', titulo: 'Dom Casmurro', createdAt: 'x' }",
      )
      const { plan, warnings } = generatePage(project, {
        name: 'cliente',
        domain: 'clientes',
        route: '/clientes/:id',
      })
      const at = (file: string) => plan.source(path.join(project.root, file)).getFullText()

      expect(at('src/pages/cliente/view.tsx')).toContain('m.item.titulo')
      expect(at('src/pages/cliente/index.test.tsx')).toContain("findByText('Dom Casmurro')")
      expect(warnings).toEqual([])
    })

    it('com --domain e parâmetro, sem o valor do campo nas fixtures, cai no id e avisa', () => {
      const project = fixtureProject()
      withDomain(project.root)
      writeFileSync(
        path.join(project.root, 'src/queries/clientes.ts'),
        'export function useClientesList() {\n  return null\n}\nexport function useClienteDetail(id: string) {\n  return id\n}\n',
      )
      withShape(project.root, '  titulo: z.string(),\n', "{ id: 'cliente-1', titulo: titulos[0] }")
      const { plan, warnings } = generatePage(project, {
        name: 'cliente',
        domain: 'clientes',
        route: '/clientes/:id',
      })
      const at = (file: string) => plan.source(path.join(project.root, file)).getFullText()

      expect(at('src/pages/cliente/view.tsx')).toContain('m.item.id')
      expect(at('src/pages/cliente/index.test.tsx')).toContain("findByText('cliente-1')")
      expect(warnings[0]).toContain("não achei o valor de 'titulo'")
    })

    it('com --domain e parâmetro, recusa o domínio sem o hook de detalhe', () => {
      const project = fixtureProject()
      withDomain(project.root)

      expect(() =>
        generatePage(project, { name: 'cliente', domain: 'clientes', route: '/clientes/:id' }),
      ).toThrow('não tem o hook use<Entidade>Detail')
    })

    it('recusa a rota que o App.tsx já tem', () => {
      const project = fixtureProject()

      expect(() => generatePage(project, { name: 'livro', route: '/blank' })).toThrow(
        "já tem uma rota '/blank'",
      )
      expect(() => generatePage(project, { name: 'livro', route: '/blank/:id' })).not.toThrow()
    })
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
