import { z } from 'zod'

/** Página de uma listagem: `total` conta todos os itens que casam com a consulta (sem paginar). */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), total: z.number().int() })
}

export interface Page<T> {
  items: T[]
  total: number
}

export type SortDirection = 'asc' | 'desc'

/** Paginação comum das consultas. `page` começa em 1; sem `page_size` devolve tudo (ex.: exportar). */
export interface PageQuery {
  page?: number
  page_size?: number
}

export interface Sort<K extends string> {
  key: K
  direction: SortDirection
}

/** Intervalo de datas ISO (AAAA-MM-DD), inclusivo. */
export interface DateRange {
  from: string
  to: string
}
