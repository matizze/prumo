import { QueryClient } from '@tanstack/react-query'
import {
  createRenderHookWithProviders,
  createRenderWithProviders,
  createTestQueryClient,
  type NoProviderProps,
} from '@matizze/prumo-testing'
import type { ReactNode } from 'react'
import { I18nProvider } from '@/i18n'
import { UseCasesProvider } from '@/providers/use-cases'
import { createAppUseCases, type UseCases } from '@/use-cases'

function Providers({ children, useCases }: { children: ReactNode; useCases: UseCases }) {
  return (
    <I18nProvider>
      <UseCasesProvider value={useCases}>{children}</UseCasesProvider>
    </I18nProvider>
  )
}

// A ligação do app com os testes: o que o pacote não conhece (i18n e use cases).
const binding = {
  Providers,
  createUseCases: (overrides?: Partial<UseCases>) => ({
    ...createAppUseCases({ dataSource: 'mock', latencyMs: 0 }),
    ...overrides,
  }),
  createQueryClient: () =>
    createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
}

/**
 * Renderiza com os provedores do app, a rota em memória e use cases sobre o `http` de mentira (o
 * mock), sem latência. `useCases: { getStores }` troca só o que o teste precisa.
 */
export const renderWithProviders = createRenderWithProviders<UseCases, NoProviderProps>(binding)

/**
 * O mesmo, para testar um hook de query ou de mutation sem montar um componente:
 * `renderHookWithProviders(() => useQuery(...))`.
 */
export const renderHookWithProviders = createRenderHookWithProviders<UseCases, NoProviderProps>(
  binding,
)

// Para acrescentar um provedor do app que muda de teste para teste (a sessão, por exemplo):
// 1. declare as opções e aceite-as no `Providers`:
//      interface TestProviderProps { session?: Session }
//      function Providers({ children, useCases, session }: { children: ReactNode;
//        useCases: UseCases } & TestProviderProps) { ... }
// 2. passe o tipo ao criar os renders:
//      createRenderWithProviders<UseCases, TestProviderProps>(binding)
//      createRenderHookWithProviders<UseCases, TestProviderProps>(binding)
// 3. escolha a opção em cada teste:
//      renderWithProviders(<Page />, { providerProps: { session } })
