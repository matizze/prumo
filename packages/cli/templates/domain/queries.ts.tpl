import type { Page } from '@matizze/prumo-core/data'
import { createQueryKeys } from '@matizze/prumo-core/query'
import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useRepositories } from '@/providers/repository'
import type { I{{plural.pascal}}Repository } from '@/repositories'
import type {
  {{singular.pascal}}Input,
  {{singular.pascal}}ListQuery,
  {{singular.pascal}}Schema,
} from '@/schemas'

// `all` é o prefixo de tudo deste domínio; `lists` é o de todas as listas (qualquer consulta), sem os detalhes
export const {{singular.camel}}Keys = createQueryKeys('{{plural.kebab}}', {
  lists: ['list'],
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

/** As opções do `useQuery` que a lista aceita (`enabled`, `placeholderData`, `staleTime`...); a chave e a função de busca são do domínio. */
export type {{plural.pascal}}ListOptions = Omit<
  UseQueryOptions<
    Page<{{singular.pascal}}Schema>,
    Error,
    Page<{{singular.pascal}}Schema>,
    ReturnType<typeof {{singular.camel}}Keys.list>
  >,
  'queryKey' | 'queryFn'
>

/**
 * A lista. Ao mudar a consulta (busca, página, filtro), os dados da consulta anterior ficam na tela
 * até os novos chegarem (`placeholderData: keepPreviousData`), então `isPending` só é `true` na
 * primeira carga; `isPlaceholderData` diz que o que aparece ainda é o da consulta anterior.
 * Para voltar ao carregando a cada consulta, tire a linha `placeholderData` do hook.
 */
export function use{{plural.pascal}}List(
  query: {{singular.pascal}}ListQuery = {},
  options: {{plural.pascal}}ListOptions = {},
) {
  const repository = useRepositories().{{plural.camel}}
  return useQuery({
    ...{{singular.camel}}Queries.list(repository, query),
    placeholderData: keepPreviousData,
    ...options,
  })
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
    mutationFn: ({ id, input }: { id: string; input: Partial<{{singular.pascal}}Input> }) =>
      repository.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: {{singular.camel}}Keys.all }),
  })
}

export function useRemove{{singular.pascal}}() {
  const repository = useRepositories().{{plural.camel}}
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => repository.remove(id),
    // O detalhe do registro removido sai do cache em vez de ser buscado de novo (daria `*_NOT_FOUND`);
    // só as listas são buscadas outra vez
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: {{singular.camel}}Keys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: {{singular.camel}}Keys.lists })
    },
  })
}
