import type { ESLint, Linter } from 'eslint'
import pkg from '../../package.json' with { type: 'json' }
import { uiBoundary } from './rules/ui-boundary.ts'

export type { UiBoundaryOptions } from './rules/ui-boundary.ts'

const rules = {
  'ui-boundary': uiBoundary,
}

const recommended: Linter.Config = {
  name: 'prumo/recommended',
  files: ['**/*.{ts,tsx}'],
  rules: {
    'prumo/ui-boundary': 'error',
  },
}

/**
 * Plugin de ESLint do Prumo, com as regras da arquitetura que se verificam arquivo a arquivo.
 *
 * ```js
 * import prumo from '@matizze/prumo-rules/eslint'
 *
 * export default [prumo.configs.recommended]
 * ```
 */
const plugin = {
  meta: { name: pkg.name, version: pkg.version },
  rules,
  configs: { recommended },
} satisfies ESLint.Plugin

// A config nomeia o plugin que a contém, por isso o plugin existe antes de a config o receber.
recommended.plugins = { prumo: plugin }

export default plugin
