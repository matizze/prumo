import { QueryClient } from '@tanstack/react-query'
import {
  createRenderHookWithProviders,
  createRenderWithProviders,
  createTestQueryClient,
} from '@matizze/prumo-testing'
import type { ReactNode } from 'react'
import { I18nProvider } from '@/i18n'
import { RepositoryProvider } from '@/providers/repository'
import { createRepositories, type RepositoryContainer } from '@/repositories'

function Providers({
  children,
  repositories,
}: {
  children: ReactNode
  repositories: RepositoryContainer
}) {
  return (
    <I18nProvider>
      <RepositoryProvider value={repositories}>{children}</RepositoryProvider>
    </I18nProvider>
  )
}

// A ligação do app com os testes: o que o pacote não conhece (i18n e repositórios).
const binding = {
  Providers,
  createRepositories: (overrides?: Partial<RepositoryContainer>) => ({
    ...createRepositories({ dataSource: 'mock', latencyMs: 0 }),
    ...overrides,
  }),
  createQueryClient: () =>
    createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
}

/** Renderiza com os provedores do app, a rota em memória e repositórios em memória sem latência. */
export const renderWithProviders = createRenderWithProviders<RepositoryContainer>(binding)

/**
 * O mesmo, para testar um hook de query ou de mutation sem montar um componente:
 * `renderHookWithProviders(() => useClientes())`.
 */
export const renderHookWithProviders = createRenderHookWithProviders<RepositoryContainer>(binding)

// Para acrescentar um provedor do app que muda de teste para teste (a sessão, por exemplo):
// 1. declare as opções e aceite-as no `Providers`:
//      interface TestProviderProps { session?: Session }
//      function Providers({ children, repositories, session }: { children: ReactNode;
//        repositories: RepositoryContainer } & TestProviderProps) { ... }
// 2. passe o tipo ao criar os renders:
//      createRenderWithProviders<RepositoryContainer, TestProviderProps>(binding)
//      createRenderHookWithProviders<RepositoryContainer, TestProviderProps>(binding)
// 3. escolha a opção em cada teste:
//      renderWithProviders(<Page />, { providerProps: { session } })
