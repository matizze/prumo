/** De onde os use cases leem: o `http` de mentira (mock) ou a API de verdade (http). */
export const DATA_SOURCES = ['mock', 'http'] as const

export type DataSource = (typeof DATA_SOURCES)[number]

export interface UseCaseOptions {
  dataSource: DataSource
  /** Latência simulada do mock, em ms (padrão: 300). Use 0 em testes. */
  latencyMs?: number
}
