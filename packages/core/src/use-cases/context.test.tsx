// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUseCasesContext } from './index.ts'

interface FakeContainer {
  signIn: { name: string }
}

const fakeContainer = (name: string): FakeContainer => ({ signIn: { name } })

afterEach(cleanup)

describe('createUseCasesContext', () => {
  it('entrega ao useUseCases o container injetado', () => {
    const { UseCasesProvider, useUseCases } = createUseCasesContext<FakeContainer>()
    const injected = fakeContainer('injetado')

    const { result } = renderHook(() => useUseCases(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <UseCasesProvider value={injected}>{children}</UseCasesProvider>
      ),
    })

    expect(result.current).toBe(injected)
  })

  it('cria o container padrão uma vez por montagem quando não há value', () => {
    const createDefault = vi.fn(() => fakeContainer('padrão'))
    const { UseCasesProvider, useUseCases } = createUseCasesContext(createDefault)

    const { result, rerender } = renderHook(() => useUseCases(), {
      wrapper: UseCasesProvider,
    })
    const first = result.current
    rerender()

    expect(first.signIn.name).toBe('padrão')
    expect(result.current).toBe(first)
    expect(createDefault).toHaveBeenCalledOnce()
  })

  it('não cria o container padrão quando há value', () => {
    const createDefault = vi.fn(() => fakeContainer('padrão'))
    const { UseCasesProvider, useUseCases } = createUseCasesContext(createDefault)
    const injected = fakeContainer('injetado')

    const { result } = renderHook(() => useUseCases(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <UseCasesProvider value={injected}>{children}</UseCasesProvider>
      ),
    })

    expect(result.current).toBe(injected)
    expect(createDefault).not.toHaveBeenCalled()
  })

  it('lança quando o useUseCases é usado fora do provedor', () => {
    const { useUseCases } = createUseCasesContext<FakeContainer>()
    // O React também registra o erro no console; aqui ele é esperado
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useUseCases())).toThrow(
      'useUseCases must be used within a UseCasesProvider',
    )
  })

  it('lança quando não há value nem container padrão', () => {
    const { UseCasesProvider, useUseCases } = createUseCasesContext<FakeContainer>()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useUseCases(), { wrapper: UseCasesProvider })).toThrow(
      'UseCasesProvider precisa de `value`',
    )
  })

  it('mantém contextos de produtos diferentes isolados', () => {
    const a = createUseCasesContext<FakeContainer>()
    const b = createUseCasesContext<FakeContainer>()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      renderHook(() => b.useUseCases(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <a.UseCasesProvider value={fakeContainer('a')}>{children}</a.UseCasesProvider>
        ),
      }),
    ).toThrow('useUseCases must be used within a UseCasesProvider')
  })
})
