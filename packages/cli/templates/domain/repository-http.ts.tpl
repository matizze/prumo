import { pageSchema, type Page } from '@matizze/prumo-core/data'
import { UIError } from '@matizze/prumo-core/errors'
import {
  {{singular.camel}}Schema,
  type {{singular.pascal}}Input,
  type {{singular.pascal}}ListQuery,
  type {{singular.pascal}}Schema,
} from '@/schemas'
import { HttpError, type Http, type HttpRequest } from '../http'
import type { I{{plural.pascal}}Repository } from './repository.contract'

const {{singular.camel}}PageSchema = pageSchema({{singular.camel}}Schema)

/**
 * O repositório que fala com a API por `fetch`. O backend responde no formato do app (a lista é
 * `{ items, total }`, e os campos têm os nomes do schema): este repositório só valida cada resposta
 * com o schema, sem traduzir formato. Se a API usa outro formato, converta aqui.
 *
 * - `GET /{{plural.kebab}}?search=&sort=<campo>:<asc|desc>&page=&page_size=`
 * - `GET /{{plural.kebab}}/:id`
 * - `POST /{{plural.kebab}}`
 * - `PATCH /{{plural.kebab}}/:id` (só os campos enviados)
 * - `DELETE /{{plural.kebab}}/:id`
 *
 * O 404 de um registro vira `UIError('{{singular.constant}}_NOT_FOUND')`, como manda o contrato.
 */
export class Http{{plural.pascal}}Repository implements I{{plural.pascal}}Repository {
  private readonly http: Http

  constructor(http: Http) {
    this.http = http
  }

  async list(query: {{singular.pascal}}ListQuery = {}): Promise<Page<{{singular.pascal}}Schema>> {
    const params = new URLSearchParams()
    if (query.search) params.set('search', query.search)
    if (query.sort) params.set('sort', `${query.sort.key}:${query.sort.direction}`)
    if (query.page) params.set('page', String(query.page))
    if (query.page_size) params.set('page_size', String(query.page_size))
    const search = params.toString()
    return {{singular.camel}}PageSchema.parse(await this.http(`/{{plural.kebab}}${search ? `?${search}` : ''}`))
  }

  async get(id: string): Promise<{{singular.pascal}}Schema> {
    return {{singular.camel}}Schema.parse(await this.existing(this.pathOf(id)))
  }

  async create(input: {{singular.pascal}}Input): Promise<{{singular.pascal}}Schema> {
    return {{singular.camel}}Schema.parse(await this.http('/{{plural.kebab}}', { method: 'POST', body: input }))
  }

  async update(id: string, input: Partial<{{singular.pascal}}Input>): Promise<{{singular.pascal}}Schema> {
    return {{singular.camel}}Schema.parse(await this.existing(this.pathOf(id), { method: 'PATCH', body: input }))
  }

  async remove(id: string): Promise<void> {
    await this.existing(this.pathOf(id), { method: 'DELETE' })
  }

  /** O endereço de um registro, com o id codificado para a URL. */
  private pathOf(id: string): string {
    return `/{{plural.kebab}}/${encodeURIComponent(id)}`
  }

  /** Uma chamada a um registro: o 404 da API é o `{{singular.constant}}_NOT_FOUND` do contrato. */
  private async existing(path: string, request?: HttpRequest): Promise<unknown> {
    try {
      return await this.http(path, request)
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        throw new UIError('{{singular.constant}}_NOT_FOUND', 'Registro não encontrado.')
      }
      throw error
    }
  }
}
