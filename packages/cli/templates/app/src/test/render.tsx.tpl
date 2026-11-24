import { QueryClient } from '@tanstack/react-query'
import {
  createRenderHookWithProviders,
  createRenderWithProviders,
  createTestQueryClient,
  type NoProviderProps,
} from '@matizze/prumo-testing'
import type { ReactNode } from 'react'
import { I18nProvider } from '@/i18n'
import { RepositoryProvider } from '@/providers/repository'
import { UseCasesProvider } from '@/providers/use-cases'
import { createRepositories, type RepositoryContainer } from '@/repositories'
import { createAppUseCases, type UseCases } from '@/use-cases'

function Providers({
  children,
  repositories,
  useCases,
}: {
  children: ReactNode
  repositories: RepositoryContainer
  useCases: UseCases
}) {
  return (
    <I18nProvider>
      <UseCasesProvider value={useCases}>
        <RepositoryProvider value={repositories}>{children}</RepositoryProvider>
      </UseCasesProvider>
    </I18nProvider>
  )
}

// A ligação do app com os testes: o que o pacote não conhece (i18n, use cases e repositórios).
const binding = {
  Providers,
  createRepositories: (overrides?: Partial<RepositoryContainer>) => ({
    ...createRepositories({ dataSource: 'mock', latencyMs: 0 }),
    ...overrides,
  }),
  createUseCases: (overrides?: Partial<UseCases>) => ({
    ...createAppUseCases({ dataSource: 'mock', latencyMs: 0 }),
    ...overrides,
  }),
  createQueryClient: () =>
    createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
}

/**
 * Renderiza com os provedores do app, a rota em memória e use cases sobre o `http` de mentira (o
 * mock) e repositórios em memória, sem latência. `useCases: { getStores }` troca só o que o teste
 * precisa.
 */
export const renderWithProviders = createRenderWithProviders<
  RepositoryContainer,
  NoProviderProps,
  UseCases
>(binding)

/**
 * O mesmo, para testar um hook de query ou de mutation sem montar um componente:
 * `renderHookWithProviders(() => useClientes())`.
 */
export const renderHookWithProviders = createRenderHookWithProviders<
  RepositoryContainer,
  NoProviderProps,
  UseCases
>(binding)

// Para acrescentar um provedor do app que muda de teste para teste (a sessão, por exemplo):
// 1. declare as opções e aceite-as no `Providers`:
//      interface TestProviderProps { session?: Session }
//      function Providers({ children, repositories, useCases, session }: { children: ReactNode;
//        repositories: RepositoryContainer; useCases: UseCases } & TestProviderProps) { ... }
// 2. passe o tipo ao criar os renders:
//      createRenderWithProviders<RepositoryContainer, TestProviderProps, UseCases>(binding)
//      createRenderHookWithProviders<RepositoryContainer, TestProviderProps, UseCases>(binding)
// 3. escolha a opção em cada teste:
//      renderWithProviders(<Page />, { providerProps: { session } })
