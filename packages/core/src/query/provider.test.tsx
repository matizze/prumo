// @vitest-environment jsdom
import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient, QueryProvider } from './index.ts'

afterEach(cleanup)

class FixtureError extends Error {}

const GENERIC_MESSAGE = 'mensagem genérica'

/** Resolvedor de mensagem de fixture: o teste não depende dos textos de um produto. */
function getErrorMessage(error: unknown) {
  return error instanceof FixtureError ? `traduzido: ${error.message}` : GENERIC_MESSAGE
}

const fixtureError = new FixtureError('não encontrado')

function setup(createClient?: () => QueryClient) {
  const notify = vi.fn<(message: string) => void>()
  const create =
    createClient ??
    (() =>
      createQueryClient({
        notify,
        getErrorMessage,
        // retry: false para não esperar o retry padrão
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }))
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryProvider createClient={create}>{children}</QueryProvider>
  }
  return { notify, wrapper }
}

function renderFailingMutation(error: unknown, meta?: { errorMessage?: string; silent?: boolean }) {
  const { notify, wrapper } = setup()
  const mutationFn = vi.fn(() => Promise.reject(error))
  const { result } = renderHook(() => useMutation({ mutationFn, meta }), { wrapper })
  act(() => result.current.mutate())
  return { result, mutationFn, notify }
}

describe('QueryProvider', () => {
  it('cria o client uma vez por montagem, mesmo com re-renderizações', () => {
    const create = vi.fn(() => createQueryClient({ notify: vi.fn(), getErrorMessage }))
    const { wrapper } = setup(create)
    const { rerender } = renderHook(() => null, { wrapper })

    rerender()
    rerender()

    expect(create).toHaveBeenCalledOnce()
  })
})

describe('tratamento global de erro', () => {
  describe('mutations', () => {
    it('notifica a mensagem traduzida do erro', async () => {
      const { result, notify } = renderFailingMutation(fixtureError)

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(notify).toHaveBeenCalledExactlyOnceWith('traduzido: não encontrado')
    })

    it('notifica a mensagem genérica quando o resolvedor não reconhece o erro', async () => {
      const { result, notify } = renderFailingMutation(new TypeError('Failed to fetch'))

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(notify).toHaveBeenCalledExactlyOnceWith(GENERIC_MESSAGE)
    })

    it('usa meta.errorMessage no lugar da mensagem do erro', async () => {
      const { result, notify } = renderFailingMutation(fixtureError, {
        errorMessage: 'Texto da tela',
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(notify).toHaveBeenCalledExactlyOnceWith('Texto da tela')
    })

    it('não notifica com meta.silent', async () => {
      const { result, mutationFn, notify } = renderFailingMutation(fixtureError, { silent: true })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(mutationFn).toHaveBeenCalledOnce()
      expect(notify).not.toHaveBeenCalled()
    })
  })

  describe('queries', () => {
    it('não notifica quando o primeiro carregamento falha (a tela mostra esse erro)', async () => {
      const { notify, wrapper } = setup()
      const queryFn = vi.fn(() => Promise.reject(fixtureError))

      const { result } = renderHook(() => useQuery({ queryKey: ['first-load'], queryFn }), {
        wrapper,
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(queryFn).toHaveBeenCalledOnce()
      expect(notify).not.toHaveBeenCalled()
    })

    it('notifica quando o refetch em segundo plano falha e mantém os dados em cache', async () => {
      const { notify, wrapper } = setup()
      const queryFn = vi
        .fn<() => Promise<string>>()
        .mockResolvedValueOnce('cached')
        .mockRejectedValueOnce(fixtureError)

      const { result } = renderHook(() => useQuery({ queryKey: ['refetch'], queryFn }), {
        wrapper,
      })
      await waitFor(() => expect(result.current.data).toBe('cached'))
      expect(notify).not.toHaveBeenCalled()

      await act(() => result.current.refetch())

      expect(notify).toHaveBeenCalledExactlyOnceWith('traduzido: não encontrado')
      expect(result.current.data).toBe('cached')
    })

    it('respeita meta.silent no refetch que falha', async () => {
      const { notify, wrapper } = setup()
      const queryFn = vi
        .fn<() => Promise<string>>()
        .mockResolvedValueOnce('cached')
        .mockRejectedValueOnce(fixtureError)

      const { result } = renderHook(
        () => useQuery({ queryKey: ['silent'], queryFn, meta: { silent: true } }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.data).toBe('cached'))

      await act(() => result.current.refetch())

      expect(queryFn).toHaveBeenCalledTimes(2)
      expect(notify).not.toHaveBeenCalled()
    })

    it('usa meta.errorMessage no refetch que falha', async () => {
      const { notify, wrapper } = setup()
      const queryFn = vi
        .fn<() => Promise<string>>()
        .mockResolvedValueOnce('cached')
        .mockRejectedValueOnce(fixtureError)

      const { result } = renderHook(
        () => useQuery({ queryKey: ['message'], queryFn, meta: { errorMessage: 'Texto da tela' } }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.data).toBe('cached'))

      await act(() => result.current.refetch())

      expect(notify).toHaveBeenCalledExactlyOnceWith('Texto da tela')
    })
  })
})
