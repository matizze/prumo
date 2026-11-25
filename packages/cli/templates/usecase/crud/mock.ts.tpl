import type { MockRequest } from '@matizze/prumo-core/http'
{{mock.schemaImport}}import { ENDPOINT } from '../types/{{action.kebab}}'
import { {{plural.camel}}Collection } from './collection'

type Call = MockRequest<`${typeof ENDPOINT.method} ${typeof ENDPOINT.path}`>

export const {{action.camel}}Routes = {
  [`${ENDPOINT.method} ${ENDPOINT.path}` as const]: ({{mock.params}}: Call) =>
    {{mock.body}},
}
