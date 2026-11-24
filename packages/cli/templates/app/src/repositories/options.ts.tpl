import type { RepositoryOptions as CoreRepositoryOptions } from '@matizze/prumo-core/repositories'

/**
 * De onde os repositórios leem. O prumo make:repository --data-source acrescenta a fonte aqui
 * (http, storage); a escolhida em tempo de execução vem da VITE_DATA_SOURCE.
 */
export const DATA_SOURCES = ['mock'] as const

export type DataSource = (typeof DATA_SOURCES)[number]

export type RepositoryOptions = CoreRepositoryOptions<DataSource>
