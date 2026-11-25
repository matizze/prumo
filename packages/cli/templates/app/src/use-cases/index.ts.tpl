import { createMockHttp } from '@matizze/prumo-core/http'
import { resolveDataSource } from '@matizze/prumo-core/use-cases'
import { api } from '@/http/api'
import { withErrors } from '@/http/errors'
import type { UseCaseDeps } from './deps'
import { DATA_SOURCES, type UseCaseOptions } from './options'

export type { UseCaseDeps } from './deps'
export { DATA_SOURCES, type DataSource, type UseCaseOptions } from './options'

/** As rotas de mock de todos os domínios (o prumo make:usecase acrescenta uma por domínio). */
export const mockRoutes = {}

/** Todos os use cases do app (o prumo make:usecase acrescenta um domínio por vez). */
export function createUseCases(_deps: UseCaseDeps) {
  return {}
}

export type UseCases = ReturnType<typeof createUseCases>

/**
 * Monta os use cases do app. Com VITE_DATA_SOURCE=http, o `http` é a API; com mock (o padrão, sem a
 * variável), é o `http` de mentira, que responde pelas rotas de mock. Os dois lançam os mesmos
 * erros (`UIError`), e o código dos use cases é o mesmo da produção. Outro valor lança um erro,
 * para a configuração errada não passar em silêncio. Os testes passam dataSource: 'mock' no render.
 */
export function createAppUseCases(options: Partial<UseCaseOptions> = {}): UseCases {
  const dataSource =
    options.dataSource ??
    resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')
  const http =
    dataSource === 'http'
      ? api
      : withErrors(createMockHttp(mockRoutes, { latencyMs: options.latencyMs ?? 300 }))
  return createUseCases({ http, storage: localStorage })
}
