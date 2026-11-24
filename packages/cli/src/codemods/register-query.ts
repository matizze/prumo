import path from 'node:path'
import { UsageError } from '../errors.ts'
import type { ChangePlan } from '../lib/plan.ts'
import { applyEdits, type TextEdit } from './edit.ts'
import { insertSorted, specifierOf, styleOf } from './register-repository.ts'

/** O que um domínio exporta de `src/queries/index.ts`. */
export interface QueriesEntry {
  /** O arquivo em `src/queries`, sem a extensão: `clientes`. */
  module: string
  /** Os nomes reexportados: `clienteKeys`, `clienteQueries`. */
  exports: string[]
}

/** O arquivo, relativo à raiz, para as mensagens de erro. */
function display(plan: ChangePlan, file: string): string {
  return path.relative(plan.project.root, file).split(path.sep).join('/')
}

/** O container de queries `src/queries/index.ts`, que precisa existir. */
function queriesFile(plan: ChangePlan): string {
  const file = path.join(plan.project.src, 'queries', 'index.ts')
  if (!plan.hasFile(file)) throw new UsageError(`o projeto não tem ${display(plan, file)}.`)
  return file
}

/** Se `src/queries/index.ts` já reexporta o módulo (`export { ... } from './<módulo>'`). */
export function isQueriesRegistered(plan: ChangePlan, module: string): boolean {
  return plan
    .source(queriesFile(plan))
    .getExportDeclarations()
    .some((declaration) => declaration.hasModuleSpecifier() && specifierOf(declaration) === `./${module}`)
}

/**
 * O `export { <nomes> } from './<módulo>'` em `src/queries/index.ts`, na posição alfabética pelo
 * nome do arquivo, no formato das linhas que já existem. Sem nenhum export (o índice de um
 * projeto novo, só com o comentário), o primeiro vai no fim do arquivo.
 */
export function registerQueriesEntry(plan: ChangePlan, entry: QueriesEntry): void {
  const file = queriesFile(plan)
  const where = display(plan, file)
  const index = plan.source(file)
  const specifier = `./${entry.module}`
  const exports = index.getExportDeclarations().filter((declaration) => declaration.hasModuleSpecifier())
  if (exports.some((declaration) => specifierOf(declaration) === specifier)) {
    throw new UsageError(`${where} já exporta '${specifier}'.`)
  }
  const { quote, semicolon } = styleOf(exports[0])
  const line = `export { ${entry.exports.join(', ')} } from ${quote}${specifier}${quote}${semicolon}`
  let edit: TextEdit
  if (exports.length > 0) {
    edit = insertSorted(exports, specifier, line, undefined, where)
  } else {
    const text = index.getFullText()
    edit = { pos: text.length, end: text.length, text: `${text === '' || text.endsWith('\n') ? '' : '\n'}${line}\n` }
  }
  applyEdits(index, [edit])
}
