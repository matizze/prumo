import { QueryClientProvider, type DefaultOptions, type QueryClient } from '@tanstack/react-query'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'

/**
 * `QueryClient` isolado por teste e sem retry, para as falhas aparecerem na hora.
 *
 * @param createQueryClient a fábrica do `QueryClient` do produto (com o tratamento de erro dele).
 * Recebe os `defaultOptions` que desligam o retry.
 */
export function createTestQueryClient(
  createQueryClient: (defaultOptions: DefaultOptions) => QueryClient,
): QueryClient {
  return createQueryClient({
    queries: { retry: false },
    mutations: { retry: false },
  })
}

/**
 * Repositórios dos testes: o container do produto em memória e sem latência, e `overrides` troca
 * só o que o teste precisa.
 *
 * @param createContainer cria o container em memória (no produto, o `createRepositories` com
 * `dataSource: 'memory'` e `latencyMs: 0`).
 */
export function createTestRepositories<C extends object>(
  createContainer: () => C,
  overrides: Partial<C> = {},
): C {
  return { ...createContainer(), ...overrides }
}

/** A ligação do produto com o `renderWithProviders`: o que cada produto troca. */
export interface RenderWithProvidersBinding<C extends object> {
  /**
   * Os providers do produto (i18n, tema e o provedor de repositórios, por exemplo). Fica por
   * fora do React Query e do Router, que o pacote põe. Recebe o container dos repositórios.
   */
  Providers: ComponentType<{ children: ReactNode; repositories: C }>
  /** Container em memória; `overrides` troca só o que o teste precisa. */
  createRepositories: (overrides?: Partial<C>) => C
  /** `QueryClient` de um teste (sem retry). */
  createQueryClient: () => QueryClient
}

export interface RenderWithProvidersOptions<C extends object> extends Omit<
  RenderOptions,
  'wrapper'
> {
  /** Rota inicial do Router em memória (padrão '/'). */
  path?: string
  repositories?: Partial<C>
  queryClient?: QueryClient
}

export type RenderWithProvidersResult<C extends object> = RenderResult & {
  queryClient: QueryClient
  repositories: C
  /** Rotas visitadas; navegar com `replace` substitui a última entrada. */
  history: ReturnType<typeof memoryLocation>['history']
  navigate: ReturnType<typeof memoryLocation>['navigate']
  /** Última rota da `history`. */
  currentPath: () => string | undefined
}

/**
 * Cria o `renderWithProviders` de um produto. O pacote põe o que é comum a todo produto, o
 * `QueryClientProvider` e o Router em memória do wouter, e o produto liga o resto (os providers
 * de i18n, tema e repositórios, e as fábricas do container e do `QueryClient`).
 *
 * O `render` devolve o resultado do Testing Library e, além dele, o `queryClient`, os
 * `repositories`, a `history`, o `navigate` e o `currentPath`.
 */
export function createRenderWithProviders<C extends object>({
  Providers,
  createRepositories,
  createQueryClient,
}: RenderWithProvidersBinding<C>) {
  return function renderWithProviders(
    ui: ReactElement,
    {
      path = '/',
      repositories,
      queryClient = createQueryClient(),
      ...options
    }: RenderWithProvidersOptions<C> = {},
  ): RenderWithProvidersResult<C> {
    const container = createRepositories(repositories)
    const location = memoryLocation({ path, record: true })

    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <Providers repositories={container}>
          <QueryClientProvider client={queryClient}>
            <Router hook={location.hook} searchHook={location.searchHook}>
              {children}
            </Router>
          </QueryClientProvider>
        </Providers>
      )
    }

    return {
      ...render(ui, { wrapper: Wrapper, ...options }),
      queryClient,
      repositories: container,
      history: location.history,
      navigate: location.navigate,
      currentPath: () => location.history.at(-1),
    }
  }
}
