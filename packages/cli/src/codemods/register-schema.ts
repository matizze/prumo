import path from 'node:path'
import { type ExportDeclaration, type ImportDeclaration, type SourceFile } from 'ts-morph'
import { UsageError } from '../errors.ts'
import type { DomainNames } from '../lib/names.ts'
import type { ChangePlan } from '../lib/plan.ts'
import { applyEdits, type TextEdit } from './edit.ts'

/** O arquivo, relativo à raiz, para as mensagens de erro. */
function display(plan: ChangePlan, file: string): string {
  return path.relative(plan.project.root, file).split(path.sep).join('/')
}

/** O nome do módulo de um import ou export, ou `''` se não tiver (`export { x }` sem `from`). */
function specifierOf(declaration: ImportDeclaration | ExportDeclaration): string {
  return declaration.getModuleSpecifierValue() ?? ''
}

/** A edição que acrescenta `line` no fim do arquivo, em linha própria (o índice sem nenhum export: vazio ou só com comentários). */
function appendLine(file: SourceFile, line: string): TextEdit {
  const text = file.getFullText()
  const end = text.length
  return { pos: end, end, text: `${text === '' || text.endsWith('\n') ? '' : '\n'}${line}\n` }
}

/**
 * A edição que acrescenta `line` na linha de baixo do último export: depois do fim da linha e dos
 * comentários que começam nela (`// nota`, `/* nota *\/`, até um de bloco que passa para as
 * linhas seguintes), para o export novo nunca cair dentro de um comentário e o comentário ficar
 * com o export dele.
 */
export function afterLine(file: SourceFile, last: ExportDeclaration, line: string): TextEdit {
  const text = file.getFullText()
  const comments = last.getTrailingCommentRanges()
  const from = comments.length > 0 ? Math.max(last.getEnd(), comments[comments.length - 1]!.getEnd()) : last.getEnd()
  const newline = text.indexOf('\n', from)
  if (newline === -1) return { pos: text.length, end: text.length, text: `\n${line}\n` }
  return { pos: newline, end: newline, text: `\n${line}` }
}

/** As aspas e o ponto e vírgula do estilo do arquivo, copiados de uma declaração com módulo. */
function styleOf(declaration: ExportDeclaration | undefined): { quote: string; semicolon: string } {
  const specifier = declaration?.getModuleSpecifier()
  return {
    quote: specifier ? specifier.getText().charAt(0) : "'",
    semicolon: declaration?.getText().endsWith(';') ? ';' : '',
  }
}

/**
 * O `export * from './entities/<entidade>'` no fim de `src/schemas/index.ts`. A ordem do arquivo
 * é a em que as entidades chegaram, e não a alfabética: o export novo vai depois do último (ou no
 * fim do arquivo, se ele ainda não tem nenhum). `UsageError` se o índice não existe ou se já
 * exporta a entidade.
 */
export function registerSchema(plan: ChangePlan, to: DomainNames): void {
  const file = path.join(plan.project.src, 'schemas', 'index.ts')
  const where = display(plan, file)
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
