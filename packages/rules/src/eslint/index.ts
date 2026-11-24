import type { ESLint, Linter } from 'eslint'
import pkg from '../../package.json' with { type: 'json' }
import { noCrossPageImport } from './rules/no-cross-page-import.ts'
import { noHttpInPage } from './rules/no-http-in-page.ts'
import { pageStructure } from './rules/page-structure.ts'
import { useCaseImports } from './rules/use-case-imports.ts'

export type { NoCrossPageImportOptions } from './rules/no-cross-page-import.ts'
export type { NoHttpInPageOptions } from './rules/no-http-in-page.ts'
export type { PageStructureOptions } from './rules/page-structure.ts'
export type { UseCaseImportsOptions } from './rules/use-case-imports.ts'

const rules = {
  'no-cross-page-import': noCrossPageImport,
  'no-http-in-page': noHttpInPage,
  'page-structure': pageStructure,
  'use-case-imports': useCaseImports,
}

const recommended: Linter.Config = {
  name: 'prumo/recommended',
  files: ['**/*.{ts,tsx}'],
  rules: {
    'prumo/no-cross-page-import': 'error',
    'prumo/no-http-in-page': 'error',
    'prumo/page-structure': 'error',
    'prumo/use-case-imports': 'error',
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
const plugin: ESLint.Plugin & { rules: typeof rules; configs: { recommended: Linter.Config } } = {
  meta: { name: pkg.name, version: pkg.version },
  rules,
  configs: { recommended },
}

// A config nomeia o plugin que a contém, por isso o plugin existe antes de a config o receber.
recommended.plugins = { prumo: plugin }

export default plugin
