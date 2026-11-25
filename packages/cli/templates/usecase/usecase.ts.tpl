import type { Http } from '@matizze/prumo-core/http'
import type { IUseCase } from '@matizze/prumo-core/use-cases'
import { ENDPOINT, {{action.pascal}}Request, {{action.pascal}}Response } from '../types/{{action.kebab}}'

/** {{action.title}} (domínio {{domain.kebab}}). */
export class {{action.pascal}}UseCase implements IUseCase<{{action.pascal}}Request, {{action.pascal}}Response> {
  readonly #http: Http

  constructor(http: Http) {
    this.#http = http
  }

  async execute(input: {{action.pascal}}Request): Promise<{{action.pascal}}Response> {
{{usecase.request}}    const response = await this.#http({{usecase.call}})
    return {{action.pascal}}Response.parse(response)
  }
}
