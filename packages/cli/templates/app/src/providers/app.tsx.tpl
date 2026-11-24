import { createQueryClient, QueryProvider } from '@matizze/prumo-core/query'
import type { ReactNode } from 'react'
import { getErrorMessage } from '@/errors'
import { I18nProvider } from '@/i18n'
import { RepositoryProvider } from '@/providers/repository'
import { UseCasesProvider } from '@/providers/use-cases'

function createClient() {
  return createQueryClient({
    // Sem interface no projeto, o erro vai para o console: troque pela notificação do seu design system
    notify: (message) => console.error(message),
    getErrorMessage,
  })
}

/** Os provedores do app: dados (TanStack Query), textos (i18n), use cases e repositórios. */
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryProvider createClient={createClient}>
      <I18nProvider>
        <UseCasesProvider>
          <RepositoryProvider>{children}</RepositoryProvider>
        </UseCasesProvider>
      </I18nProvider>
    </QueryProvider>
  )
}
