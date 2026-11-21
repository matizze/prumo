import { useState, type ReactNode } from 'react'
import { RepositoryContext } from './context'
import { createRepositories, type RepositoryContainer } from '@/repositories'

type RepositoryProviderProps = {
  children: ReactNode
  /** Container injetado (testes/Storybook). Sem ele, o provider cria o padrão do ambiente. */
  value?: RepositoryContainer
}

export function RepositoryProvider({ children, value }: RepositoryProviderProps) {
  // useState (e não useMemo) garante uma única criação por montagem
  const [initial] = useState(() => value ?? createRepositories())

  return (
    <RepositoryContext.Provider value={value ?? initial}>{children}</RepositoryContext.Provider>
  )
}
