import { QueryClient } from '@tanstack/react-query'
import { createRenderWithProviders, createTestQueryClient } from '@matizze/prumo-testing'
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

/** Renderiza com os provedores do app, a rota em memória e repositórios em memória sem latência. */
export const renderWithProviders = createRenderWithProviders<RepositoryContainer>({
  Providers,
  createRepositories: (overrides) => ({
    ...createRepositories({ dataSource: 'memory', latencyMs: 0 }),
    ...overrides,
  }),
  createQueryClient: () =>
    createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
})
