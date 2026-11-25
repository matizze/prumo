import { createMockCollection } from '@matizze/prumo-core/mock'
import type { {{singular.pascal}}Schema } from '@/schemas'

export const MOCK_{{plural.constant}}: {{singular.pascal}}Schema[] = [
{{fields.fixtures}}
]

export const {{plural.camel}}Collection = createMockCollection(MOCK_{{plural.constant}}, {
  idPrefix: '{{singular.kebab}}',
  searchFields: (item) => [{{fields.searchList}}],
  sortFields: {
{{fields.sortAccessors}}
  },
})
