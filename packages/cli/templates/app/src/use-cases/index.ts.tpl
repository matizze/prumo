import { createMockHttp } from '@matizze/prumo-core/http'
import { resolveDataSource } from '@matizze/prumo-core/use-cases'
import { api } from '@/http/api'
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
 * Monta os use cases do app. A fonte vem da VITE_DATA_SOURCE (mock, quando falta): no mock, o
 * `http` responde pelas rotas de mock e o código dos use cases é o mesmo da produção. Os testes
 * passam dataSource: 'mock' no render.
 */
export function createAppUseCases(options: Partial<UseCaseOptions> = {}): UseCases {
  const dataSource =
    options.dataSource ??
    resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')
  const http =
    dataSource === 'http' ? api : createMockHttp(mockRoutes, { latencyMs: options.latencyMs ?? 300 })
  return createUseCases({ http, storage: localStorage })
}
