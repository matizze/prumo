import path from 'node:path'
import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { afterAll, describe, it } from 'vitest'

// O RuleTester do ESLint usa os globais do runner; o Vitest não os expõe, então ligamos à mão.
Object.assign(RuleTester, { afterAll, describe, it, itOnly: it.only })

/** RuleTester com o parser do typescript-eslint, que lê TS e TSX. */
export function createRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  })
}

/** Caminho de arquivo num projeto fictício, para os casos de teste. */
export function inProject(file: string): string {
  return path.join('/project', file)
}
