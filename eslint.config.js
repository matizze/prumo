import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Lint dos pacotes e do catálogo (`pnpm lint` na raiz). O app de referência tem a própria config, em
 * apps/reference/eslint.config.js, e roda o lint dele no `pnpm verify:reference`.
 */
export default defineConfig([
  globalIgnores(['apps/**', 'starter/**', '**/dist', '**/node_modules', '**/__fixtures__']),
  {
    files: ['packages/*/src/**/*.{ts,tsx}', 'packages/mcp/scripts/**/*.ts', 'catalog/src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    // Código de navegador: providers, hooks e componentes React que o produto importa
    files: ['packages/{core,testing}/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    // Código de Node: plugin de ESLint, análise do projeto, CLI, servidor MCP e gerador do catálogo
    files: [
      'packages/{rules,cli,mcp}/src/**/*.ts',
      'packages/mcp/scripts/**/*.ts',
      'catalog/src/**/*.ts',
    ],
    languageOptions: { globals: globals.node },
  },
])
