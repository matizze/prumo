import type { {{singular.pascal}}Schema } from '@/schemas'

// Dados de exemplo do mock: troque pelos do seu domínio.
export const MOCK_{{plural.constant}}: {{singular.pascal}}Schema[] = [
  { id: '{{singular.kebab}}-1', name: 'Exemplo 1', createdAt: '2026-01-05T12:00:00.000Z' },
  { id: '{{singular.kebab}}-2', name: 'Exemplo 2', createdAt: '2026-01-14T12:00:00.000Z' },
  { id: '{{singular.kebab}}-3', name: 'Exemplo 3', createdAt: '2026-01-23T12:00:00.000Z' },
]
