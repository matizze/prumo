import { createContext, useContext, useState, type ReactNode } from 'react'

export interface RepositoryProviderProps<C> {
  children: ReactNode
  /** Container injetado (testes e Storybook). Sem ele, o provedor cria o padrão do produto. */
  value?: C
}

/**
 * Cria o contexto de repositórios de um produto, já tipado com o container dele.
 *
 * @param createDefault cria o container padrão quando o provedor não recebe `value`. Sem ele, o
 * `value` passa a ser obrigatório.
 */
export function createRepositoryContext<C>(createDefault?: () => C) {
  const RepositoryContext = createContext<C | null>(null)

  function RepositoryProvider({ children, value }: RepositoryProviderProps<C>) {
    // useState (e não useMemo) garante uma única criação por montagem
    const [initial] = useState(() => {
      if (value !== undefined) return value
      if (!createDefault) {
        throw new Error(
          'RepositoryProvider precisa de `value`: passe o container ou informe `createDefault` em createRepositoryContext',
        )
      }
      return createDefault()
    })

    return (
      <RepositoryContext.Provider value={value ?? initial}>{children}</RepositoryContext.Provider>
    )
  }

  function useRepositories(): C {
    const ctx = useContext(RepositoryContext)
    if (ctx === null) {
      throw new Error('useRepositories must be used within a RepositoryProvider')
    }
    return ctx
  }

  return { RepositoryProvider, useRepositories }
}
