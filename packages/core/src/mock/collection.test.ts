import { describe, expect, it } from 'vitest'
import { HttpError } from '../http/index.ts'
import { createMockCollection } from './index.ts'

interface Livro {
  id: string
  title: string
  pages: number
  createdAt: string
}

const FIXTURES: Livro[] = [
  { id: 'livro-1', title: 'Dom Casmurro', pages: 250, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'livro-2', title: 'Ágata', pages: 90, createdAt: '2026-01-02T00:00:00.000Z' },
  { id: 'livro-3', title: 'Memórias', pages: 300, createdAt: '2026-01-03T00:00:00.000Z' },
]

const make = () =>
  createMockCollection(FIXTURES, {
    idPrefix: 'livro',
    searchFields: (livro) => [livro.title],
  })

const notFound = { status: 404 }

describe('createMockCollection', () => {
  it('lista as fixtures, com ids únicos', () => {
    const { items, total } = make().list()
    expect(total).toBe(3)
    expect(new Set(items.map((item) => item.id)).size).toBe(3)
  })

  it('busca sem diferenciar maiúsculas e acentos', () => {
    const livros = make()
    expect(livros.list({ search: 'agata' }).items.map((item) => item.id)).toEqual(['livro-2'])
    expect(livros.list({ search: 'nada disso' }).total).toBe(0)
  })

  it('ordena por <campo>:<direção>, com a propriedade do item por padrão', () => {
    const livros = make()
    expect(livros.list({ sort: 'pages:desc' }).items.map((item) => item.pages)).toEqual([
      300, 250, 90,
    ])
    expect(livros.list({ sort: 'title' }).items.map((item) => item.title)).toEqual([
      'Ágata',
      'Dom Casmurro',
      'Memórias',
    ])
  })

  it('ordena pelos sortFields quando eles existem, e recusa um campo fora deles', () => {
    const livros = createMockCollection(FIXTURES, {
      idPrefix: 'livro',
      searchFields: (livro) => [livro.title],
      sortFields: { size: (livro) => livro.pages },
    })
    expect(livros.list({ sort: 'size:asc' }).items.map((item) => item.pages)).toEqual([
      90, 250, 300,
    ])
    expect(() => livros.list({ sort: 'pages:asc' })).toThrow(HttpError)
  })

  it('recusa um sort malformado com 400', () => {
    expect(() => make().list({ sort: 'pages:up' })).toThrowError(
      expect.objectContaining({ status: 400 }),
    )
    expect(() => make().list({ sort: ':asc' })).toThrow(HttpError)
  })

  it('pagina com o total de antes da página, aceitando números ou textos', () => {
    const livros = make()
    const page = livros.list({ sort: 'pages:desc', page: 1, page_size: 2 })
    expect(page.total).toBe(3)
    expect(page.items.map((item) => item.pages)).toEqual([300, 250])
    expect(
      livros
        .list({ sort: 'pages:desc', page: '2', page_size: '2' })
        .items.map((item) => item.pages),
    ).toEqual([90])
    expect(() => livros.list({ page: 'x' })).toThrow(HttpError)
  })

  it('busca um registro e lança 404 para um id que não existe', () => {
    const livros = make()
    expect(livros.get('livro-1')).toEqual(FIXTURES[0])
    expect(() => livros.get('livro-x')).toThrowError(expect.objectContaining(notFound))
    expect(() => livros.get('livro-x')).toThrow(HttpError)
  })

  it('cria um registro com id (prefixo e sequência) e data, e ele aparece na lista', () => {
    const livros = make()
    const created = livros.create({ title: 'Novo', pages: 10 })
    expect(created).toMatchObject({ id: 'livro-4', title: 'Novo', pages: 10 })
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false)
    const { items, total } = livros.list()
    expect(total).toBe(4)
    expect(new Set(items.map((item) => item.id)).size).toBe(4)
    expect(livros.get(created.id)).toEqual(created)
    expect(livros.create({ title: 'Outro', pages: 1 }).id).toBe('livro-5')
  })

  it('não repete um id que já existe nas fixtures', () => {
    const livros = createMockCollection(
      [{ id: 'livro-2', title: 'A', pages: 1, createdAt: '2026-01-01T00:00:00.000Z' }],
      { idPrefix: 'livro', searchFields: (livro) => [livro.title] },
    )
    expect(livros.create({ title: 'B', pages: 1 }).id).toBe('livro-3')
  })

  it('edita um registro e lança 404 para um id que não existe', () => {
    const livros = make()
    const updated = livros.update('livro-1', { title: 'Editado' })
    expect(updated).toMatchObject({ id: 'livro-1', title: 'Editado' })
    expect(livros.get('livro-1').title).toBe('Editado')
    expect(() => livros.update('livro-x', { title: 'x' })).toThrowError(
      expect.objectContaining(notFound),
    )
  })

  it('edita só os campos enviados, e o campo indefinido não muda', () => {
    const livros = make()
    const before = livros.get('livro-1')
    expect(livros.update('livro-1', {})).toEqual(before)
    expect(livros.update('livro-1', { title: undefined })).toEqual(before)
    expect(livros.update('livro-1', { pages: 1 })).toEqual({ ...before, pages: 1 })
    // O que já foi devolvido não muda
    expect(before.pages).toBe(250)
  })

  it('remove um registro e lança 404 para um id que não existe', () => {
    const livros = make()
    livros.remove('livro-1')
    expect(livros.list().total).toBe(2)
    expect(() => livros.get('livro-1')).toThrow(HttpError)
    expect(() => livros.remove('livro-1')).toThrowError(expect.objectContaining(notFound))
  })

  it('parte de uma cópia das fixtures, que não mudam', () => {
    const livros = make()
    livros.update('livro-1', { title: 'Editado' })
    livros.remove('livro-2')
    livros.create({ title: 'Novo', pages: 1 })
    expect(FIXTURES).toHaveLength(3)
    expect(FIXTURES[0]?.title).toBe('Dom Casmurro')
  })

  it('reset volta ao estado de partida, inclusive a sequência dos ids', () => {
    const livros = make()
    livros.create({ title: 'Novo', pages: 1 })
    livros.remove('livro-1')
    livros.reset()
    expect(livros.list().items).toEqual(FIXTURES)
    expect(livros.create({ title: 'Novo', pages: 1 }).id).toBe('livro-4')
  })

  it('cada coleção tem o seu estado', () => {
    const a = make()
    const b = make()
    a.remove('livro-1')
    expect(b.list().total).toBe(3)
  })
})
