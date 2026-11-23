import { useEffect, type ReactNode } from 'react'
import { useLocation, useSearch } from 'wouter'
import { buildLoginRedirect, ORIGIN_PARAM, readOrigin } from './origin.ts'

export interface AuthGuardProps {
  children: ReactNode
  /** A sessão está aberta. Vem do hook de autenticação do produto. */
  isAuthenticated: boolean
  /** A sessão ainda está sendo verificada: não redireciona nem mostra o conteúdo. */
  isLoading: boolean
  /** Rota para onde a pessoa vai quando não há sessão. Padrão: `/login`. */
  redirectTo?: string
  /**
   * Leva a rota pedida (caminho e query) até o login, no parâmetro `next`
   * (`/login?next=%2Fclientes%3Fpage%3D2`), para o login voltar para ela com `useAuthOrigin`.
   * Padrão: `false` (o redirecionamento é só `redirectTo`).
   */
  keepOrigin?: boolean
  /** O que aparece enquanto a sessão carrega, por exemplo um spinner. Padrão: nada. */
  fallback?: ReactNode
}

/**
 * Guarda de rota: só mostra `children` com a sessão aberta. Sem sessão, troca a entrada atual do
 * histórico por `redirectTo`, para o botão de voltar não cair de novo na rota protegida.
 *
 * O core não importa componente de UI nem conhece o hook de autenticação: o produto passa o estado
 * da sessão e o `fallback` de carregamento.
 */
export function AuthGuard({
  children,
  isAuthenticated,
  isLoading,
  redirectTo = '/login',
  keepOrigin = false,
  fallback = null,
}: AuthGuardProps) {
  const [location, navigate] = useLocation()
  const search = useSearch()
  const origin = search ? `${location}?${search}` : location

  useEffect(() => {
    if (isLoading || isAuthenticated) return
    if (!keepOrigin) return navigate(redirectTo, { replace: true })
    // Já está na tela de login (o guarda envolve também a rota do login): não guarda a si mesma.
    if (location === redirectTo.split('?')[0]) return
    navigate(buildLoginRedirect(redirectTo, origin), { replace: true })
  }, [isAuthenticated, isLoading, keepOrigin, location, navigate, origin, redirectTo])

  if (isLoading) return <>{fallback}</>
  if (!isAuthenticated) return null
  return <>{children}</>
}

/**
 * Para a tela de login: a rota que o `AuthGuard` (com `keepOrigin`) guardou em `?next=`, já
 * conferida (só caminho relativo do próprio app), ou `fallback` quando não há ou não é segura.
 * Depois de entrar, `navigate(useAuthOrigin('/painel'), { replace: true })`.
 */
export function useAuthOrigin(fallback = '/', param: string = ORIGIN_PARAM): string {
  return readOrigin(useSearch(), fallback, param)
}
