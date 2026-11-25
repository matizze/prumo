import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../test/fixture-project.ts'
import { UsageError } from '../errors.ts'
import { generatePage, parseRoutePath } from './page.ts'

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

describe('generatePage com tela em subpasta', () => {
  it.each(['auth.login', 'auth/login'])(
    '%s cria a pasta auth/login, a rota /auth/login e as mensagens auth-login',
    (name) => {
      const project = fixtureProject()
      const { plan, names, route } = generatePage(project, { name })

      expect(names.pascal).toBe('AuthLogin')
      expect(route).toBe('/auth/login')
      expect(plan.summary()).toEqual({
        created: [
          'src/messages/en/auth-login.json',
          'src/messages/pt-BR/auth-login.json',
          'src/pages/auth/login/index.test.tsx',
          'src/pages/auth/login/index.tsx',
          'src/pages/auth/login/model.ts',
          'src/pages/auth/login/view.tsx',
        ],
        modified: ['src/App.tsx', 'src/messages/en/index.ts', 'src/messages/pt-BR/index.ts'],
      })
      plan.commit()

      const app = readFileSync(project.app, 'utf8')
      expect(app).toContain("import AuthLoginPage from '@/pages/auth/login'")
      expect(app).toContain('<Route path="/auth/login">')
      const dir = path.join(project.pages, 'auth/login')
      expect(readFileSync(path.join(dir, 'model.ts'), 'utf8')).toContain(
        "useTranslations('authLogin')",
      )
      expect(readFileSync(path.join(dir, 'index.test.tsx'), 'utf8')).toContain(
        "path: '/auth/login'",
      )
      expect(readFileSync(path.join(project.messages, 'en/index.ts'), 'utf8')).toContain(
        "import authLogin from './auth-login.json'",
      )
      expect(
        JSON.parse(readFileSync(path.join(project.messages, 'pt-BR/auth-login.json'), 'utf8')),
      ).toEqual({ title: 'Auth login' })
    },
  )

  it('o --path vale em subpasta, e o parâmetro também', () => {
    const project = fixtureProject()
    const { plan, route } = generatePage(project, { name: 'admin/clientes', route: '/painel/clientes/:id' })
    expect(route).toBe('/painel/clientes/:id')
    plan.commit()
    const model = readFileSync(path.join(project.pages, 'admin/clientes/model.ts'), 'utf8')
    expect(model).toContain('useParams')
    expect(model).toContain("useTranslations('adminClientes')")
  })

  it('recusa uma tela dentro de outra tela', () => {
    const project = fixtureProject()
    generatePage(project, { name: 'auth' }).plan.commit()
    expect(() => generatePage(project, { name: 'auth/login' })).toThrow(
      /dentro da tela 'auth'.*uma tela não contém outra/,
    )
    // O components/ de uma tela também não vira tela
    expect(() => generatePage(project, { name: 'auth.components' })).toThrow(/dentro da tela 'auth'/)
  })

  it('recusa virar tela a pasta que já agrupa telas', () => {
    const project = fixtureProject()
    generatePage(project, { name: 'auth/login' }).plan.commit()
    expect(() => generatePage(project, { name: 'auth' })).toThrow(
      /'auth' já agrupa telas \(como 'auth\/login'\)/,
    )
  })

  it('recusa as duas formas que dão o mesmo componente e as mesmas mensagens', () => {
    const project = fixtureProject()
    generatePage(project, { name: 'auth/login' }).plan.commit()
    expect(() => generatePage(project, { name: 'auth-login' })).toThrow(
      /conflita com a tela 'auth\/login'.*auth-login\.json e AuthLoginPage/,
    )
    const other = fixtureProject()
    generatePage(other, { name: 'auth-login' }).plan.commit()
    expect(() => generatePage(other, { name: 'auth.login' })).toThrow(
      /conflita com a tela 'auth-login'/,
    )
  })

  it('a tela que existe é recusada com o caminho', () => {
    const project = fixtureProject()
    generatePage(project, { name: 'auth/login' }).plan.commit()
    expect(() => generatePage(project, { name: 'auth.login' })).toThrow(/tela 'auth\/login' já existe/)
  })

  it('a pasta que existe sem index.tsx volta a dizer só que a tela já existe', () => {
    const project = fixtureProject()
    mkdirSync(path.join(project.pages, 'vazia'), { recursive: true })
    expect(() => generatePage(project, { name: 'vazia' })).toThrow(/tela 'vazia' já existe/)
  })

  it('o segmento pode ser palavra reservada: auth.new passa', () => {
    expect(generatePage(fixtureProject(), { name: 'auth.new' }).names.pascal).toBe('AuthNew')
  })

  it('recusa o segmento inválido sem planejar nada', () => {
    const project = fixtureProject()
    expect(() => generatePage(project, { name: 'auth..login' })).toThrow(/segmento vazio/)
    expect(() => generatePage(project, { name: 'Auth.login' })).toThrow(/'Auth' é inválido/)
    expect(existsSync(path.join(project.pages, 'auth'))).toBe(false)
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

  it('recusa a rota que o App.tsx já tem; um caminho vizinho passa', () => {
    const project = fixtureProject()

    expect(() => generatePage(project, { name: 'livro', route: '/blank' })).toThrow(/já tem uma rota '\/blank'/)
    expect(() => generatePage(project, { name: 'livro', route: '/blank/:id' })).not.toThrow()
  })

  it('recusa a rota que conflita com uma de parâmetro do App.tsx, sem escrever nada', () => {
    const project = fixtureProject()
    const original = readFileSync(project.app, 'utf8')
    writeFileSync(project.app, original.replace('path="/blank"', 'path="/clientes/:id"'))
    const before = readFileSync(project.app, 'utf8')

    expect(() => generatePage(project, { name: 'novo', route: '/clientes/novo' })).toThrow(
      /a rota '\/clientes\/novo' conflita com a rota '\/clientes\/:id'/,
    )
    expect(readFileSync(project.app, 'utf8')).toBe(before)
    expect(existsSync(path.join(project.root, 'src/pages/novo'))).toBe(false)
  })

  it.each(['t', 'detail', 'useParams', 'useTranslations'])('recusa o parâmetro :%s, que o model gerado já declara', (name) => {
    expect(() => parseRoutePath(`/x/:${name}`)).toThrow(/variável do model gerado/)
  })

})

describe('parseRoutePath', () => {
  it('aceita a raiz, caminhos fixos e um parâmetro', () => {
    expect(parseRoutePath('/').param).toBeUndefined()
    expect(parseRoutePath('/a/b-c_d.e').param).toBeUndefined()
    const route = parseRoutePath('/livros/:livroId/capas')
    expect(route.param).toBe('livroId')
    expect(route.example('x')).toBe('/livros/x/capas')
    // `async` é palavra contextual: serve de identificador
    expect(parseRoutePath('/livros/:async').param).toBe('async')
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
    ['/livros/:eval', 'não é um parâmetro válido'],
    ['/livros/:arguments', 'não é um parâmetro válido'],
    ['/livros/ação', 'só pode ter'],
    ['/a/:x/b/:y', '2 parâmetros'],
  ])('recusa %j', (route, reason) => {
    expect(() => parseRoutePath(route)).toThrow(UsageError)
    expect(() => parseRoutePath(route)).toThrow(reason)
  })
})
