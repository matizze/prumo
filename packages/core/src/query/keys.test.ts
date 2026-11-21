import { describe, expect, expectTypeOf, it } from 'vitest'
import { createQueryKeys, type QueryKeys } from './index.ts'

type ProductListQuery = { search?: string; page?: number }

const catalogKeys = createQueryKeys('catalog', {
  lists: ['list'],
  list: (query: ProductListQuery = {}) => ['list', query] as const,
  detail: (id: string) => ['detail', id] as const,
  categories: ['categories'],
})

describe('createQueryKeys', () => {
  it('põe o domínio na frente de cada tupla fixa e expõe o prefixo em all', () => {
    expect(catalogKeys.all).toEqual(['catalog'])
    expect(catalogKeys.lists).toEqual(['catalog', 'list'])
    expect(catalogKeys.categories).toEqual(['catalog', 'categories'])
  })

  it('põe o domínio na frente do que a função devolve', () => {
    expect(catalogKeys.detail('42')).toEqual(['catalog', 'detail', '42'])
    expect(catalogKeys.list({ search: 'cadeira' })).toEqual([
      'catalog',
      'list',
      { search: 'cadeira' },
    ])
  })

  it('respeita o valor padrão dos parâmetros da função', () => {
    expect(catalogKeys.list()).toEqual(['catalog', 'list', {}])
  })

  it('repassa vários parâmetros na ordem e aceita retorno com tamanho variável', () => {
    const keys = createQueryKeys('mail', {
      emails: (folder: string, page = 1) => ['emails', folder, page] as const,
      lists: (query?: { q: string }) => (query ? (['list', query] as const) : (['list'] as const)),
    })

    expect(keys.emails('inbox')).toEqual(['mail', 'emails', 'inbox', 1])
    expect(keys.emails('sent', 3)).toEqual(['mail', 'emails', 'sent', 3])
    expect(keys.lists()).toEqual(['mail', 'list'])
    expect(keys.lists({ q: 'a' })).toEqual(['mail', 'list', { q: 'a' }])
  })

  it('gera chaves iguais a cada chamada, para o cache reconhecer a mesma consulta', () => {
    expect(catalogKeys.detail('1')).toEqual(catalogKeys.detail('1'))
    expect(catalogKeys.detail('1')).not.toEqual(catalogKeys.detail('2'))
  })

  it('gera as chaves de um domínio sem definições: só o prefixo', () => {
    const keys = createQueryKeys('empty')
    expect(keys).toEqual({ all: ['empty'] })
  })

  it('a chave de lista começa pela chave de prefixo, para a invalidação por prefixo funcionar', () => {
    const prefix = catalogKeys.lists
    expect(catalogKeys.list({ page: 2 }).slice(0, prefix.length)).toEqual(prefix)
    expect(prefix.slice(0, catalogKeys.all.length)).toEqual(catalogKeys.all)
  })

  it('não compartilha estado entre domínios', () => {
    const a = createQueryKeys('a', { x: ['x'] })
    const b = createQueryKeys('b', { x: ['x'] })
    expect(a.x).toEqual(['a', 'x'])
    expect(b.x).toEqual(['b', 'x'])
  })
})

describe('createQueryKeys: tipos', () => {
  it('preserva os literais do domínio e das tuplas fixas', () => {
    expectTypeOf(catalogKeys.all).toEqualTypeOf<readonly ['catalog']>()
    expectTypeOf(catalogKeys.lists).toEqualTypeOf<readonly ['catalog', 'list']>()
    expectTypeOf(catalogKeys.categories).toEqualTypeOf<readonly ['catalog', 'categories']>()
  })

  it('preserva os parâmetros e os literais do retorno das funções', () => {
    expectTypeOf(catalogKeys.detail).parameters.toEqualTypeOf<[id: string]>()
    expectTypeOf(catalogKeys.detail).returns.toEqualTypeOf<readonly ['catalog', 'detail', string]>()
    expectTypeOf(catalogKeys.list).parameters.toEqualTypeOf<[query?: ProductListQuery]>()
    expectTypeOf(catalogKeys.list).returns.toEqualTypeOf<
      readonly ['catalog', 'list', ProductListQuery]
    >()
  })

  it('o tipo QueryKeys descreve o objeto devolvido', () => {
    const keys = createQueryKeys('one', { a: ['a'] })
    expectTypeOf(keys).toEqualTypeOf<QueryKeys<'one', { readonly a: readonly ['a'] }>>()
  })

  it('recusa chamar a função com parâmetro do tipo errado', () => {
    // @ts-expect-error o id é string
    catalogKeys.detail(42)
    // @ts-expect-error falta o id
    catalogKeys.detail()
  })

  it('recusa chave que não existe', () => {
    // @ts-expect-error não há definição `missing`
    void catalogKeys.missing
  })

  it('recusa definição que não é tupla nem função que devolve tupla', () => {
    // @ts-expect-error uma string solta não é tupla
    createQueryKeys('bad', { value: 'x' })
    // @ts-expect-error a função precisa devolver uma tupla
    createQueryKeys('bad', { fn: () => 'x' })
  })

  it('recusa redefinir all', () => {
    // @ts-expect-error `all` é reservada
    createQueryKeys('bad', { all: ['other'] })
  })
})
