import type { Page } from '@matizze/prumo-core/data'
import type { {{singular.pascal}}Input, {{singular.pascal}}ListQuery, {{singular.pascal}}Schema } from '@/schemas'

export interface I{{plural.pascal}}Repository {
  list(query?: {{singular.pascal}}ListQuery): Promise<Page<{{singular.pascal}}Schema>>
  /** Rejeita com `UIError('{{singular.constant}}_NOT_FOUND')` quando o id não existe. */
  get(id: string): Promise<{{singular.pascal}}Schema>
  create(input: {{singular.pascal}}Input): Promise<{{singular.pascal}}Schema>
  /**
   * Muda só os campos enviados (os que faltam ficam como estão) e devolve o registro inteiro.
   * Rejeita com `UIError('{{singular.constant}}_NOT_FOUND')` quando o id não existe.
   */
  update(id: string, input: Partial<{{singular.pascal}}Input>): Promise<{{singular.pascal}}Schema>
  /** Rejeita com `UIError('{{singular.constant}}_NOT_FOUND')` quando o id não existe. */
  remove(id: string): Promise<void>
}
