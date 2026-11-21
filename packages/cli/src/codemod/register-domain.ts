import path from 'node:path'
import { Node, type ExportDeclaration, type ImportDeclaration, type SourceFile } from 'ts-morph'
import { UsageError } from '../errors.ts'
import { afterComma, applyEdits, indentOf, type TextEdit } from './edit.ts'
import type { DomainNames } from './names.ts'
import type { ChangePlan } from './plan.ts'

/** Um arquivo do índice de um domínio, relativo à raiz, para as mensagens de erro. */
function display(plan: ChangePlan, file: string): string {
  return path.relative(plan.project.root, file).split(path.sep).join('/')
}

/** O nome do módulo de um import ou export, ou `''` se não tiver (`export { x }` sem `from`). */
function specifierOf(declaration: ImportDeclaration | ExportDeclaration): string {
  return declaration.getModuleSpecifierValue() ?? ''
}

/** O arquivo de índice, que precisa existir. */
function indexSource(plan: ChangePlan, file: string): SourceFile {
  try {
    return plan.source(file)
  } catch {
    throw new UsageError(`o projeto não tem ${display(plan, file)}.`)
  }
}

/**
 * A edição que acrescenta `line` como uma declaração do topo do arquivo, na posição alfabética:
 * antes da primeira declaração que vem depois da nova (pelo módulo), ou depois da última, se
 * nenhuma vem. Sem nenhuma declaração do grupo, vai depois de `fallback`.
 */
function insertSorted<T extends ImportDeclaration | ExportDeclaration>(
  group: T[],
  specifier: string,
  line: string,
  fallback: Node | undefined,
  where: string,
): TextEdit {
  const next = group.find((declaration) => specifierOf(declaration) > specifier)
  if (next) return { pos: next.getStart(), end: next.getStart(), text: `${line}\n` }
  const last = group[group.length - 1] ?? fallback
  if (!last) throw new UsageError(`não achei onde acrescentar '${specifier}' em ${where}.`)
  return { pos: last.getEnd(), end: last.getEnd(), text: `\n${line}` }
}

/** As aspas e o ponto e vírgula do estilo do arquivo, copiados de uma declaração com módulo. */
function styleOf(declaration: ImportDeclaration | ExportDeclaration | undefined): {
  quote: string
  semicolon: string
} {
  const specifier = declaration?.getModuleSpecifier()
  return {
    quote: specifier ? specifier.getText().charAt(0) : "'",
    semicolon: declaration?.getText().endsWith(';') ? ';' : '',
  }
}

/**
 * O `export * from './entities/<entidade>'` no fim de `src/schemas/index.ts`. A ordem do arquivo
 * é a em que as entidades chegaram, e não a alfabética: o export novo vai depois do último.
 */
export function registerSchema(plan: ChangePlan, to: DomainNames): void {
  const file = path.join(plan.project.src, 'schemas', 'index.ts')
  const where = display(plan, file)
  const index = indexSource(plan, file)
  const specifier = `./entities/${to.singular.kebab}`
  const exports = index.getExportDeclarations()
  if (exports.some((declaration) => specifierOf(declaration) === specifier)) {
    throw new UsageError(`${where} já exporta '${specifier}'.`)
  }
  const last = exports[exports.length - 1]
  if (!last) throw new UsageError(`${where} não tem nenhum export: não sei onde acrescentar.`)
  const { quote, semicolon } = styleOf(last)
  applyEdits(index, [
    {
      pos: last.getEnd(),
      end: last.getEnd(),
      text: `\nexport * from ${quote}${specifier}${quote}${semicolon}`,
    },
  ])
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

/**
 * Registra o repositório em `src/repositories/index.ts`: o `import { create<Dominio>Repository }`,
 * o `export * from` da pasta e a entrada `<dominio>: create<Dominio>Repository` no mapa
 * `factories`, cada um na posição alfabética. O tipo do container acompanha o mapa sozinho.
 */
export function registerRepository(plan: ChangePlan, to: DomainNames): void {
  const file = path.join(plan.project.src, 'repositories', 'index.ts')
  const where = display(plan, file)
  const index = indexSource(plan, file)
  const specifier = `./${to.plural.kebab}`
  const factory = `create${to.plural.pascal}Repository`
  const key = to.plural.camel

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
  const entry = `${key}: ${factory}`
  let factoryEdit: TextEdit
  if (next) {
    factoryEdit = { pos: next.getStart(), end: next.getStart(), text: `${entry},\n${indent}` }
  } else if (last) {
    const { end, hasComma } = afterComma(index.getFullText(), last.getEnd())
    factoryEdit = {
      pos: end,
      end,
      text: `${hasComma ? '' : ','}\n${indent}${entry}${hasComma ? ',' : ''}`,
    }
  } else {
    const open = factories.getStart() + 1
    factoryEdit = { pos: open, end: open, text: `\n${indent}${entry},\n` }
  }

  // As posições vêm da árvore de antes de qualquer edição
  applyEdits(index, [
    insertSorted(relativeImports, specifier, importLine, imports[imports.length - 1], where),
    insertSorted(reExports, specifier, exportLine, undefined, where),
    factoryEdit,
  ])
}

/**
 * O `export { <entidade>Keys, <entidade>Queries } from './<dominio>'` em `src/queries/index.ts`,
 * na posição alfabética pelo nome do arquivo, no formato das linhas que já existem.
 */
export function registerQueries(plan: ChangePlan, to: DomainNames): void {
  const file = path.join(plan.project.src, 'queries', 'index.ts')
  const where = display(plan, file)
  const index = indexSource(plan, file)
  const specifier = `./${to.plural.kebab}`
  const exports = index
    .getExportDeclarations()
    .filter((declaration) => declaration.hasModuleSpecifier())
  if (exports.some((declaration) => specifierOf(declaration) === specifier)) {
    throw new UsageError(`${where} já exporta '${specifier}'.`)
  }
  const { quote, semicolon } = styleOf(exports[0])
  const line = `export { ${to.singular.camel}Keys, ${to.singular.camel}Queries } from ${quote}${specifier}${quote}${semicolon}`
  applyEdits(index, [insertSorted(exports, specifier, line, undefined, where)])
}

/** As três costuras de um domínio novo: `schemas`, `repositories` e `queries`. */
export function registerDomain(plan: ChangePlan, to: DomainNames): void {
  registerSchema(plan, to)
  registerRepository(plan, to)
  registerQueries(plan, to)
}
