import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/** Lint dos pacotes (`pnpm lint` na raiz). */
export default defineConfig([
  globalIgnores(['**/dist', '**/node_modules', '**/__fixtures__']),
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    // Código de navegador: providers, hooks e componentes React que o produto importa
    files: ['packages/{core,testing}/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    // Código de Node: plugin de ESLint, análise do projeto, CLI e servidor MCP
    files: ['packages/{rules,cli,mcp}/src/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
])
