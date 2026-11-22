import { createQueryKeys } from '@matizze/prumo-core/query'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/providers/repository'
import type { I{{plural.pascal}}Repository } from '@/repositories'
import type { {{singular.pascal}}Input, {{singular.pascal}}ListQuery } from '@/schemas'

// `all` é o prefixo de tudo deste domínio: use para invalidar depois de criar, editar ou remover
export const {{singular.camel}}Keys = createQueryKeys('{{plural.kebab}}', {
  list: (query: {{singular.pascal}}ListQuery = {}) => ['list', query] as const,
  detail: (id: string) => ['detail', id] as const,
})

export const {{singular.camel}}Queries = {
  list: (repository: I{{plural.pascal}}Repository, query: {{singular.pascal}}ListQuery = {}) =>
    queryOptions({
      queryKey: {{singular.camel}}Keys.list(query),
      queryFn: () => repository.list(query),
    }),
  detail: (repository: I{{plural.pascal}}Repository, id: string) =>
    queryOptions({
      queryKey: {{singular.camel}}Keys.detail(id),
      queryFn: () => repository.get(id),
    }),
}

export function use{{plural.pascal}}List(query: {{singular.pascal}}ListQuery = {}) {
  const repository = useRepositories().{{plural.camel}}
  return useQuery({{singular.camel}}Queries.list(repository, query))
}

export function use{{singular.pascal}}Detail(id: string) {
  const repository = useRepositories().{{plural.camel}}
  return useQuery({{singular.camel}}Queries.detail(repository, id))
}

export function useCreate{{singular.pascal}}() {
  const repository = useRepositories().{{plural.camel}}
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {{singular.pascal}}Input) => repository.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: {{singular.camel}}Keys.all }),
  })
}

export function useUpdate{{singular.pascal}}() {
  const repository = useRepositories().{{plural.camel}}
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: {{singular.pascal}}Input }) =>
      repository.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: {{singular.camel}}Keys.all }),
  })
}

export function useRemove{{singular.pascal}}() {
  const repository = useRepositories().{{plural.camel}}
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => repository.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: {{singular.camel}}Keys.all }),
  })
}
