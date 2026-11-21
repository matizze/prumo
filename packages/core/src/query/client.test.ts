import { mutationOptions, queryOptions } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from './index.ts'

const options = { notify: vi.fn(), getErrorMessage: () => 'mensagem' }

describe('createQueryClient', () => {
  it('usa os padrões de cache do Prumo', () => {
    const { queries, mutations } = createQueryClient(options).getDefaultOptions()

    expect(queries).toEqual({
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    })
    expect(mutations).toBeUndefined()
  })

  it('defaultOptions sobrescreve só o que foi informado', () => {
    const { queries, mutations } = createQueryClient({
      ...options,
      defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: 2 } },
    }).getDefaultOptions()

    expect(queries).toMatchObject({ retry: false, staleTime: 0, gcTime: 5 * 60_000 })
    expect(queries?.refetchOnWindowFocus).toBe(false)
    expect(mutations).toEqual({ retry: 2 })
  })

  it('cada chamada devolve um client novo', () => {
    expect(createQueryClient(options)).not.toBe(createQueryClient(options))
  })
})

describe('tipo do meta (aumento de módulo do TanStack)', () => {
  it('aceita silent e errorMessage e recusa o que não existe', () => {
    const queryFn = () => Promise.resolve('ok')

    queryOptions({ queryKey: ['a'], queryFn, meta: { silent: true } })
    queryOptions({ queryKey: ['b'], queryFn, meta: { errorMessage: 'texto' } })
    // @ts-expect-error `silencioso` não existe no meta
    queryOptions({ queryKey: ['c'], queryFn, meta: { silencioso: true } })
    // @ts-expect-error `silent` é booleano
    queryOptions({ queryKey: ['d'], queryFn, meta: { silent: 'sim' } })

    const mutationFn = () => Promise.resolve()

    mutationOptions({ mutationFn, meta: { silent: true } })
    mutationOptions({ mutationFn, meta: { errorMessage: 'texto' } })
    // @ts-expect-error `silencioso` não existe no meta
    mutationOptions({ mutationFn, meta: { silencioso: true } })

    expect(true).toBe(true)
  })
})
