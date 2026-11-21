import { MutationCache, QueryCache, QueryClient, type DefaultOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors/get-error-message'

/** Controle do toast de erro global, por query ou mutation, via `meta`. */
type ErrorMeta = {
  /** Texto do toast no lugar da mensagem derivada do erro. */
  errorMessage?: string
  /** Sem toast: a própria tela já mostra o erro (ex.: alerta inline no formulário). */
  silent?: boolean
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: ErrorMeta
    mutationMeta: ErrorMeta
  }
}

function notifyError(error: unknown, meta: ErrorMeta | undefined) {
  if (meta?.silent) return
  toast.error(meta?.errorMessage ?? getErrorMessage(error))
}

/**
 * QueryClient do app: padrões de cache e toast global de erro. `defaultOptions` sobrescreve
 * os padrões (os testes usam para desligar o retry) sem perder o tratamento de erro.
 */
export function createQueryClient({ queries, mutations }: DefaultOptions = {}) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Só falha de refetch em segundo plano (a tela continua com os dados antigos).
        // Falha no carregamento inicial não tem dados e é mostrada pela própria tela.
        if (query.state.data !== undefined) notifyError(error, query.meta)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => notifyError(error, mutation.meta),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        ...queries,
      },
      mutations,
    },
  })
}
