// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRepositoryContext } from './index.ts'

interface FakeContainer {
  tasks: { name: string }
}

const fakeContainer = (name: string): FakeContainer => ({ tasks: { name } })

afterEach(cleanup)

describe('createRepositoryContext', () => {
  it('entrega ao useRepositories o container injetado', () => {
    const { RepositoryProvider, useRepositories } = createRepositoryContext<FakeContainer>()
    const injected = fakeContainer('injetado')

    const { result } = renderHook(() => useRepositories(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <RepositoryProvider value={injected}>{children}</RepositoryProvider>
      ),
    })

    expect(result.current).toBe(injected)
  })

  it('cria o container padrão uma vez por montagem quando não há value', () => {
    const createDefault = vi.fn(() => fakeContainer('padrão'))
    const { RepositoryProvider, useRepositories } = createRepositoryContext(createDefault)

    const { result, rerender } = renderHook(() => useRepositories(), {
      wrapper: RepositoryProvider,
    })
    const first = result.current
    rerender()

    expect(first.tasks.name).toBe('padrão')
    expect(result.current).toBe(first)
    expect(createDefault).toHaveBeenCalledOnce()
  })

  it('não cria o container padrão quando há value', () => {
    const createDefault = vi.fn(() => fakeContainer('padrão'))
    const { RepositoryProvider, useRepositories } = createRepositoryContext(createDefault)
    const injected = fakeContainer('injetado')

    const { result } = renderHook(() => useRepositories(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <RepositoryProvider value={injected}>{children}</RepositoryProvider>
      ),
    })

    expect(result.current).toBe(injected)
    expect(createDefault).not.toHaveBeenCalled()
  })

  it('lança quando o useRepositories é usado fora do provedor', () => {
    const { useRepositories } = createRepositoryContext<FakeContainer>()
    // O React também registra o erro no console; aqui ele é esperado
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useRepositories())).toThrow(
      'useRepositories must be used within a RepositoryProvider',
    )
  })

  it('lança quando não há value nem container padrão', () => {
    const { RepositoryProvider, useRepositories } = createRepositoryContext<FakeContainer>()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useRepositories(), { wrapper: RepositoryProvider })).toThrow(
      'RepositoryProvider precisa de `value`',
    )
  })

  it('mantém contextos de produtos diferentes isolados', () => {
    const a = createRepositoryContext<FakeContainer>()
    const b = createRepositoryContext<FakeContainer>()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      renderHook(() => b.useRepositories(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <a.RepositoryProvider value={fakeContainer('a')}>{children}</a.RepositoryProvider>
        ),
      }),
    ).toThrow('useRepositories must be used within a RepositoryProvider')
  })
})
