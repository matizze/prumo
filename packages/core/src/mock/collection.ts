import type { Page } from '../data/index.ts'
import { HttpError } from '../http/http.ts'
import { matchesSearch, paginate, sortBy } from './mock-utils.ts'

/** O que toda entidade da coleção tem: o `id` e a data de criação (ISO). */
export interface CollectionItem {
  id: string
  createdAt: string
}

/** O que `create` recebe: a entidade sem o que a coleção gera. */
export type CollectionInput<T extends CollectionItem> = Omit<T, 'id' | 'createdAt'>

export interface MockCollectionOptions<T extends CollectionItem> {
  /** Prefixo dos ids gerados: `livro` dá `livro-4`, `livro-5`... */
  idPrefix: string
  /** Os textos em que o `search` procura. */
  searchFields: (item: T) => string[]
  /** Como ler cada campo ordenável. Sem ele, o `sort` lê a propriedade de mesmo nome. */
  sortFields?: Record<string, (item: T) => string | number>
}

/** A consulta do `list`. Aceita números ou textos (a query string de uma rota chega em texto). */
export interface CollectionListQuery {
  search?: string
  /** `<campo>:<asc|desc>`, como em `createdAt:desc`. */
  sort?: string
  /** A página, a partir de 1. */
  page?: number | string
  page_size?: number | string
}

/** Uma coleção em memória: o "banco" que os mocks das rotas de um CRUD dividem. */
export interface MockCollection<T extends CollectionItem> {
  list(query?: CollectionListQuery): Page<T>
  /** Lança `HttpError(404)` quando o id não existe. */
  get(id: string): T
  /** Gera o `id` e o `createdAt`. */
  create(input: CollectionInput<T>): T
  /** Muda só os campos enviados (`undefined` não muda) e devolve o registro inteiro. 404 sem o id. */
  update(id: string, changes: Partial<CollectionInput<T>>): T
  /** Lança `HttpError(404)` quando o id não existe. */
  remove(id: string): void
  /** Volta às fixtures de partida (para um teste não ver o estado do outro). */
  reset(): void
}

function toNumber(value: number | string | undefined, name: string): number | undefined {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new HttpError(400, `${name} inválido: "${value}".`)
  return parsed
}

/**
 * Cria a coleção em memória a partir das `fixtures` (que não são alteradas: a coleção parte de
 * uma cópia). Os erros são `HttpError`, porque o mock mora no transporte.
 *
 * ```ts
 * const livros = createMockCollection(MOCK_LIVROS, {
 *   idPrefix: 'livro',
 *   searchFields: (livro) => [livro.title],
 * })
 * createMockHttp({ 'GET /livros': ({ query }) => livros.list(query) })
 * ```
 */
export function createMockCollection<T extends CollectionItem>(
  fixtures: readonly T[],
  { idPrefix, searchFields, sortFields }: MockCollectionOptions<T>,
): MockCollection<T> {
  let items: T[] = []
  let sequence = 0

  const reset = () => {
    items = structuredClone([...fixtures])
    sequence = items.length
  }
  reset()

  const find = (id: string) => {
    const at = items.findIndex((candidate) => candidate.id === id)
    const item = items[at]
    if (!item) throw new HttpError(404, `Registro não encontrado: ${id}`)
    return { at, item }
  }

  const accessors = (key: string) => {
    const custom = sortFields?.[key]
    if (custom) return custom
    if (sortFields) throw new HttpError(400, `Campo de ordenação desconhecido: "${key}".`)
    return (item: T) => {
      const value: unknown = Reflect.get(item, key)
      return typeof value === 'number' ? value : String(value ?? '')
    }
  }

  return {
    list({ search, sort, page, page_size } = {}) {
      const filtered = items.filter((item) => matchesSearch(searchFields(item), search))
      let parsedSort: { key: string; direction: 'asc' | 'desc' } | undefined
      if (sort) {
        const [key, direction = 'asc'] = sort.split(':')
        if (!key || (direction !== 'asc' && direction !== 'desc')) {
          throw new HttpError(400, `sort inválido: "${sort}". Use <campo>:<asc|desc>.`)
        }
        parsedSort = { key, direction }
      }
      const get = parsedSort ? accessors(parsedSort.key) : undefined
      const sorted =
        parsedSort && get ? sortBy(filtered, parsedSort, { [parsedSort.key]: get }) : filtered
      return paginate(sorted, toNumber(page, 'page'), toNumber(page_size, 'page_size'))
    },

    get: (id) => find(id).item,

    create(input) {
      sequence += 1
      while (items.some((item) => item.id === `${idPrefix}-${sequence}`)) sequence += 1
      const item = {
        ...input,
        id: `${idPrefix}-${sequence}`,
        createdAt: new Date().toISOString(),
      } as unknown as T
      items.push(item)
      return item
    },

    update(id, changes) {
      const { at, item } = find(id)
      // Troca o objeto em vez de mexer nele: o que já foi devolvido não muda
      const defined = Object.fromEntries(
        Object.entries(changes).filter(([, value]) => value !== undefined),
      )
      const updated = { ...item, ...defined }
      items[at] = updated
      return updated
    },

    remove(id) {
      items.splice(find(id).at, 1)
    },

    reset,
  }
}
