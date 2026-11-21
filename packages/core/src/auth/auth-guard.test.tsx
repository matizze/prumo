// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthGuard, type AuthGuardProps } from './index.ts'

afterEach(cleanup)

function renderGuard(props: Partial<AuthGuardProps> = {}, path = '/tasks') {
  const { hook, history } = memoryLocation({ path, record: true })
  const wrapper = ({ children }: { children: ReactNode }) => <Router hook={hook}>{children}</Router>
  render(
    <AuthGuard isAuthenticated={false} isLoading={false} {...props}>
      <p>conteúdo protegido</p>
    </AuthGuard>,
    { wrapper },
  )
  return { history }
}

describe('AuthGuard', () => {
  it('mostra os filhos e não navega quando há sessão', () => {
    const { history } = renderGuard({ isAuthenticated: true })

    expect(screen.getByText('conteúdo protegido')).toBeTruthy()
    expect(history).toEqual(['/tasks'])
  })

  it('redireciona para /login, trocando a entrada do histórico, quando não há sessão', () => {
    const { history } = renderGuard()

    expect(screen.queryByText('conteúdo protegido')).toBeNull()
    expect(history).toEqual(['/login'])
  })

  it('usa a rota de redirecionamento informada', () => {
    const { history } = renderGuard({ redirectTo: '/entrar' })

    expect(history).toEqual(['/entrar'])
  })

  it('enquanto carrega, mostra o fallback e não redireciona', () => {
    const { history } = renderGuard({ isLoading: true, fallback: <p>carregando</p> })

    expect(screen.getByText('carregando')).toBeTruthy()
    expect(screen.queryByText('conteúdo protegido')).toBeNull()
    expect(history).toEqual(['/tasks'])
  })

  it('enquanto carrega, sem fallback, não mostra nada', () => {
    const { history } = renderGuard({ isLoading: true })

    expect(screen.queryByText('conteúdo protegido')).toBeNull()
    expect(history).toEqual(['/tasks'])
  })
})
