import { mockRoute } from '@matizze/prumo-core/http'
{{mock.schemaImport}}import { ENDPOINT } from '../types/{{action.kebab}}'
import { {{plural.camel}}Collection } from './collection'

export const {{action.camel}}Routes = mockRoute(ENDPOINT, ({{mock.params}}) =>
  {{mock.body}},
)
