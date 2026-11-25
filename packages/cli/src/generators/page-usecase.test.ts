import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { fixtureProject } from '../test/fixture-project.ts'
import { generatePage, type PageRequest } from './page.ts'
import { generateSchema } from './schema.ts'
import { generateCrudUseCases } from './usecase-crud.ts'
import { generateUseCase, type UseCaseRequest } from './usecase.ts'

type Fixture = ReturnType<typeof fixtureProject>

/** Um projeto de fixture com o schema `livros`, o CRUD dele. */
function withLivros(fields = 'titulo:string,ano:int,situacao:enum(lido|lendo),nota?:int,lido:boolean') {
  const project = fixtureProject()
  generateSchema(project, { name: 'livros', fields }).plan.commit()
  generateCrudUseCases(project, { name: 'livros' }).plan.commit()
  return project
}

const useCase = (project: Fixture, request: UseCaseRequest) => generateUseCase(project, request).plan.commit()

const page = (project: Fixture, request: PageRequest) => generatePage(project, request)

const created = (result: ReturnType<typeof generatePage>, file: string) =>
  result.plan.createdSources().find((source) => source.getFilePath().endsWith(file))!.getFullText()

describe('generatePage --usecase: lista', () => {
  it('a leitura que devolve uma Page dá a lista com carregando, erro e vazio', () => {
    const project = withLivros()
    const result = page(project, { name: 'livros', useCase: 'livros.list-livros' })

    expect(result.useCase?.kind).toBe('list')
    expect(result.plan.summary().created).toEqual([
      'src/messages/en/livros.json',
      'src/messages/pt-BR/livros.json',
      'src/pages/livros/index.test.tsx',
      'src/pages/livros/index.tsx',
      'src/pages/livros/model.ts',
      'src/pages/livros/view.tsx',
    ])
    expect(created(result, 'pages/livros/model.ts')).toBe(`import { useQuery } from '@tanstack/react-query'
import { useTranslations } from '@/i18n'
import { useUseCases } from '@/providers/use-cases'
import { listLivrosKey } from '@/use-cases/livros/types/list-livros'

export function useLivrosModel() {
  const t = useTranslations('livros')
  const { listLivros } = useUseCases()
  const input = {}
  const list = useQuery({ queryKey: listLivrosKey(input), queryFn: () => listLivros.execute(input) })
  return {
    title: t('title'),
    loadingText: t('loading'),
    failedText: t('failed'),
    emptyText: t('empty'),
    items: list.data?.items ?? [],
    loading: list.isPending,
    failed: list.isError,
  }
}

export type LivrosModel = ReturnType<typeof useLivrosModel>
`)
    expect(created(result, 'pages/livros/view.tsx')).toContain('m.items.length === 0 ? (')
    expect(created(result, 'pages/livros/view.tsx')).toContain('<li key={i.id}>{i.titulo}</li>')
  })

  it('a leitura que devolve um array usa a lista direto', () => {
    const project = withLivros()
    useCase(project, { name: 'clientes.get-clientes', output: 'livro[]' })
    const result = page(project, { name: 'clientes', useCase: 'clientes.get-clientes' })
    expect(created(result, 'pages/clientes/model.ts')).toContain('items: list.data ?? [],')
  })

  it('o texto da tela vai para os dois idiomas', () => {
    const project = withLivros()
    const result = page(project, { name: 'livros', useCase: 'livros.list-livros' })
    result.plan.commit()
    const read = (language: string) => JSON.parse(readFileSync(path.join(project.messages, language, 'livros.json'), 'utf8'))
    expect(read('pt-BR')).toEqual({
      title: 'Livros',
      loading: 'Carregando…',
      failed: 'Não foi possível carregar a lista.',
      empty: 'Nada por aqui ainda.',
    })
    expect(read('en')).toMatchObject({ empty: 'Nothing here yet.' })
  })

  it('recusa a leitura que não devolve uma lista de entidade, e o Request com campo obrigatório', () => {
    const project = withLivros()
    useCase(project, { name: 'stats.get-stats' })
    expect(() => page(project, { name: 'stats', useCase: 'stats.get-stats' })).toThrow(/a tela de lista precisa que o Response de o use case 'stats.get-stats' seja uma lista/)
    useCase(project, { name: 'clientes.get-clientes', output: 'livro[]', input: 'loja:string' })
    expect(() => page(project, { name: 'clientes', useCase: 'clientes.get-clientes' })).toThrow(/pede loja no Request/)
  })
})

describe('generatePage --usecase: detalhe', () => {
  it('a leitura com :id e o --path com o mesmo parâmetro dão o detalhe', () => {
    const project = withLivros()
    const result = page(project, { name: 'livro', useCase: 'livros.get-livro', route: '/livros/:id' })

    expect(result.useCase?.kind).toBe('detail')
    const model = created(result, 'pages/livro/model.ts')
    expect(model).toContain('const { id } = useParams<{ id: string }>()')
    expect(model).toContain('const input = { id }')
    expect(model).toContain('queryKey: getLivroKey(input), queryFn: () => getLivro.execute(input)')
    expect(created(result, 'pages/livro/view.tsx')).toContain('<p>{m.item.titulo}</p>')
    // O teste abre a rota com o id do primeiro registro do mock e procura o texto dele
    expect(created(result, 'pages/livro/index.test.tsx')).toContain("{ path: '/livros/livro-1' }")
    expect(created(result, 'pages/livro/index.test.tsx')).toContain("findByText('Titulo 1')")
  })

  it('recusa o --path sem o parâmetro, com outro parâmetro, e o parâmetro num use case sem :id', () => {
    const project = withLivros()
    expect(() => page(project, { name: 'livro', useCase: 'livros.get-livro' })).toThrow(
      "lê um registro por ':id'",
    )
    expect(() => page(project, { name: 'livro', useCase: 'livros.get-livro', route: '/livros/:slug' })).toThrow(
      "o parâmetro ':slug' do --path não é um dos do endereço",
    )
    expect(() => page(project, { name: 'livros', useCase: 'livros.list-livros', route: '/livros/:id' })).toThrow(
      'não tem parâmetro: tire o',
    )
  })
})

describe('generatePage --usecase: formulário', () => {
  it('a escrita dá o formulário com os campos do Request, lidos do schema', () => {
    const project = withLivros()
    const result = page(project, { name: 'livro-novo', useCase: 'livros.create-livro' })

    expect(result.useCase?.kind).toBe('form')
    const model = created(result, 'pages/livro-novo/model.ts')
    expect(model).toContain(`function inputOf(form: FormData): CreateLivroRequest {
  return {
    titulo: String(form.get('titulo')),
    ano: Number(form.get('ano')),
    situacao: String(form.get('situacao')) as CreateLivroRequest['situacao'],
    nota: form.get('nota') ? Number(form.get('nota')) : undefined,
    lido: form.has('lido'),
  }
}`)
    expect(model).toContain("const { createLivro } = useUseCases()")
    expect(model).toContain("onSuccess: () => queryClient.invalidateQueries({ queryKey: ['livros'] })")
    expect(model).toContain('errorText: mutation.isError ? getErrorMessage(mutation.error) : null,')
    const view = created(result, 'pages/livro-novo/view.tsx')
    expect(view).toContain('<input id="titulo" name="titulo" type="text" required />')
    expect(view).toContain('<input id="nota" name="nota" type="number" />')
    expect(view).toContain('<input id="lido" name="lido" type="checkbox" />')
    expect(view).toContain('<button type="submit" disabled={m.submitting}>')
    expect(view).toContain('{m.succeeded && <p role="status">{m.successText}</p>}')
  })

  it('o number aceita decimais (step="any"), e o int fica com o padrão', () => {
    const project = withLivros('preco:number,paginas:int')
    const view = created(page(project, { name: 'livro-novo', useCase: 'livros.create-livro' }), 'pages/livro-novo/view.tsx')
    expect(view).toContain('<input id="preco" name="preco" type="number" step="any" required />')
    expect(view).toContain('<input id="paginas" name="paginas" type="number" required />')
    expect(view).not.toContain('step="1"')
  })

  it('depois de criar o formulário volta ao começo, e editar tira o aviso', () => {
    const project = withLivros()
    const result = page(project, { name: 'livro-novo', useCase: 'livros.create-livro' })
    const model = created(result, 'pages/livro-novo/model.ts')
    expect(model).toContain("const form = event.currentTarget\n      mutation.mutate(inputOf(new FormData(form)), { onSuccess: () => form.reset() })")
    expect(model).toContain('onChange: () => mutation.reset(),')
    expect(created(result, 'pages/livro-novo/view.tsx')).toContain('onChange={m.onChange}')
  })

  it('o detalhe mostra o texto do erro do use case (o 404)', () => {
    const project = withLivros()
    const result = page(project, { name: 'livro', useCase: 'livros.get-livro', route: '/livros/:id' })
    expect(created(result, 'pages/livro/model.ts')).toContain('errorText: detail.isError ? getErrorMessage(detail.error) : null,')
    expect(created(result, 'pages/livro/view.tsx')).toContain('{m.errorText ?? m.failedText}')
  })

  it('o update tem o id e os outros campos opcionais', () => {
    const project = withLivros()
    const result = page(project, { name: 'livro-editar', useCase: 'livros.update-livro' })
    const model = created(result, 'pages/livro-editar/model.ts')
    expect(model).toContain('titulo: form.get(\'titulo\') ? String(form.get(\'titulo\')) : undefined,')
    expect(model).toContain("id: String(form.get('id')),")
  })

  it('entra pela subpasta, com email e senha pelo tipo do campo', () => {
    const project = withLivros()
    useCase(project, { name: 'auth.sign-in', input: 'email:string,password:string', output: 'token:string' })
    const result = page(project, { name: 'auth.login', useCase: 'auth.sign-in' })

    expect(result.route).toBe('/auth/login')
    expect(created(result, 'pages/auth/login/model.ts')).toContain("const t = useTranslations('authLogin')")
    const view = created(result, 'pages/auth/login/view.tsx')
    expect(view).toContain('type="email"')
    expect(view).toContain('type="password"')
    result.plan.commit()
    const messages = JSON.parse(readFileSync(path.join(project.messages, 'pt-BR/auth-login.json'), 'utf8'))
    expect(messages.fields).toEqual({ email: 'Email', password: 'Password' })
  })

  it('lê o Request que a pessoa refinou à mão (z.email, z.string().min)', () => {
    const project = withLivros()
    useCase(project, { name: 'auth.sign-in', input: 'email:string,password:string' })
    const file = path.join(project.root, 'src/use-cases/auth/types/sign-in.ts')
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('email: z.string()', 'email: z.email()').replace('password: z.string()', 'password: z.string().min(8)'),
    )
    const result = page(project, { name: 'auth.login', useCase: 'auth.sign-in' })
    expect(created(result, 'pages/auth/login/model.ts')).toContain("password: String(form.get('password')),")
  })

  it('o Request vazio dá o formulário só com o botão', () => {
    const project = withLivros()
    useCase(project, { name: 'auth.sign-out' })
    const result = page(project, { name: 'sair', useCase: 'auth.sign-out' })
    expect(created(result, 'pages/sair/model.ts')).toContain('mutation.mutate({})')
    expect(created(result, 'pages/sair/model.ts')).not.toContain('inputOf')
    expect(created(result, 'pages/sair/model.ts')).toContain("types/sign-out'\n\nexport function")
  })

  it('recusa o --path com parâmetro e o campo que o leitor não reconhece', () => {
    const project = withLivros()
    expect(() => page(project, { name: 'livro', useCase: 'livros.update-livro', route: '/livros/:id' })).toThrow(
      "um formulário, que não lê parâmetro da rota: tire o ':id'",
    )
    useCase(project, { name: 'auth.sign-in', input: 'email:string' })
    const file = path.join(project.root, 'src/use-cases/auth/types/sign-in.ts')
    writeFileSync(file, readFileSync(file, 'utf8').replace('email: z.string()', 'email: z.array(z.string())'))
    expect(() => page(project, { name: 'login', useCase: 'auth.sign-in' })).toThrow(/campo 'email': não reconheço o tipo/)
  })
})

describe('generatePage --usecase: os usos errados', () => {
  it('recusa o use case que não existe', () => {
    const project = withLivros()
    expect(() => page(project, { name: 'x', useCase: 'livros.nada' })).toThrow(UsageError)
    expect(() => page(project, { name: 'x', useCase: 'livros.nada' })).toThrow("o use case 'livros.nada' não existe")
    expect(() => page(project, { name: 'x', useCase: 'livros' })).toThrow(/precisa ter o domínio e a ação/)
  })
})
