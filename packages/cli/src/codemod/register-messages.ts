import path from 'node:path'
import {
  Node,
  type ImportDeclaration,
  type ObjectLiteralExpression,
  type SourceFile,
} from 'ts-morph'
import { UsageError } from '../errors.ts'
import { afterComma, applyEdits, indentOf, type TextEdit } from './edit.ts'
import { messageLanguages } from './messages.ts'
import type { ChangePlan } from './plan.ts'

/** O nome do arquivo de um import de JSON: `./products-list.json` vira `products-list`. */
function importedFile(declaration: ImportDeclaration): string {
  return path.basename(declaration.getModuleSpecifierValue(), '.json')
}

/** A edição que acrescenta o import do JSON na posição alfabética, pelo nome do arquivo. */
function importEdit(index: SourceFile, file: string, camel: string): TextEdit {
  const imports = index.getImportDeclarations()
  const last = imports[imports.length - 1]
  if (!last) throw new UsageError(`'${index.getFilePath()}' não tem imports de mensagens.`)

  const quote = last.getModuleSpecifier().getText().charAt(0)
  const semicolon = last.getText().endsWith(';') ? ';' : ''
  const line = `import ${camel} from ${quote}./${file}.json${quote}${semicolon}`

  const next = imports.find((declaration) => importedFile(declaration) > file)
  if (next) return { pos: next.getStart(), end: next.getStart(), text: `${line}\n` }
  return { pos: last.getEnd(), end: last.getEnd(), text: `\n${line}` }
}

/** O objeto do `export default { ... }` do índice de mensagens. */
function messagesObject(index: SourceFile): ObjectLiteralExpression {
  const expression = index
    .getExportAssignment((assignment) => !assignment.isExportEquals())
    ?.getExpression()
  if (!expression || !Node.isObjectLiteralExpression(expression)) {
    throw new UsageError(
      `'${index.getFilePath()}' não tem um 'export default { ... }' com os namespaces.`,
    )
  }
  return expression
}

/** A edição que acrescenta a chave do namespace no objeto, na posição alfabética. */
function keyEdit(index: SourceFile, camel: string): TextEdit {
  const object = messagesObject(index)
  const properties = object.getProperties()
  const last = properties[properties.length - 1]
  const indent = last ? indentOf(index.getFullText(), last.getStart()) : '  '

  const next = properties.find(
    (property) => Node.isShorthandPropertyAssignment(property) && property.getName() > camel,
  )
  if (next) return { pos: next.getStart(), end: next.getStart(), text: `${camel},\n${indent}` }
  if (!last)
    return {
      pos: object.getStart() + 1,
      end: object.getStart() + 1,
      text: `\n${indent}${camel},\n`,
    }
  const { end, hasComma } = afterComma(index.getFullText(), last.getEnd())
  return { pos: end, end, text: `${hasComma ? '' : ','}\n${indent}${camel}${hasComma ? ',' : ''}` }
}

/**
 * Os namespaces que o índice já registra, com o arquivo de cada um quando é um import: as chaves
 * do `export default { ... }` e os nomes locais dos imports de JSON.
 */
function registeredNamespaces(index: SourceFile): Map<string, string | undefined> {
  const namespaces = new Map<string, string | undefined>()
  for (const declaration of index.getImportDeclarations()) {
    const local = declaration.getDefaultImport()?.getText()
    if (local !== undefined) namespaces.set(local, importedFile(declaration))
  }
  for (const property of messagesObject(index).getProperties()) {
    if (Node.isShorthandPropertyAssignment(property) || Node.isPropertyAssignment(property)) {
      const key = property.getName()
      if (!namespaces.has(key)) namespaces.set(key, undefined)
    }
  }
  return namespaces
}

/**
 * Acrescenta o import e a chave do namespace no `index.ts` do idioma, cada um na posição
 * alfabética. As duas posições vêm da árvore de antes de qualquer edição.
 */
function addToIndex(index: SourceFile, file: string, camel: string): void {
  applyEdits(index, [importEdit(index, file, camel), keyEdit(index, camel)])
}

/**
 * Registra no `index.ts` de cada idioma do projeto um namespace cujo JSON já está (ou vai estar,
 * pelo plano) em `src/messages/<idioma>/<file>.json`: o import e a chave de `export default`,
 * cada um na posição alfabética (antes do primeiro que vem depois dele; no fim, se nenhum vem).
 * `camel` é o namespace: `produtos`. O namespace que o índice já registra com o mesmo arquivo
 * fica como está, o que deixa o registro repetível. Registrado com outro arquivo (`error404`
 * para `error-404.json`, ou um `import` do produto com o mesmo nome local): `UsageError`, sem
 * escrever nada.
 */
export function registerMessageNamespace(plan: ChangePlan, file: string, camel: string): void {
  for (const language of messageLanguages(plan.project)) {
    const index = plan.source(path.join(plan.project.messages, language, 'index.ts'))
    const registered = registeredNamespaces(index)
    if (registered.has(camel)) {
      if (registered.get(camel) === file) continue
      throw new UsageError(
        `src/messages/${language}/index.ts já registra o namespace '${camel}' com outro arquivo (${registered.get(camel) ?? 'sem import de JSON'}): o novo é '${file}.json' (o hífen e os números não mudam o nome em camelCase).`,
      )
    }
    addToIndex(index, file, camel)
  }
}
