import { createRepositoryContext } from '@matizze/prumo-core/repositories'
import { createRepositories, type RepositoryContainer } from '@/repositories'

export const { RepositoryProvider, useRepositories } =
  createRepositoryContext<RepositoryContainer>(createRepositories)
