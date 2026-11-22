import { createQueryClient, QueryProvider } from '@matizze/prumo-core/query'
import type { ReactNode } from 'react'
import { I18nProvider } from '@/i18n'
import { RepositoryProvider } from '@/providers/repository'

function createClient() {
  return createQueryClient({
    // Sem interface no projeto, o erro vai para o console: troque pela notificação do seu design system
    notify: (message) => console.error(message),
    getErrorMessage: (error) => (error instanceof Error ? error.message : String(error)),
  })
}

/** Os provedores do app: dados (TanStack Query), textos (i18n) e repositórios. */
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryProvider createClient={createClient}>
      <I18nProvider>
        <RepositoryProvider>{children}</RepositoryProvider>
      </I18nProvider>
    </QueryProvider>
  )
}
