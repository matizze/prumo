import { createContext, useContext, useState, type ReactNode } from 'react'

export interface ContainerProviderProps<C> {
  children: ReactNode
  /** Container injetado (nos testes). Sem ele, o provedor cria o padrão do produto. */
  value?: C
}

interface ContainerContextNames {
  /** O nome do provedor, para as mensagens de erro (`RepositoryProvider`). */
  provider: string
  /** O nome do hook (`useRepositories`). */
  hook: string
  /** O nome da função que cria o contexto (`createRepositoryContext`). */
  factory: string
}

/** O contexto de um container injetado no React, que `createRepositoryContext` e `createUseCasesContext` dividem. */
export function createContainerContext<C>(names: ContainerContextNames, createDefault?: () => C) {
  const Context = createContext<C | null>(null)

  function Provider({ children, value }: ContainerProviderProps<C>) {
    // useState (e não useMemo) garante uma única criação por montagem
    const [initial] = useState(() => {
      if (value !== undefined) return value
      if (!createDefault) {
        throw new Error(
          `${names.provider} precisa de \`value\`: passe o container ou informe \`createDefault\` em ${names.factory}`,
        )
      }
      return createDefault()
    })

    return <Context.Provider value={value ?? initial}>{children}</Context.Provider>
  }

  function useContainer(): C {
    const ctx = useContext(Context)
    if (ctx === null) {
      throw new Error(`${names.hook} must be used within a ${names.provider}`)
    }
    return ctx
  }

  return { Provider, useContainer }
}
