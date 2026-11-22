import { MutationCache, QueryCache, QueryClient, type DefaultOptions } from '@tanstack/react-query'

/**
 * Controle da notificação global de erro, por query ou mutation, via `meta`. É uma `interface`
 * para o produto acrescentar campos por declaration merging (veja o README do core).
 */
export interface ErrorMeta {
  /** Texto da notificação no lugar da mensagem derivada do erro. */
  errorMessage?: string
  /** Sem notificação: a própria tela já mostra o erro (ex.: alerta inline no formulário). */
  silent?: boolean
}

/**
 * O `ErrorMeta` sem o nome de interface. O TanStack só aceita no `Register` um tipo atribuível a
 * `Record<string, unknown>`, e uma interface não é (não tem assinatura de índice implícita): com
 * ela, o meta voltaria em silêncio ao `Record` genérico e perderia a tipagem. O tipo mapeado
 * tem os mesmos campos, inclusive os que o produto acrescenta ao `ErrorMeta`, e é atribuível.
 */
type RegisteredMeta = { [K in keyof ErrorMeta]: ErrorMeta[K] }

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: RegisteredMeta
    mutationMeta: RegisteredMeta
  }
}

/** Opções de `createQueryClient`. */
export interface QueryClientOptions {
  /** Mostra o erro ao usuário (uma notificação, por exemplo). O core não conhece a interface. */
  notify: (message: string) => void
  /** Texto do erro, no idioma ativo (hoje o `getErrorMessage` criado por `createErrorMessage`). */
  getErrorMessage: (error: unknown) => string
  /**
   * Sobrescreve os padrões de cache (os testes usam para desligar o retry) sem perder o
   * tratamento de erro. Os padrões são `staleTime` 30 s, `gcTime` 5 min, `retry` 1 e sem
   * refetch ao voltar o foco.
   */
  defaultOptions?: DefaultOptions
}

/**
 * QueryClient do produto: padrões de cache e notificação global de erro. Notifica a falha de
 * refetch em segundo plano (quando há dados em cache) e o erro de qualquer mutation, a não ser
 * que o `meta` da query ou da mutation peça `silent`; `meta.errorMessage` troca o texto.
 */
export function createQueryClient({
  notify,
  getErrorMessage,
  defaultOptions: { queries, mutations } = {},
}: QueryClientOptions): QueryClient {
  function notifyError(error: unknown, meta: ErrorMeta | undefined) {
    if (meta?.silent) return
    notify(meta?.errorMessage ?? getErrorMessage(error))
  }

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
