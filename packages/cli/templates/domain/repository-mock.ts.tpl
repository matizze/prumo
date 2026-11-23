import type { Page } from '@matizze/prumo-core/data'
import { UIError } from '@matizze/prumo-core/errors'
import { matchesSearch, paginate, sortBy, wait } from '@matizze/prumo-core/mock'
import type { {{singular.pascal}}Input, {{singular.pascal}}ListQuery, {{singular.pascal}}Schema } from '@/schemas'
import { MOCK_{{plural.constant}} } from './fixtures'
import type { I{{plural.pascal}}Repository } from './repository.contract'

export interface Mock{{plural.pascal}}RepositoryOptions {
  /** Latência simulada por operação, em ms (padrão 300). Use 0 em testes. */
  latencyMs?: number
}

export class Mock{{plural.pascal}}Repository implements I{{plural.pascal}}Repository {
  private readonly items: {{singular.pascal}}Schema[] = [...MOCK_{{plural.constant}}]
  private readonly latencyMs: number
  private sequence = MOCK_{{plural.constant}}.length

  constructor({ latencyMs = 300 }: Mock{{plural.pascal}}RepositoryOptions = {}) {
    this.latencyMs = latencyMs
  }

  async list(query: {{singular.pascal}}ListQuery = {}): Promise<Page<{{singular.pascal}}Schema>> {
    await wait(this.latencyMs)
    const filtered = this.items.filter((item) => matchesSearch([{{fields.search}}], query.search))
    const sorted = sortBy(filtered, query.sort, {
{{fields.sortAccessors}}
    })
    return paginate(sorted, query.page, query.page_size)
  }

  async get(id: string): Promise<{{singular.pascal}}Schema> {
    await wait(this.latencyMs)
    return this.find(id).item
  }

  async create(input: {{singular.pascal}}Input): Promise<{{singular.pascal}}Schema> {
    await wait(this.latencyMs)
    this.sequence += 1
    const item: {{singular.pascal}}Schema = {
      id: `{{singular.kebab}}-${this.sequence}`,
{{fields.create}}
      createdAt: new Date().toISOString(),
    }
    this.items.push(item)
    return item
  }

  async update(id: string, input: Partial<{{singular.pascal}}Input>): Promise<{{singular.pascal}}Schema> {
    await wait(this.latencyMs)
    const { at, item } = this.find(id)
    // Troca o objeto em vez de mexer nele: as fixtures e o que já foi devolvido não mudam
    const updated = { ...item, ...input }
    this.items[at] = updated
    return updated
  }

  async remove(id: string): Promise<void> {
    await wait(this.latencyMs)
    this.items.splice(this.find(id).at, 1)
  }

  private find(id: string): { at: number; item: {{singular.pascal}}Schema } {
    const at = this.items.findIndex((candidate) => candidate.id === id)
    const item = this.items[at]
    if (!item) throw new UIError('{{singular.constant}}_NOT_FOUND', 'Registro não encontrado.')
    return { at, item }
  }
}
