import { z } from 'zod'
import type { PageQuery, Sort } from '@matizze/prumo-core/data'

export const {{singular.camel}}Schema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
})

export type {{singular.pascal}}Schema = z.infer<typeof {{singular.camel}}Schema>

/** O que se envia para criar ou editar: o `id` e a data são do repositório. */
export const {{singular.camel}}InputSchema = {{singular.camel}}Schema.pick({ name: true })

export type {{singular.pascal}}Input = z.infer<typeof {{singular.camel}}InputSchema>

export type {{singular.pascal}}SortKey = 'name' | 'createdAt'

export interface {{singular.pascal}}ListQuery extends PageQuery {
  /** Busca pelo nome, sem diferenciar maiúsculas e acentos. */
  search?: string
  sort?: Sort<{{singular.pascal}}SortKey>
}
