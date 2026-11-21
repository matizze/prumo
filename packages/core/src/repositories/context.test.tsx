import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MockTaskRepository } from '@/repositories'
import { createTestRepositories } from '@/test/render'
import { RepositoryProvider } from './provider'
import { useRepositories } from './use-repositories'

describe('RepositoryProvider', () => {
  it('hands the injected container to useRepositories', () => {
    const repositories = createTestRepositories()

    const { result } = renderHook(() => useRepositories(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <RepositoryProvider value={repositories}>{children}</RepositoryProvider>
      ),
    })

    expect(result.current).toBe(repositories)
  })

  it('creates the default container once per mount when no value is injected', () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'memory')

    const { result, rerender } = renderHook(() => useRepositories(), {
      wrapper: RepositoryProvider,
    })
    const first = result.current
    rerender()

    expect(first.tasks).toBeInstanceOf(MockTaskRepository)
    expect(result.current).toBe(first)
  })

  it('throws when useRepositories is used outside the provider', () => {
    // O React também registra o erro no console; aqui ele é esperado
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useRepositories())).toThrow(
      'useRepositories must be used within a RepositoryProvider',
    )
  })
})
