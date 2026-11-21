import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

export interface QueryProviderProps {
  children: ReactNode
  /** Cria o `QueryClient` do produto (em geral, `createQueryClient` já com `notify` e mensagens). */
  createClient: () => QueryClient
}

/** Provedor do React Query: um `QueryClient` novo por montagem, criado por `createClient`. */
export function QueryProvider({ children, createClient }: QueryProviderProps) {
  const [client] = useState(createClient)

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
