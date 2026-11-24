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

/**
 * Use cases dos testes: o container de use cases do produto e `overrides` com só o que o teste
 * precisa trocar (um use case de mentira, um spy).
 *
 * @param createContainer cria o container dos use cases do produto, com o `http` de mentira e sem
 * latência.
 */
export function createTestUseCases<U extends object>(
  createContainer: () => U,
  overrides: Partial<U> = {},
): U {
  return { ...createContainer(), ...overrides }
}

/** As opções extras de um produto que não tem nenhuma: o padrão do segundo parâmetro de tipo. */
export type NoProviderProps = Record<never, never>

/** Um container que o produto não usa: o padrão de `C` (repositórios) e de `U` (use cases). */
export type NoContainer = Record<never, never>

/** A ligação do produto com o `renderWithProviders`: o que cada produto troca. */
export interface RenderWithProvidersBinding<
  C extends object = NoContainer,
  P extends object = NoProviderProps,
  U extends object = NoContainer,
> {
  /**
   * Os providers do produto (i18n, tema e o provedor de repositórios, por exemplo). Fica por
   * dentro do React Query e do Router, que o pacote põe (um provedor de sessão que limpa o cache
   * ao sair pode usar o `useQueryClient`). Recebe o container dos repositórios (`repositories`),
   * o dos use cases (`useCases`) e, se o produto declarar `P`, as `providerProps` de cada teste
   * (a sessão, por exemplo).
   */
  Providers: ComponentType<{ children: ReactNode; repositories: C; useCases: U } & P>
  /** Container de repositórios em memória; `overrides` troca só o que o teste precisa. */
  createRepositories?: (overrides?: Partial<C>) => C
  /** Container de use cases (com o `http` de mentira); `overrides` troca só o que o teste precisa. */
  createUseCases?: (overrides?: Partial<U>) => U
  /** `QueryClient` de um teste (sem retry). */
  createQueryClient: () => QueryClient
}

/** As opções por teste que não são do Testing Library: valem para o render e para o render de hook. */
export interface ProvidersTestOptions<
  C extends object = NoContainer,
  P extends object = NoProviderProps,
  U extends object = NoContainer,
> {
  /** Rota inicial do Router em memória (padrão '/'). */
  path?: string
  repositories?: Partial<C>
  /** Troca só os use cases que o teste precisa. */
  useCases?: Partial<U>
  queryClient?: QueryClient
  /**
   * Opções do produto repassadas aos `Providers` deste teste, tipadas por `P` (a sessão de cada
   * teste, por exemplo). O pacote não as lê.
   */
  providerProps?: P
}

export interface RenderWithProvidersOptions<
  C extends object = NoContainer,
  P extends object = NoProviderProps,
  U extends object = NoContainer,
> extends Omit<RenderOptions, 'wrapper'>,
    ProvidersTestOptions<C, P, U> {}

export interface RenderHookWithProvidersOptions<
  C extends object,
  Props,
  P extends object = NoProviderProps,
  U extends object = NoContainer,
> extends Omit<RenderHookOptions<Props>, 'wrapper'>,
    ProvidersTestOptions<C, P, U> {}

/** O que o render e o render de hook devolvem além do resultado do Testing Library. */
export interface ProvidersTestResult<C extends object, U extends object = NoContainer> {
  queryClient: QueryClient
  repositories: C
  useCases: U
  /** Rotas visitadas; navegar com `replace` substitui a última entrada. */
  history: ReturnType<typeof memoryLocation>['history']
  navigate: ReturnType<typeof memoryLocation>['navigate']
  /** Última rota da `history`. */
  currentPath: () => string | undefined
}

export type RenderWithProvidersResult<
  C extends object = NoContainer,
  U extends object = NoContainer,
> = RenderResult & ProvidersTestResult<C, U>

export type RenderHookWithProvidersResult<
  C extends object,
  Result,
  Props,
  U extends object = NoContainer,
> = RenderHookResult<Result, Props> & ProvidersTestResult<C, U>

function createTestHarness<C extends object, P extends object, U extends object>(
  {
    Providers,
    createRepositories,
    createUseCases,
    createQueryClient,
  }: RenderWithProvidersBinding<C, P, U>,
  {
    path = '/',
    repositories,
    useCases,
    queryClient = createQueryClient(),
    providerProps,
  }: ProvidersTestOptions<C, P, U>,
) {
  // Sem fábrica, o container é o que o teste passou em `overrides` (ou vazio): o produto que não
  // usa um dos dois não precisa declará-lo
  const container = createRepositories
    ? createRepositories(repositories)
    : ({ ...repositories } as C)
  const useCasesContainer = createUseCases ? createUseCases(useCases) : ({ ...useCases } as U)
  const location = memoryLocation({ path, record: true })

  function Wrapper({ children }: { children: ReactNode }) {
    const props = { ...providerProps, repositories: container, useCases: useCasesContainer } as {
      repositories: C
      useCases: U
    } & P
    return (
      <QueryClientProvider client={queryClient}>
        <Router hook={location.hook} searchHook={location.searchHook}>
          <Providers {...props}>{children}</Providers>
        </Router>
      </QueryClientProvider>
    )
  }

  const result: ProvidersTestResult<C, U> = {
    queryClient,
    repositories: container,
    useCases: useCasesContainer,
    history: location.history,
    navigate: location.navigate,
    currentPath: () => location.history.at(-1),
  }
  return { Wrapper, result }
}

/**
 * Cria o `renderWithProviders` de um produto. O pacote põe o que é comum a todo produto, o
 * `QueryClientProvider` e o Router em memória do wouter, e o produto liga o resto (os providers
 * de i18n, tema, repositórios e use cases, e as fábricas dos containers e do `QueryClient`).
 *
 * O `render` devolve o resultado do Testing Library e, além dele, o `queryClient`, os
 * `repositories`, os `useCases`, a `history`, o `navigate` e o `currentPath`.
 *
 * Os parâmetros de tipo são `C` (repositórios), `P` (as opções extras de cada teste,
 * `providerProps`, repassadas aos `Providers`) e `U` (use cases). Um produto declara só os que
 * usa: com use cases, `createRenderWithProviders<NoContainer, NoProviderProps, UseCases>` ou
 * `createRenderWithProviders<RepositoryContainer, NoProviderProps, UseCases>`.
 */
export function createRenderWithProviders<
  C extends object = NoContainer,
  P extends object = NoProviderProps,
  U extends object = NoContainer,
>(binding: RenderWithProvidersBinding<C, P, U>) {
  return function renderWithProviders(
    ui: ReactElement,
    options: RenderWithProvidersOptions<C, P, U> = {},
  ): RenderWithProvidersResult<C, U> {
    const { path, repositories, useCases, queryClient, providerProps, ...renderOptions } = options
    const { Wrapper, result } = createTestHarness(binding, {
      path,
      repositories,
      useCases,
      queryClient,
      providerProps,
    })
    return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), ...result }
  }
}

/**
 * Cria o `renderHookWithProviders` de um produto, com a mesma ligação do
 * `createRenderWithProviders`: os mesmos providers, containers, `QueryClient` e rota em
 * memória, para testar um hook de query ou de mutation sem montar um componente de mentira.
 *
 * Devolve o resultado do `renderHook` do Testing Library (`result`, `rerender`, `unmount`) e,
 * além dele, os mesmos campos do `renderWithProviders`.
 */
export function createRenderHookWithProviders<
  C extends object = NoContainer,
  P extends object = NoProviderProps,
  U extends object = NoContainer,
>(binding: RenderWithProvidersBinding<C, P, U>) {
  return function renderHookWithProviders<Result, Props = undefined>(
    hook: (props: Props) => Result,
    options: RenderHookWithProvidersOptions<C, Props, P, U> = {},
  ): RenderHookWithProvidersResult<C, Result, Props, U> {
    const { path, repositories, useCases, queryClient, providerProps, ...hookOptions } = options
    const { Wrapper, result } = createTestHarness(binding, {
      path,
      repositories,
      useCases,
      queryClient,
      providerProps,
    })
    return { ...renderHook(hook, { wrapper: Wrapper, ...hookOptions }), ...result }
  }
}
