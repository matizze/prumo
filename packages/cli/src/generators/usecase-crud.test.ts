import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { fixtureProject } from '../test/fixture-project.ts'
import { generateSchema } from './schema.ts'
import { generateCrudUseCases } from './usecase-crud.ts'

/** Um projeto de fixture, com o schema `livros` e o `errors.json` de cada idioma. */
function withLivros({ errors = true } = {}) {
  const project = fixtureProject()
  generateSchema(project, { name: 'livros', fields: 'titulo:string,autor?:string,ano:int' }).plan.commit()
  if (errors) {
    for (const language of ['pt-BR', 'en']) writeFileSync(path.join(project.messages, language, 'errors.json'), '{}\n')
  }
  return project
}

const text = (result: ReturnType<typeof generateCrudUseCases>, name: string) =>
  result.plan.createdSources().find((source) => source.getFilePath().endsWith(name))!.getFullText()

describe('generateCrudUseCases', () => {
  it('planeja os cinco use cases, a coleção e o registro, sem tocar o disco', () => {
    const result = generateCrudUseCases(withLivros(), { name: 'livros' })

    expect(result.useCases.map(({ key, access }) => `${key} ${access}`)).toEqual([
      'listLivros read',
      'getLivro read',
      'createLivro write',
      'updateLivro write',
      'removeLivro write',
    ])
    expect(result.useCases.map(({ endpoint }) => `${endpoint.method} ${endpoint.path}`)).toEqual([
      'GET /livros',
      'GET /livros/:id',
      'POST /livros',
      'PATCH /livros/:id',
      'DELETE /livros/:id',
    ])
    expect(result.plan.summary().created).toHaveLength(22)
    expect(result.plan.summary().modified).toEqual([
      'src/messages/en/errors.json',
      'src/messages/pt-BR/errors.json',
      'src/use-cases/index.ts',
    ])
    expect(result.warnings).toEqual([])
  })

  it('o Input e o Output de cada um seguem o schema', () => {
    const result = generateCrudUseCases(withLivros(), { name: 'livros' })

    const list = text(result, 'list-livros.types.ts')
    expect(list).toContain("import { livroSchema, type LivroListQuery } from '@/schemas'")
    expect(list).toContain("key: z.enum(['titulo', 'autor', 'ano', 'createdAt']),")
    expect(list).toContain('}) satisfies z.ZodType<LivroListQuery>\n\nexport type ListLivrosInput = LivroListQuery')
    expect(list).toContain('export const ListLivrosOutput = pageSchema(livroSchema)')
    expect(text(result, 'list-livros.usecase.ts')).toContain('const query = { ...rest, sort: sort && `${sort.key}:${sort.direction}` }')

    expect(text(result, 'get-livro.types.ts')).toContain('export const GetLivroInput = z.object({ id: z.string() })')
    expect(text(result, 'get-livro.usecase.ts')).toContain("throw new UIError('LIVRO_NOT_FOUND', error.message)")
    expect(text(result, 'create-livro.types.ts')).toContain('export const CreateLivroInput = livroInputSchema\n')
    expect(text(result, 'create-livro.usecase.ts')).not.toContain('NOT_FOUND')
    expect(text(result, 'update-livro.types.ts')).toContain('livroInputSchema.partial().extend({ id: z.string() })')
    expect(text(result, 'update-livro.usecase.ts')).toContain('const { id, ...body } = UpdateLivroInput.parse(input)')
    expect(text(result, 'remove-livro.types.ts')).toContain('export const RemoveLivroOutput = z.void()')
    expect(text(result, 'remove-livro.usecase.ts')).toContain('const path = ENDPOINT.path.replace(\':id\', encodeURIComponent(id))')
  })

  it('os mocks dividem a coleção, com as fixtures lidas do schema', () => {
    const result = generateCrudUseCases(withLivros(), { name: 'livros' })

    const collection = text(result, 'collection.mock.ts')
    expect(collection).toContain("export const MOCK_LIVROS: LivroSchema[] = [")
    expect(collection).toContain("titulo: 'Titulo 1',")
    expect(collection).toContain("searchFields: (item) => [item.titulo, item.autor ?? ''],")
    expect(collection).toContain("    autor: (item) => item.autor ?? '',\n")
    expect(text(result, 'update-livro.mock.ts')).toContain('livrosCollection.update(params.id, livroInputSchema.partial().parse(body))')
    expect(text(result, 'list-livros.mock.ts')).toContain('({ query }: Call) =>\n    livrosCollection.list(query),')
    expect(text(result, 'remove-livro.usecase.test.ts')).toContain("subject.removeLivro.execute({ id: 'livro-1' })")
  })

  it('o texto dos erros entra nos dois idiomas, e o que falta vira aviso', () => {
    const project = withLivros()
    const result = generateCrudUseCases(project, { name: 'livros' })
    result.plan.commit()
    expect(Object.keys(JSON.parse(readFileSync(path.join(project.messages, 'pt-BR', 'errors.json'), 'utf8')))).toEqual([
      'LIVRO_NOT_FOUND',
      'LIST_LIVROS_FAILED',
      'GET_LIVRO_FAILED',
      'CREATE_LIVRO_FAILED',
      'UPDATE_LIVRO_FAILED',
      'REMOVE_LIVRO_FAILED',
    ])
    const without = generateCrudUseCases(withLivros({ errors: false }), { name: 'livros' })
    expect(without.warnings[0]).toContain('o texto de LIVRO_NOT_FOUND e LIST_LIVROS_FAILED')
  })

  it('recusa o schema que falta, a entidade igual ao domínio e um dos cinco que já existe', () => {
    const project = withLivros()
    expect(() => generateCrudUseCases(project, { name: 'pedidos' })).toThrow('falta o schema pedidos')
    expect(() => generateCrudUseCases(project, { name: 'livros', entity: 'livros' })).toThrow(UsageError)
    generateCrudUseCases(project, { name: 'livros' }).plan.commit()
    expect(() => generateCrudUseCases(project, { name: 'livros' })).toThrow("o use case 'livros.list-livros' já existe")
    rmSync(path.join(project.root, 'src/use-cases/livros/remove-livro.usecase.ts'))
    expect(() => generateCrudUseCases(project, { name: 'livros' })).toThrow("o use case 'livros.list-livros' já existe")
  })
})
