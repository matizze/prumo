import type { IUseCase } from '@matizze/prumo-core/use-cases'
import { {{action.pascal}}Request, {{action.pascal}}Response } from '../types/{{action.kebab}}'

const STORAGE_KEY = '{{domain.kebab}}:{{action.kebab}}'

/** {{action.title}} (domínio {{domain.kebab}}), no `storage` do navegador. */
export class {{action.pascal}}UseCase implements IUseCase<{{action.pascal}}Request, {{action.pascal}}Response> {
  readonly #storage: Storage

  constructor(storage: Storage) {
    this.#storage = storage
  }

  async execute(input: {{action.pascal}}Request): Promise<{{action.pascal}}Response> {
{{usecase.rule}}
  }
}
