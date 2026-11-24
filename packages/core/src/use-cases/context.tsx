import {
  createContainerContext,
  type ContainerProviderProps,
} from '../internal/container-context.tsx'

export type UseCasesProviderProps<C> = ContainerProviderProps<C>

/**
 * Cria o contexto dos use cases de um produto, já tipado com o container dele.
 *
 * @param createDefault cria o container padrão quando o provedor não recebe `value`. Sem ele, o
 * `value` passa a ser obrigatório.
 */
export function createUseCasesContext<C>(createDefault?: () => C) {
  const { Provider, useContainer } = createContainerContext(
    { provider: 'UseCasesProvider', hook: 'useUseCases', factory: 'createUseCasesContext' },
    createDefault,
  )
  return { UseCasesProvider: Provider, useUseCases: useContainer }
}
