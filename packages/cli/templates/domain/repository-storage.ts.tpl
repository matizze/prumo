import { z } from 'zod'
import type { Page } from '@matizze/prumo-core/data'
import { UIError } from '@matizze/prumo-core/errors'
import { matchesSearch, paginate, sortBy, wait } from '@matizze/prumo-core/mock'
import {
  {{singular.camel}}Schema,
  type {{singular.pascal}}Input,
  type {{singular.pascal}}ListQuery,
  type {{singular.pascal}}Schema,
} from '@/schemas'
import { MOCK_{{plural.constant}} } from './fixtures'
import type { I{{plural.pascal}}Repository } from './repository.contract'

/** A chave no localStorage: `<app>:<domínio>`, para dois apps no mesmo endereço não dividirem os dados. */
export const STORAGE_KEY = '{{app.kebab}}:{{plural.kebab}}'

/** O que fica gravado: os registros e o contador dos ids. */
const stateSchema = z.object({
  sequence: z.number().int(),
  items: z.array({{singular.camel}}Schema),
})

type State = z.infer<typeof stateSchema>

export interface Storage{{plural.pascal}}RepositoryOptions {
  /** Latência simulada por operação, em ms (padrão 300). Use 0 em testes. */
  latencyMs?: number
}

/**
 * O mesmo do mock, gravando no `localStorage`: os dados sobrevivem ao recarregar a página. Sem nada
 * gravado (ou com dado que o schema não aceita mais), parte das fixtures.
 */
export class Storage{{plural.pascal}}Repository implements I{{plural.pascal}}Repository {
  private readonly latencyMs: number

  constructor({ latencyMs = 300 }: Storage{{plural.pascal}}RepositoryOptions = {}) {
    this.latencyMs = latencyMs
  }

  async list(query: {{singular.pascal}}ListQuery = {}): Promise<Page<{{singular.pascal}}Schema>> {
    await wait(this.latencyMs)
    {{fields.search}}
    const sorted = sortBy(filtered, query.sort, {
{{fields.sortAccessors}}
    })
    return paginate(sorted, query.page, query.page_size)
  }

  async get(id: string): Promise<{{singular.pascal}}Schema> {
    await wait(this.latencyMs)
    return this.find(this.items, id).item
  }

  async create(input: {{singular.pascal}}Input): Promise<{{singular.pascal}}Schema> {
    await wait(this.latencyMs)
    const state = this.read()
    const sequence = state.sequence + 1
    const item: {{singular.pascal}}Schema = {
      id: `{{singular.kebab}}-${sequence}`,
{{fields.create}}
      createdAt: new Date().toISOString(),
    }
    this.write({ sequence, items: [...state.items, item] })
    return item
  }

  async update(id: string, input: Partial<{{singular.pascal}}Input>): Promise<{{singular.pascal}}Schema> {
    await wait(this.latencyMs)
    const state = this.read()
    const { at, item } = this.find(state.items, id)
    const updated = { ...item, ...input }
    this.write({ ...state, items: state.items.with(at, updated) })
    return updated
  }

  async remove(id: string): Promise<void> {
    await wait(this.latencyMs)
    const state = this.read()
    this.write({ ...state, items: state.items.toSpliced(this.find(state.items, id).at, 1) })
  }

  private get items(): {{singular.pascal}}Schema[] {
    return this.read().items
  }

  private read(): State {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      try {
        return stateSchema.parse(JSON.parse(stored))
      } catch {
        // Dado corrompido ou de um schema antigo: recomeça das fixtures
      }
    }
    return { sequence: MOCK_{{plural.constant}}.length, items: [...MOCK_{{plural.constant}}] }
  }

  private write(state: State): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  private find(
    items: readonly {{singular.pascal}}Schema[],
    id: string,
  ): { at: number; item: {{singular.pascal}}Schema } {
    const at = items.findIndex((candidate) => candidate.id === id)
    const item = items[at]
    if (!item) throw new UIError('{{singular.constant}}_NOT_FOUND', 'Registro não encontrado.')
    return { at, item }
  }
}
