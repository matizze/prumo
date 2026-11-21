import { useMutation, useQuery } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { describe, expect, it, vi } from 'vitest'
import { UIError } from '@matizze/prumo-core/errors'
import { QueryProvider } from './query.provider'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const GENERIC_ERROR_MESSAGE = 'Algo deu errado. Tente novamente.'

const uiError = new UIError('TASK_NOT_FOUND', 'Tarefa não encontrada.')

function renderFailingMutation(error: unknown, meta?: { errorMessage?: string; silent?: boolean }) {
  const mutationFn = vi.fn(() => Promise.reject(error))
  const { result } = renderHook(() => useMutation({ mutationFn, meta }), {
    wrapper: QueryProvider,
  })
  act(() => result.current.mutate())
  return { result, mutationFn }
}

describe('QueryProvider global error handling', () => {
  describe('mutations', () => {
    it('shows the UIError message in a toast', async () => {
      const { result } = renderFailingMutation(uiError)

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(toast.error).toHaveBeenCalledExactlyOnceWith('Tarefa não encontrada.')
    })

    it('shows the generic message for errors that are not UIError', async () => {
      const { result } = renderFailingMutation(new TypeError('Failed to fetch'))

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(GENERIC_ERROR_MESSAGE)
    })

    it('uses meta.errorMessage in place of the error message', async () => {
      const { result } = renderFailingMutation(uiError, { errorMessage: 'Custom message' })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(toast.error).toHaveBeenCalledExactlyOnceWith('Custom message')
    })

    it('skips the toast when meta.silent is set', async () => {
      const { result, mutationFn } = renderFailingMutation(uiError, { silent: true })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(mutationFn).toHaveBeenCalledOnce()
      expect(toast.error).not.toHaveBeenCalled()
    })
  })

  describe('queries', () => {
    it('does not toast when the first load fails (the screen shows that error)', async () => {
      const queryFn = vi.fn(() => Promise.reject(uiError))

      const { result } = renderHook(
        // retry: false para não esperar o retry padrão do provider
        () => useQuery({ queryKey: ['first-load'], queryFn, retry: false }),
        { wrapper: QueryProvider },
      )

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(queryFn).toHaveBeenCalledOnce()
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('toasts when a background refetch fails and keeps the cached data', async () => {
      const queryFn = vi
        .fn<() => Promise<string>>()
        .mockResolvedValueOnce('cached')
        .mockRejectedValueOnce(uiError)

      const { result } = renderHook(
        () => useQuery({ queryKey: ['refetch'], queryFn, retry: false }),
        { wrapper: QueryProvider },
      )
      await waitFor(() => expect(result.current.data).toBe('cached'))
      expect(toast.error).not.toHaveBeenCalled()

      await act(() => result.current.refetch())

      expect(toast.error).toHaveBeenCalledExactlyOnceWith('Tarefa não encontrada.')
      expect(result.current.data).toBe('cached')
    })

    it('respects meta.silent on a failed refetch', async () => {
      const queryFn = vi
        .fn<() => Promise<string>>()
        .mockResolvedValueOnce('cached')
        .mockRejectedValueOnce(uiError)

      const { result } = renderHook(
        () => useQuery({ queryKey: ['silent'], queryFn, retry: false, meta: { silent: true } }),
        { wrapper: QueryProvider },
      )
      await waitFor(() => expect(result.current.data).toBe('cached'))

      await act(() => result.current.refetch())

      expect(queryFn).toHaveBeenCalledTimes(2)
      expect(toast.error).not.toHaveBeenCalled()
    })
  })
})
