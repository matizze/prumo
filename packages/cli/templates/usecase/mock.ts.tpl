import { ENDPOINT, type {{action.pascal}}Output } from './{{action.kebab}}.types'

/** A rota de mock do `ENDPOINT`: uma resposta de exemplo, no formato do Output. */
export const {{action.camel}}Routes = {
  [`${ENDPOINT.method} ${ENDPOINT.path}` as const]: (): {{action.pascal}}Output => {{mock.response}},
}
