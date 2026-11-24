import type { MockRequest } from '@matizze/prumo-core/http'
{{mock.schemaImport}}import { {{plural.camel}}Collection } from './collection.mock'
import { ENDPOINT } from './{{action.kebab}}.types'

type Call = MockRequest<`${typeof ENDPOINT.method} ${typeof ENDPOINT.path}`>

/** A rota de mock do `ENDPOINT`, sobre a coleção que os use cases de {{plural.kebab}} dividem. */
export const {{action.camel}}Routes = {
  [`${ENDPOINT.method} ${ENDPOINT.path}` as const]: ({{mock.params}}: Call) =>
    {{mock.body}},
}
