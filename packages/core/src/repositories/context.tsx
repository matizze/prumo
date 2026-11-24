import {
  createContainerContext,
  type ContainerProviderProps,
} from '../internal/container-context.tsx'

export type RepositoryProviderProps<C> = ContainerProviderProps<C>

/**
 * Cria o contexto de repositórios de um produto, já tipado com o container dele.
 *
 * @param createDefault cria o container padrão quando o provedor não recebe `value`. Sem ele, o
 * `value` passa a ser obrigatório.
 */
export function createRepositoryContext<C>(createDefault?: () => C) {
  const { Provider, useContainer } = createContainerContext(
    {
      provider: 'RepositoryProvider',
      hook: 'useRepositories',
      factory: 'createRepositoryContext',
    },
    createDefault,
  )
  return { RepositoryProvider: Provider, useRepositories: useContainer }
}
