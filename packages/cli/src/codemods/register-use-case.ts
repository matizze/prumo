import path from 'node:path'
import { Node, type ObjectLiteralExpression, type SourceFile } from 'ts-morph'
import { UsageError } from '../errors.ts'
import type { UseCaseNames } from '../lib/names.ts'
import { displayPath } from '../lib/paths.ts'
import type { ChangePlan } from '../lib/plan.ts'
import {
  applyEdits,
  insertMember,
  insertSorted,
  mergeInsertions,
  memberName,
  specifierOf,
  styleOf,
  type TextEdit,
} from './edit.ts'

/** O arquivo de um índice de use cases, que precisa existir. */
function indexSource(plan: ChangePlan, file: string): { index: SourceFile; where: string } {
  const where = displayPath(plan.project.root, file)
  if (!plan.hasFile(file)) {
    throw new UsageError(
      `o projeto não tem ${where}: a camada de use cases vem no app criado pelo prumo new (um app de antes dela precisa ganhar a pasta src/use-cases).`,
    )
  }
  return { index: plan.source(file), where }
}

/** O objeto que `<variável> = { ... }` inicializa. */
function objectOf(index: SourceFile, variable: string, where: string): ObjectLiteralExpression {
  const initializer = index.getVariableDeclaration(variable)?.getInitializer()
  if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
    throw new UsageError(`${where} não tem o 'const ${variable} = { ... }'.`)
  }
  return initializer
}

/** O objeto do `return { ... }` da função `name`. */
function returnedObjectOf(index: SourceFile, name: string, where: string): ObjectLiteralExpression {
  const body = index.getFunction(name)?.getBody()
  const statement = body && Node.isBlock(body) ? body.getStatements().at(-1) : undefined
  const value = statement && Node.isReturnStatement(statement) ? statement.getExpression() : undefined
  if (!value || !Node.isObjectLiteralExpression(value)) {
    throw new UsageError(`${where} não tem a função '${name}' terminando em 'return { ... }'.`)
  }
  return value
}

/** O objeto tem o membro: `name: ...`, `name` ou `...name`. */
function hasMember(object: ObjectLiteralExpression, name: string): boolean {
  return object.getProperties().some((member) => memberName(member) === name)
}

/** Os imports relativos do arquivo e a linha de import no estilo dele (aspas e ponto e vírgula). */
function importer(index: SourceFile) {
  const imports = index.getImportDeclarations()
  const relative = imports.filter((declaration) => specifierOf(declaration).startsWith('.'))
  const { quote, semicolon } = styleOf(relative[0] ?? imports[0])
  const last = imports[imports.length - 1]
  return (name: string, from: string, where: string): TextEdit =>
    insertSorted(
      relative,
      from,
      `import { ${name} } from ${quote}${from}${quote}${semicolon}`,
      last,
      where,
    )
}

/**
 * Registra o use case no índice do domínio (`src/use-cases/<domínio>/index.ts`): o import da classe
 * e, se há API, o da rota de mock; a entrada `<chave>: new <Classe>(deps.<dependência>)` na função
 * `create<Domínio>UseCases` e o `...<chave>Routes` nas rotas do domínio, cada um na posição
 * alfabética. O índice precisa existir. `local` entra com o `storage` e sem rota de mock.
 */
export function registerUseCase(plan: ChangePlan, names: UseCaseNames, { local }: { local: boolean }): void {
  const file = path.join(plan.project.src, 'use-cases', names.domain.kebab, 'index.ts')
  const { index, where } = indexSource(plan, file)
  const { kebab, pascal, camel } = names.action
  const useCases = returnedObjectOf(index, `create${names.domain.pascal}UseCases`, where)
  const routes = objectOf(index, `${names.domain.camel}Routes`, where)
  if (hasMember(useCases, camel)) {
    throw new UsageError(`${where} já tem o use case '${camel}' em create${names.domain.pascal}UseCases.`)
  }

  const importFrom = importer(index)
  const className = `${pascal}UseCase`
  const edits = [
    ...(local ? [] : [importFrom(`${camel}Routes`, `./${kebab}.mock`, where)]),
    importFrom(className, `./${kebab}.usecase`, where),
    insertMember(index, useCases, camel, `${camel}: new ${className}(deps.${local ? 'storage' : 'http'})`),
    ...(local ? [] : [insertMember(index, routes, `${camel}Routes`, `...${camel}Routes`)]),
  ]
  applyEdits(index, mergeInsertions(edits))
}

/**
 * Registra o domínio no registro geral (`src/use-cases/index.ts`): o import de `create<Domínio>UseCases`
 * e de `<domínio>Routes`, o `...create<Domínio>UseCases(deps)` em `createUseCases` e o
 * `...<domínio>Routes` em `mockRoutes`, na posição alfabética. Um registro que já tem o domínio fica
 * como está (o domínio ganha o segundo use case sem mexer nele).
 */
export function registerUseCaseDomain(plan: ChangePlan, names: UseCaseNames): void {
  const file = path.join(plan.project.src, 'use-cases', 'index.ts')
  const { index, where } = indexSource(plan, file)
  const { kebab, pascal, camel } = names.domain
  const creator = `create${pascal}UseCases`
  const useCases = returnedObjectOf(index, 'createUseCases', where)
  const routes = objectOf(index, 'mockRoutes', where)
  if (hasMember(useCases, `${creator}(deps)`)) return

  const parameter = index.getFunction('createUseCases')?.getParameters()[0]?.getNameNode()
  // O registro novo ainda não usa o parâmetro, e o `_` o isenta do noUnusedParameters
  const rename: TextEdit[] =
    parameter && parameter.getText() === '_deps'
      ? [{ pos: parameter.getStart(), end: parameter.getEnd(), text: 'deps' }]
      : []
  const edits = [
    importer(index)(`${creator}, ${camel}Routes`, `./${kebab}`, where),
    insertMember(index, useCases, `${creator}(deps)`, `...${creator}(deps)`),
    insertMember(index, routes, `${camel}Routes`, `...${camel}Routes`),
    ...rename,
  ]
  applyEdits(index, mergeInsertions(edits))
}
