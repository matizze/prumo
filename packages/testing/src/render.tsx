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

/** Um container que o produto não usa: o padrão de `U` (use cases). */
export type NoContainer = Record<never, never>

/**
 * A ligação do produto com o `renderWithProviders`: o que cada produto troca. Quando o produto
 * declara os use cases (`U`), o `createUseCases` é obrigatório. Um `U` vazio (`{}`, o app recém-criado,
 * com `UseCases = {}`) ou o `NoContainer` dispensa a fábrica.
 */
export type RenderWithProvidersBinding<
  U extends object = NoContainer,
  P extends object = NoProviderProps,
> = {
  /**
   * Os providers do produto (i18n, tema e o provedor de use cases, por exemplo). Fica por dentro do
   * React Query e do Router, que o pacote põe (um provedor de sessão que limpa o cache ao sair pode
   * usar o `useQueryClient`). Recebe o container dos use cases (`useCases`) e, se o produto declarar
   * `P`, as `providerProps` de cada teste (a sessão, por exemplo).
   */
  Providers: ComponentType<{ children: ReactNode; useCases: U } & P>
  /** `QueryClient` de um teste (sem retry). */
  createQueryClient: () => QueryClient
} & (NoContainer extends U
  ? {
      /** Container de use cases; `overrides` troca só o que o teste precisa. */
      createUseCases?: (overrides?: Partial<U>) => U
    }
  : {
      /** Container de use cases (com o `http` de mentira); `overrides` troca só o que o teste precisa. */
      createUseCases: (overrides?: Partial<U>) => U
    })

/** As opções por teste que não são do Testing Library: valem para o render e para o render de hook. */
export interface ProvidersTestOptions<U extends object = NoContainer, P extends object = NoProviderProps> {
  /** Rota inicial do Router em memória (padrão '/'). */
  path?: string
  /** Troca só os use cases que o teste precisa. */
  useCases?: Partial<U>
  queryClient?: QueryClient
  /**
   * Opções do produto repassadas aos `Providers` deste teste, tipadas por `P` (a sessão de cada
   * teste, por exemplo). O pacote não as lê.
   */
  providerProps?: P
}

export interface RenderWithProvidersOptions<U extends object = NoContainer, P extends object = NoProviderProps>
  extends Omit<RenderOptions, 'wrapper'>,
    ProvidersTestOptions<U, P> {}

export interface RenderHookWithProvidersOptions<
  U extends object,
  Props,
  P extends object = NoProviderProps,
> extends Omit<RenderHookOptions<Props>, 'wrapper'>,
    ProvidersTestOptions<U, P> {}

/** O que o render e o render de hook devolvem além do resultado do Testing Library. */
export interface ProvidersTestResult<U extends object = NoContainer> {
  queryClient: QueryClient
  useCases: U
  /** Rotas visitadas; navegar com `replace` substitui a última entrada. */
  history: ReturnType<typeof memoryLocation>['history']
  navigate: ReturnType<typeof memoryLocation>['navigate']
  /** Última rota da `history`. */
  currentPath: () => string | undefined
}

export type RenderWithProvidersResult<U extends object = NoContainer> = RenderResult &
  ProvidersTestResult<U>

export type RenderHookWithProvidersResult<U extends object, Result, Props> = RenderHookResult<
  Result,
  Props
> &
  ProvidersTestResult<U>

function createTestHarness<U extends object, P extends object>(
  { Providers, createUseCases, createQueryClient }: RenderWithProvidersBinding<U, P>,
  { path = '/', useCases, queryClient = createQueryClient(), providerProps }: ProvidersTestOptions<U, P>,
) {
  // Sem fábrica, o container é o que o teste passou em `useCases` (ou vazio): o produto sem use cases
  // não precisa declará-lo
  const container = createUseCases ? createUseCases(useCases) : ({ ...useCases } as U)
  const location = memoryLocation({ path, record: true })

  function Wrapper({ children }: { children: ReactNode }) {
    const props = { ...providerProps, useCases: container } as { useCases: U } & P
    return (
      <QueryClientProvider client={queryClient}>
        <Router hook={location.hook} searchHook={location.searchHook}>
          <Providers {...props}>{children}</Providers>
        </Router>
      </QueryClientProvider>
    )
  }

  const result: ProvidersTestResult<U> = {
    queryClient,
    useCases: container,
    history: location.history,
    navigate: location.navigate,
    currentPath: () => location.history.at(-1),
  }
  return { Wrapper, result }
}

/**
 * Cria o `renderWithProviders` de um produto. O pacote põe o que é comum a todo produto, o
 * `QueryClientProvider` e o Router em memória do wouter, e o produto liga o resto (os providers
 * de i18n, tema e use cases, e as fábricas do container e do `QueryClient`).
 *
 * O `render` devolve o resultado do Testing Library e, além dele, o `queryClient`, os
 * `useCases`, a `history`, o `navigate` e o `currentPath`.
 *
 * Os parâmetros de tipo são `U` (os use cases) e `P` (as opções extras de cada teste,
 * `providerProps`, repassadas aos `Providers`). Um produto com use cases declara `U`, e então o
 * `createUseCases` é obrigatório: `createRenderWithProviders<UseCases>(binding)`.
 */
export function createRenderWithProviders<
  U extends object = NoContainer,
  P extends object = NoProviderProps,
>(binding: RenderWithProvidersBinding<U, P>) {
  return function renderWithProviders(
    ui: ReactElement,
    options: RenderWithProvidersOptions<U, P> = {},
  ): RenderWithProvidersResult<U> {
    const { path, useCases, queryClient, providerProps, ...renderOptions } = options
    const { Wrapper, result } = createTestHarness(binding, { path, useCases, queryClient, providerProps })
    return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), ...result }
  }
}

/**
 * Cria o `renderHookWithProviders` de um produto, com a mesma ligação do
 * `createRenderWithProviders`: os mesmos providers, container, `QueryClient` e rota em
 * memória, para testar um hook de query ou de mutation sem montar um componente de mentira.
 *
 * Devolve o resultado do `renderHook` do Testing Library (`result`, `rerender`, `unmount`) e,
 * além dele, os mesmos campos do `renderWithProviders`.
 */
export function createRenderHookWithProviders<
  U extends object = NoContainer,
  P extends object = NoProviderProps,
>(binding: RenderWithProvidersBinding<U, P>) {
  return function renderHookWithProviders<Result, Props = undefined>(
    hook: (props: Props) => Result,
    options: RenderHookWithProvidersOptions<U, Props, P> = {},
  ): RenderHookWithProvidersResult<U, Result, Props> {
    const { path, useCases, queryClient, providerProps, ...hookOptions } = options
    const { Wrapper, result } = createTestHarness(binding, { path, useCases, queryClient, providerProps })
    return { ...renderHook(hook, { wrapper: Wrapper, ...hookOptions }), ...result }
  }
}
