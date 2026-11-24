import { createMockHttp } from '@matizze/prumo-core/http'
import { api } from '@/http/api'
import type { UseCaseDeps } from './deps'
import type { UseCaseOptions } from './options'

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
 * Monta os use cases do app. Com VITE_DATA_SOURCE=http, o `http` é a API; com qualquer outro valor
 * (ou sem ele), o mock: responde pelas rotas de mock, e o código dos use cases é o mesmo da
 * produção. A variável também vale para os repositórios, que têm a fonte storage, e por isso um
 * valor que os use cases não conhecem não é erro. Os testes passam dataSource: 'mock' no render.
 */
export function createAppUseCases(options: Partial<UseCaseOptions> = {}): UseCases {
  const dataSource = options.dataSource ?? (import.meta.env.VITE_DATA_SOURCE === 'http' ? 'http' : 'mock')
  const http =
    dataSource === 'http' ? api : createMockHttp(mockRoutes, { latencyMs: options.latencyMs ?? 300 })
  return createUseCases({ http, storage: localStorage })
}
