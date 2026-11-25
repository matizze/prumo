import { mockRoute } from '@matizze/prumo-core/http'
import { ENDPOINT, type {{action.pascal}}Response } from '../types/{{action.kebab}}'

export const {{action.camel}}Routes = mockRoute(ENDPOINT, (): {{action.pascal}}Response => {{mock.response}})
