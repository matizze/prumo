import type { IUseCase } from '@matizze/prumo-core/use-cases'
import { {{action.pascal}}Input, {{action.pascal}}Output } from './{{action.kebab}}.types'

/** A chave do localStorage deste use case. */
const STORAGE_KEY = '{{domain.kebab}}:{{action.kebab}}'

/** {{action.title}} (domínio {{domain.kebab}}): valida o Input, aplica a regra no `storage` do navegador e valida o Output. */
export class {{action.pascal}}UseCase implements IUseCase<{{action.pascal}}Input, {{action.pascal}}Output> {
  readonly #storage: Storage

  constructor(storage: Storage) {
    this.#storage = storage
  }

  async execute(input: {{action.pascal}}Input): Promise<{{action.pascal}}Output> {
{{usecase.rule}}
  }
}
