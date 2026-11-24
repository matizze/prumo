import path from 'node:path'
import type { SourceFile } from 'ts-morph'
import { UsageError } from '../errors.ts'
import type { DomainNames } from '../lib/names.ts'
import type { ChangePlan } from '../lib/plan.ts'
import { displayPath } from '../lib/paths.ts'
import { afterLine, applyEdits, specifierOf, styleOf, type TextEdit } from './edit.ts'

/** A edição que acrescenta `line` no fim do arquivo, em linha própria (o índice sem nenhum export: vazio ou só com comentários). */
function appendLine(file: SourceFile, line: string): TextEdit {
  const text = file.getFullText()
  const end = text.length
  return { pos: end, end, text: `${text === '' || text.endsWith('\n') ? '' : '\n'}${line}\n` }
}

/**
 * O `export * from './entities/<entidade>'` no fim de `src/schemas/index.ts`. A ordem do arquivo
 * é a em que as entidades chegaram, e não a alfabética: o export novo vai depois do último (ou no
 * fim do arquivo, se ele ainda não tem nenhum). `UsageError` se o índice não existe ou se já
 * exporta a entidade.
 */
export function registerSchema(plan: ChangePlan, to: DomainNames): void {
  const file = path.join(plan.project.src, 'schemas', 'index.ts')
  const where = displayPath(plan.project.root, file)
  if (!plan.hasFile(file)) throw new UsageError(`o projeto não tem ${where}.`)
  const index = plan.source(file)
  const specifier = `./entities/${to.singular.kebab}`
  const exports = index.getExportDeclarations()
  if (exports.some((declaration) => specifierOf(declaration) === specifier)) {
    throw new UsageError(`${where} já exporta '${specifier}'.`)
  }
  const last = exports[exports.length - 1]
  const { quote, semicolon } = styleOf(last)
  const line = `export * from ${quote}${specifier}${quote}${semicolon}`
  applyEdits(index, [last ? afterLine(index, last, line) : appendLine(index, line)])
}
