import { UIError } from '@matizze/prumo-core/errors'
import { HttpError, type Http } from '@matizze/prumo-core/http'
import type { IUseCase } from '@matizze/prumo-core/use-cases'
import { ENDPOINT, {{action.pascal}}Input, {{action.pascal}}Output } from './{{action.kebab}}.types'

/** {{action.title}} (domínio {{domain.kebab}}). */
export class {{action.pascal}}UseCase implements IUseCase<{{action.pascal}}Input, {{action.pascal}}Output> {
  readonly #http: Http

  constructor(http: Http) {
    this.#http = http
  }

  /** Um erro da API vira `UIError` {{action.constant}}_FAILED. */
  async execute(input: {{action.pascal}}Input): Promise<{{action.pascal}}Output> {
{{usecase.request}}
    try {
      const response = await this.#http({{usecase.call}})
      return {{action.pascal}}Output.parse(response)
    } catch (error) {
      if (error instanceof HttpError) throw new UIError('{{action.constant}}_FAILED', error.message)
      throw error
    }
  }
}
