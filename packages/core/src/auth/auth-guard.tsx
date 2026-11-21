import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'wouter'

export interface AuthGuardProps {
  children: ReactNode
  /** A sessão está aberta. Vem do hook de autenticação do produto. */
  isAuthenticated: boolean
  /** A sessão ainda está sendo verificada: não redireciona nem mostra o conteúdo. */
  isLoading: boolean
  /** Rota para onde a pessoa vai quando não há sessão. Padrão: `/login`. */
  redirectTo?: string
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
  fallback = null,
}: AuthGuardProps) {
  const [, navigate] = useLocation()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate(redirectTo, { replace: true })
  }, [isAuthenticated, isLoading, navigate, redirectTo])

  if (isLoading) return <>{fallback}</>
  if (!isAuthenticated) return null

  return <>{children}</>
}
