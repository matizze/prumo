import {
  createRepositoryContainer,
  resolveDataSource,
  type RepositoryContainerOf,
} from '@matizze/prumo-core/repositories'
import { DATA_SOURCES, type RepositoryOptions } from './options'

export { DATA_SOURCES, type DataSource, type RepositoryOptions } from './options'

// O container: o prumo make:repository acrescenta uma fábrica por domínio
const factories = {}

export type RepositoryContainer = RepositoryContainerOf<typeof factories>

// A fonte vem da VITE_DATA_SOURCE (mock, quando falta). Os testes passam dataSource: 'mock' no render.
export function createRepositories(options: Partial<RepositoryOptions> = {}): RepositoryContainer {
  const dataSource =
    options.dataSource ??
    resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')
  return createRepositoryContainer(factories, { ...options, dataSource })
}
