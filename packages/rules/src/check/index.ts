import { checkComponentsFolders } from './components-folders.ts'
import { checkMessages } from './messages.ts'
import { resolveOptions } from './options.ts'
import { checkPageStructure } from './page-structure.ts'
import { checkSharedUsage } from './shared-usage.ts'
import type { CheckOptions, Violation } from './types.ts'

export type { CheckOptions, CheckRule, Violation } from './types.ts'

/**
 * Analisa o projeto inteiro e devolve as violações das regras que o ESLint não vê, porque
 * olham o conjunto de arquivos: as pastas de `src/components`, o uso de `components/shared`
 * pelas telas, a estrutura de cada tela e os textos completos nos idiomas. Sem violação, a
 * lista vem vazia. A ordem é a das verificações e, dentro de cada uma, a das pastas.
 *
 * ```ts
 * import { check } from '@matizze/prumo-rules/check'
 *
 * const violations = check({ root: process.cwd() })
 * ```
 */
export function check(options: CheckOptions): Violation[] {
  const resolved = resolveOptions(options)
  return [
    ...checkComponentsFolders(resolved),
    ...checkSharedUsage(resolved),
    ...checkPageStructure(resolved),
    ...checkMessages(resolved),
  ]
}
