import type { RepositoryOptions as CoreRepositoryOptions } from '@matizze/prumo-core/repositories'

/** De onde os repositórios leem: hoje só a memória (o mock). Acrescente a API real aqui. */
export const DATA_SOURCES = ['memory'] as const

export type DataSource = (typeof DATA_SOURCES)[number]

export type RepositoryOptions = CoreRepositoryOptions<DataSource>
