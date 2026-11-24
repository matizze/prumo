import path from 'node:path'
import { Node, type SourceFile } from 'ts-morph'
import { UsageError } from '../errors.ts'
import type { DomainNames } from '../lib/names.ts'
import type { ChangePlan } from '../lib/plan.ts'
import { displayPath } from '../lib/paths.ts'
import { afterComma, applyEdits, indentOf, insertSorted, specifierOf, styleOf, type TextEdit } from './edit.ts'

/** O container `src/repositories/index.ts`, que precisa existir. */
function indexSource(plan: ChangePlan, file: string): SourceFile {
  if (!plan.hasFile(file)) throw new UsageError(`o projeto não tem ${displayPath(plan.project.root, file)}.`)
  return plan.source(file)
}

/** O mapa `factories` de `src/repositories/index.ts`. */
function factoriesObject(index: SourceFile, where: string) {
  const initializer = index.getVariableDeclaration('factories')?.getInitializer()
  if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
    throw new UsageError(`${where} não tem o mapa 'const factories = { ... }'.`)
  }
  return initializer
}

/** O nome de uma propriedade do mapa: `customers` em `customers: createCustomersRepository`. */
function propertyName(property: Node): string | undefined {
  if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
    return property.getName()
  }
  return undefined
}

/** Onde um repositório entra em `src/repositories/index.ts`. */
export interface RepositoryEntry {
  /** A pasta em `src/repositories`, em kebab-case: `customers`. */
  directory: string
  /** A fábrica: `createCustomersRepository`. */
  factory: string
  /** A chave no mapa `factories`: `customers`. */
  key: string
}

/**
 * Registra o repositório em `src/repositories/index.ts`: o `import { <fábrica> }`, o `export *
 * from` da pasta e a entrada `<chave>: <fábrica>` no mapa `factories`, cada um na posição
 * alfabética. O tipo do container acompanha o mapa sozinho.
 */
export function registerRepositoryEntry(plan: ChangePlan, entry: RepositoryEntry): void {
  const file = path.join(plan.project.src, 'repositories', 'index.ts')
  const where = displayPath(plan.project.root, file)
  const index = indexSource(plan, file)
  const specifier = `./${entry.directory}`
  const { factory, key } = entry

  const imports = index.getImportDeclarations()
  const relativeImports = imports.filter((declaration) => specifierOf(declaration).startsWith('./'))
  // `export * from './x'`, sem nomes: o `export { ... } from './options'` não entra
  const reExports = index
    .getExportDeclarations()
    .filter(
      (declaration) =>
        declaration.hasModuleSpecifier() &&
        !declaration.hasNamedExports() &&
        declaration.getNamespaceExport() === undefined,
    )
  if (reExports.some((declaration) => specifierOf(declaration) === specifier)) {
    throw new UsageError(`${where} já exporta '${specifier}'.`)
  }

  const factories = factoriesObject(index, where)
  const properties = factories.getProperties()
  if (properties.some((property) => propertyName(property) === key)) {
    throw new UsageError(`${where} já tem o domínio '${key}' no mapa factories.`)
  }

  const importStyle = styleOf(relativeImports[0] ?? imports[0])
  const exportStyle = styleOf(reExports[0] ?? relativeImports[0] ?? imports[0])
  const importLine = `import { ${factory} } from ${importStyle.quote}${specifier}${importStyle.quote}${importStyle.semicolon}`
  const exportLine = `export * from ${exportStyle.quote}${specifier}${exportStyle.quote}${exportStyle.semicolon}`

  const last = properties[properties.length - 1]
  const indent = last ? indentOf(index.getFullText(), last.getStart()) : '  '
  const next = properties.find((property) => (propertyName(property) ?? '') > key)
  const mapEntry = `${key}: ${factory}`
  let factoryEdit: TextEdit
  if (next) {
    factoryEdit = { pos: next.getStart(), end: next.getStart(), text: `${mapEntry},\n${indent}` }
  } else if (last) {
    const { end, hasComma } = afterComma(index.getFullText(), last.getEnd())
    factoryEdit = {
      pos: end,
      end,
      text: `${hasComma ? '' : ','}\n${indent}${mapEntry}${hasComma ? ',' : ''}`,
    }
  } else {
    const open = factories.getStart() + 1
    factoryEdit = { pos: open, end: open, text: `\n${indent}${mapEntry},\n` }
  }

  // Sem nenhum `export *` (o índice de um projeto novo, sem domínios), o primeiro vai antes do
  // primeiro `export ... from` que o arquivo já tem, ou, se não houver, depois do último import
  const firstExport = index.getExportDeclarations().find((item) => item.hasModuleSpecifier())
  const lastImport = imports[imports.length - 1]
  let exportEdit: TextEdit
  if (reExports.length > 0) {
    exportEdit = insertSorted(reExports, specifier, exportLine, undefined, where)
  } else if (firstExport) {
    exportEdit = {
      pos: firstExport.getStart(),
      end: firstExport.getStart(),
      text: `${exportLine}\n`,
    }
  } else if (lastImport) {
    exportEdit = { pos: lastImport.getEnd(), end: lastImport.getEnd(), text: `\n\n${exportLine}` }
  } else {
    throw new UsageError(`não achei onde acrescentar '${specifier}' em ${where}.`)
  }

  const importEdit = insertSorted(relativeImports, specifier, importLine, lastImport, where)
  // Duas inserções na mesma posição (as duas depois do último import) viram uma só, na ordem
  const sameSpot = importEdit.pos === exportEdit.pos
  // As posições vêm da árvore de antes de qualquer edição
  applyEdits(index, [
    ...(sameSpot
      ? [{ ...importEdit, text: importEdit.text + exportEdit.text }]
      : [importEdit, exportEdit]),
    factoryEdit,
  ])
}

/** O repositório de um domínio novo: a pasta, a fábrica e a chave saem do nome do domínio. */
export function registerRepository(plan: ChangePlan, to: DomainNames): void {
  registerRepositoryEntry(plan, {
    directory: to.plural.kebab,
    factory: `create${to.plural.pascal}Repository`,
    key: to.plural.camel,
  })
}

