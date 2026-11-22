import { describe, expect, expectTypeOf, it } from 'vitest'
import { createQueryKeys, type QueryKeys } from './index.ts'

type ProductListQuery = { search?: string; page?: number }

const productKeys = createQueryKeys('products', {
  lists: ['list'],
  list: (query: ProductListQuery = {}) => ['list', query] as const,
  detail: (id: string) => ['detail', id] as const,
  categories: ['categories'],
})

describe('createQueryKeys', () => {
  it('põe o domínio na frente de cada tupla fixa e expõe o prefixo em all', () => {
    expect(productKeys.all).toEqual(['products'])
    expect(productKeys.lists).toEqual(['products', 'list'])
    expect(productKeys.categories).toEqual(['products', 'categories'])
  })

  it('põe o domínio na frente do que a função devolve', () => {
    expect(productKeys.detail('42')).toEqual(['products', 'detail', '42'])
    expect(productKeys.list({ search: 'cadeira' })).toEqual([
      'products',
      'list',
      { search: 'cadeira' },
    ])
  })

  it('respeita o valor padrão dos parâmetros da função', () => {
    expect(productKeys.list()).toEqual(['products', 'list', {}])
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
    expect(productKeys.detail('1')).toEqual(productKeys.detail('1'))
    expect(productKeys.detail('1')).not.toEqual(productKeys.detail('2'))
  })

  it('gera as chaves de um domínio sem definições: só o prefixo', () => {
    const keys = createQueryKeys('empty')
    expect(keys).toEqual({ all: ['empty'] })
  })

  it('a chave de lista começa pela chave de prefixo, para a invalidação por prefixo funcionar', () => {
    const prefix = productKeys.lists
    expect(productKeys.list({ page: 2 }).slice(0, prefix.length)).toEqual(prefix)
    expect(prefix.slice(0, productKeys.all.length)).toEqual(productKeys.all)
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
    expectTypeOf(productKeys.all).toEqualTypeOf<readonly ['products']>()
    expectTypeOf(productKeys.lists).toEqualTypeOf<readonly ['products', 'list']>()
    expectTypeOf(productKeys.categories).toEqualTypeOf<readonly ['products', 'categories']>()
  })

  it('preserva os parâmetros e os literais do retorno das funções', () => {
    expectTypeOf(productKeys.detail).parameters.toEqualTypeOf<[id: string]>()
    expectTypeOf(productKeys.detail).returns.toEqualTypeOf<
      readonly ['products', 'detail', string]
    >()
    expectTypeOf(productKeys.list).parameters.toEqualTypeOf<[query?: ProductListQuery]>()
    expectTypeOf(productKeys.list).returns.toEqualTypeOf<
      readonly ['products', 'list', ProductListQuery]
    >()
  })

  it('o tipo QueryKeys descreve o objeto devolvido', () => {
    const keys = createQueryKeys('one', { a: ['a'] })
    expectTypeOf(keys).toEqualTypeOf<QueryKeys<'one', { readonly a: readonly ['a'] }>>()
  })

  it('recusa chamar a função com parâmetro do tipo errado', () => {
    // @ts-expect-error o id é string
    productKeys.detail(42)
    // @ts-expect-error falta o id
    productKeys.detail()
  })

  it('recusa chave que não existe', () => {
    // @ts-expect-error não há definição `missing`
    void productKeys.missing
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
