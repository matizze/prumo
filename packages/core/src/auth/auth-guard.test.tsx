// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthGuard, useAuthOrigin, type AuthGuardProps } from './index.ts'

afterEach(cleanup)

function renderGuard(props: Partial<AuthGuardProps> = {}, path = '/tasks') {
  const { hook, searchHook, history } = memoryLocation({ path, record: true })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Router hook={hook} searchHook={searchHook}>
      {children}
    </Router>
  )
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

  it('por padrão não leva a origem para o login', () => {
    const { history } = renderGuard({}, '/clientes?page=2')

    expect(history.at(-1)).toBe('/login')
  })

  it('com keepOrigin, leva caminho e query da rota pedida em ?next=', () => {
    const { history } = renderGuard({ keepOrigin: true }, '/clientes?page=2&q=ana')

    expect(history.at(-1)).toBe('/login?next=%2Fclientes%3Fpage%3D2%26q%3Dana')
  })

  it('com keepOrigin e redirectTo próprio, anexa ao redirectTo', () => {
    const { history } = renderGuard({ keepOrigin: true, redirectTo: '/entrar' }, '/clientes')

    expect(history.at(-1)).toBe('/entrar?next=%2Fclientes')
  })

  it('com keepOrigin, não se guarda a si mesmo quando já está no login', () => {
    const { history } = renderGuard({ keepOrigin: true }, '/login?next=%2Fclientes')

    expect(history).toEqual(['/login?next=%2Fclientes'])
  })
})

describe('useAuthOrigin', () => {
  function Origin({ fallback }: { fallback?: string }) {
    return <p>{useAuthOrigin(fallback)}</p>
  }

  function renderOrigin(path: string, fallback?: string) {
    const { hook, searchHook } = memoryLocation({ path })
    render(
      <Router hook={hook} searchHook={searchHook}>
        <Origin fallback={fallback} />
      </Router>,
    )
  }

  it('devolve a origem guardada pelo guarda', () => {
    renderOrigin('/login?next=%2Fclientes%3Fpage%3D2')

    expect(screen.getByText('/clientes?page=2')).toBeTruthy()
  })

  it('sem origem, devolve o fallback', () => {
    renderOrigin('/login', '/painel')

    expect(screen.getByText('/painel')).toBeTruthy()
  })

  it('recusa redirecionamento aberto', () => {
    renderOrigin('/login?next=https%3A%2F%2Foutro.site', '/painel')

    expect(screen.getByText('/painel')).toBeTruthy()
  })
})
