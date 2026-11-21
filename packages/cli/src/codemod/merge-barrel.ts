import { readFileSync } from 'node:fs'
import path from 'node:path'
import { UsageError } from '../errors.ts'
import { applyEdits } from './edit.ts'
import type { ChangePlan } from './plan.ts'

/** Os `export ... from '<módulo>'` de um texto, na ordem, com o módulo e o texto da linha. */
function reExports(plan: ChangePlan, text: string): { specifier: string; text: string }[] {
  const file = plan.morph.createSourceFile('__barrel__.ts', text, { overwrite: true })
  try {
    return file
      .getExportDeclarations()
      .filter((declaration) => declaration.hasModuleSpecifier())
      .map((declaration) => ({
        specifier: declaration.getModuleSpecifierValue() ?? '',
        text: declaration.getText(),
      }))
  } finally {
    plan.morph.removeSourceFile(file)
  }
}

/**
 * Costura de um barrel que passa a ser do produto (`src/schemas/index.ts`): acrescenta, no fim da
 * lista de exports do arquivo do projeto, os `export ... from` do barrel da origem que ele ainda
 * não tem (a comparação é pelo módulo), na ordem da origem. Nunca remove nem reordena o que o
 * projeto já tem. Devolve os módulos que acrescentou. `UsageError` se o projeto não tem nenhum
 * export no barrel (não há onde acrescentar).
 */
export function mergeBarrel(plan: ChangePlan, file: string, originFile: string): string[] {
  const index = plan.source(file)
  const present = new Set(
    index
      .getExportDeclarations()
      .filter((declaration) => declaration.hasModuleSpecifier())
      .map((declaration) => declaration.getModuleSpecifierValue()),
  )
  const missing = reExports(plan, readFileSync(originFile, 'utf8')).filter(
    (item) => !present.has(item.specifier),
  )
  if (missing.length === 0) return []

  const last = index.getExportDeclarations().at(-1)
  if (!last) {
    throw new UsageError(
      `o barrel '${path.relative(plan.project.root, file)}' não tem nenhum export: não sei onde acrescentar.`,
    )
  }
  applyEdits(index, [
    {
      pos: last.getEnd(),
      end: last.getEnd(),
      text: `\n${missing.map((item) => item.text).join('\n')}`,
    },
  ])
  return missing.map((item) => item.specifier)
}
