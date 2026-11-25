import { ENDPOINT, type {{action.pascal}}Response } from '../types/{{action.kebab}}'

export const {{action.camel}}Routes = {
  [`${ENDPOINT.method} ${ENDPOINT.path}` as const]: (): {{action.pascal}}Response => {{mock.response}},
}
