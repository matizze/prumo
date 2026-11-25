import { rmSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { fixtureProject } from '../test/fixture-project.ts'
import { generateSchema } from './schema.ts'
import { generateCrudUseCases } from './usecase-crud.ts'

/** Um projeto de fixture, com o schema `livros`. */
function withLivros() {
  const project = fixtureProject()
  generateSchema(project, { name: 'livros', fields: 'titulo:string,autor?:string,ano:int' }).plan.commit()
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
    expect(result.plan.summary().modified).toEqual(['src/use-cases/index.ts'])
    expect(result.warnings).toEqual([])
  })

  it('o Request e o Response de cada um seguem o schema', () => {
    const result = generateCrudUseCases(withLivros(), { name: 'livros' })

    const list = text(result, 'types/list-livros.ts')
    expect(list).toContain("import { livroSchema, type LivroListQuery } from '@/schemas'")
    expect(list).toContain("key: z.enum(['titulo', 'autor', 'ano', 'createdAt']),")
    expect(list).toContain('}) satisfies z.ZodType<LivroListQuery>\n\nexport type ListLivrosRequest = LivroListQuery')
    expect(list).toContain('export const ListLivrosResponse = pageSchema(livroSchema)')
    expect(text(result, 'services/list-livros.usecase.ts')).toContain('const query = { ...rest, sort: sort && `${sort.key}:${sort.direction}` }')

    expect(text(result, 'types/get-livro.ts')).toContain('export const GetLivroRequest = z.object({ id: z.string() })')
    expect(text(result, 'services/get-livro.usecase.ts')).not.toContain('try')
    expect(text(result, 'types/create-livro.ts')).toContain('export const CreateLivroRequest = livroInputSchema\n')
    expect(text(result, 'types/update-livro.ts')).toContain('livroInputSchema.partial().extend({ id: z.string() })')
    expect(text(result, 'services/update-livro.usecase.ts')).toContain('const { id, ...body } = UpdateLivroRequest.parse(input)')
    expect(text(result, 'types/remove-livro.ts')).toContain('export const RemoveLivroResponse = z.void()')
    expect(text(result, 'services/remove-livro.usecase.ts')).toContain('const path = ENDPOINT.path.replace(\':id\', encodeURIComponent(id))')
  })

  it('os mocks dividem a coleção, com as fixtures lidas do schema', () => {
    const result = generateCrudUseCases(withLivros(), { name: 'livros' })

    const collection = text(result, 'mocks/collection.ts')
    expect(collection).toContain("export const MOCK_LIVROS: LivroSchema[] = [")
    expect(collection).toContain("titulo: 'Titulo 1',")
    expect(collection).toContain("searchFields: (item) => [item.titulo, item.autor ?? ''],")
    expect(collection).toContain("    autor: (item) => item.autor ?? '',\n")
    expect(text(result, 'mocks/update-livro.ts')).toContain('livrosCollection.update(params.id, livroInputSchema.partial().parse(body))')
    expect(text(result, 'mocks/list-livros.ts')).toContain('export const listLivrosRoutes = mockRoute(ENDPOINT, ({ query }) =>\n  livrosCollection.list(query),\n)')
    expect(text(result, 'services/remove-livro.usecase.test.ts')).toContain("subject.removeLivro.execute({ id: 'livro-1' })")
  })

  it('recusa o schema que falta, a entidade igual ao domínio e um dos cinco que já existe', () => {
    const project = withLivros()
    expect(() => generateCrudUseCases(project, { name: 'pedidos' })).toThrow('falta o schema pedidos')
    expect(() => generateCrudUseCases(project, { name: 'livros', entity: 'livros' })).toThrow(UsageError)
    generateCrudUseCases(project, { name: 'livros' }).plan.commit()
    expect(() => generateCrudUseCases(project, { name: 'livros' })).toThrow("o use case 'livros.list-livros' já existe")
    rmSync(path.join(project.root, 'src/use-cases/livros/services/remove-livro.usecase.ts'))
    expect(() => generateCrudUseCases(project, { name: 'livros' })).toThrow("o use case 'livros.list-livros' já existe")
  })
})
