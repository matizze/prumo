import { createMockCollection } from '@matizze/prumo-core/mock'
import type { {{singular.pascal}}Schema } from '@/schemas'

// Dados de exemplo do mock: troque pelos do seu domínio.
export const MOCK_{{plural.constant}}: {{singular.pascal}}Schema[] = [
{{fields.fixtures}}
]

/** Os registros em memória que as rotas de mock de {{plural.kebab}} dividem: criar e depois listar mostra o item novo. */
export const {{plural.camel}}Collection = createMockCollection(MOCK_{{plural.constant}}, {
  idPrefix: '{{singular.kebab}}',
  searchFields: (item) => [{{fields.searchList}}],
  sortFields: {
{{fields.sortAccessors}}
  },
})
