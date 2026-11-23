import { QueryClientProvider, type DefaultOptions, type QueryClient } from '@tanstack/react-query'
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderHookResult,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react'
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

/** As opções extras de um produto que não tem nenhuma: o padrão do segundo parâmetro de tipo. */
export type NoProviderProps = Record<never, never>

/** A ligação do produto com o `renderWithProviders`: o que cada produto troca. */
export interface RenderWithProvidersBinding<
  C extends object,
  P extends object = NoProviderProps,
> {
  /**
   * Os providers do produto (i18n, tema e o provedor de repositórios, por exemplo). Fica por
   * dentro do React Query e do Router, que o pacote põe (um provedor de sessão que limpa o cache
   * ao sair pode usar o `useQueryClient`). Recebe o container dos repositórios e,
   * se o produto declarar `P`, as `providerProps` de cada teste (a sessão, por exemplo).
   */
  Providers: ComponentType<{ children: ReactNode; repositories: C } & P>
  /** Container em memória; `overrides` troca só o que o teste precisa. */
  createRepositories: (overrides?: Partial<C>) => C
  /** `QueryClient` de um teste (sem retry). */
  createQueryClient: () => QueryClient
}

/** As opções por teste que não são do Testing Library: valem para o render e para o render de hook. */
export interface ProvidersTestOptions<C extends object, P extends object = NoProviderProps> {
  /** Rota inicial do Router em memória (padrão '/'). */
  path?: string
  repositories?: Partial<C>
  queryClient?: QueryClient
  /**
   * Opções do produto repassadas aos `Providers` deste teste, tipadas por `P` (a sessão de cada
   * teste, por exemplo). O pacote não as lê.
   */
  providerProps?: P
}

export interface RenderWithProvidersOptions<
  C extends object,
  P extends object = NoProviderProps,
> extends Omit<RenderOptions, 'wrapper'>, ProvidersTestOptions<C, P> {}

export interface RenderHookWithProvidersOptions<
  C extends object,
  Props,
  P extends object = NoProviderProps,
> extends Omit<RenderHookOptions<Props>, 'wrapper'>, ProvidersTestOptions<C, P> {}

/** O que o render e o render de hook devolvem além do resultado do Testing Library. */
export interface ProvidersTestResult<C extends object> {
  queryClient: QueryClient
  repositories: C
  /** Rotas visitadas; navegar com `replace` substitui a última entrada. */
  history: ReturnType<typeof memoryLocation>['history']
  navigate: ReturnType<typeof memoryLocation>['navigate']
  /** Última rota da `history`. */
  currentPath: () => string | undefined
}

export type RenderWithProvidersResult<C extends object> = RenderResult & ProvidersTestResult<C>

export type RenderHookWithProvidersResult<
  C extends object,
  Result,
  Props,
> = RenderHookResult<Result, Props> & ProvidersTestResult<C>

function createTestHarness<C extends object, P extends object>(
  { Providers, createRepositories, createQueryClient }: RenderWithProvidersBinding<C, P>,
  {
    path = '/',
    repositories,
    queryClient = createQueryClient(),
    providerProps,
  }: ProvidersTestOptions<C, P>,
) {
  const container = createRepositories(repositories)
  const location = memoryLocation({ path, record: true })

  function Wrapper({ children }: { children: ReactNode }) {
    const props = { ...providerProps, repositories: container } as { repositories: C } & P
    return (
      <QueryClientProvider client={queryClient}>
        <Router hook={location.hook} searchHook={location.searchHook}>
          <Providers {...props}>{children}</Providers>
        </Router>
      </QueryClientProvider>
    )
  }

  const result: ProvidersTestResult<C> = {
    queryClient,
    repositories: container,
    history: location.history,
    navigate: location.navigate,
    currentPath: () => location.history.at(-1),
  }
  return { Wrapper, result }
}

/**
 * Cria o `renderWithProviders` de um produto. O pacote põe o que é comum a todo produto, o
 * `QueryClientProvider` e o Router em memória do wouter, e o produto liga o resto (os providers
 * de i18n, tema e repositórios, e as fábricas do container e do `QueryClient`).
 *
 * O `render` devolve o resultado do Testing Library e, além dele, o `queryClient`, os
 * `repositories`, a `history`, o `navigate` e o `currentPath`.
 *
 * O segundo parâmetro de tipo, `P`, declara as opções extras de cada teste (`providerProps`),
 * repassadas aos `Providers`. Sem ele, nada muda.
 */
export function createRenderWithProviders<C extends object, P extends object = NoProviderProps>(
  binding: RenderWithProvidersBinding<C, P>,
) {
  return function renderWithProviders(
    ui: ReactElement,
    options: RenderWithProvidersOptions<C, P> = {},
  ): RenderWithProvidersResult<C> {
    const { path, repositories, queryClient, providerProps, ...renderOptions } = options
    const { Wrapper, result } = createTestHarness(binding, {
      path,
      repositories,
      queryClient,
      providerProps,
    })
    return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), ...result }
  }
}

/**
 * Cria o `renderHookWithProviders` de um produto, com a mesma ligação do
 * `createRenderWithProviders`: os mesmos providers, repositórios, `QueryClient` e rota em
 * memória, para testar um hook de query ou de mutation sem montar um componente de mentira.
 *
 * Devolve o resultado do `renderHook` do Testing Library (`result`, `rerender`, `unmount`) e,
 * além dele, os mesmos campos do `renderWithProviders`.
 */
export function createRenderHookWithProviders<
  C extends object,
  P extends object = NoProviderProps,
>(binding: RenderWithProvidersBinding<C, P>) {
  return function renderHookWithProviders<Result, Props = undefined>(
    hook: (props: Props) => Result,
    options: RenderHookWithProvidersOptions<C, Props, P> = {},
  ): RenderHookWithProvidersResult<C, Result, Props> {
    const { path, repositories, queryClient, providerProps, ...hookOptions } = options
    const { Wrapper, result } = createTestHarness(binding, {
      path,
      repositories,
      queryClient,
      providerProps,
    })
    return { ...renderHook(hook, { wrapper: Wrapper, ...hookOptions }), ...result }
  }
}
