import path from 'node:path'
import { Node, type Expression, type SourceFile } from 'ts-morph'
import { UsageError } from '../errors.ts'
import { endpointOf, hasQueryKey } from './listing.ts'
import { schemaFileOf } from './entity.ts'
import { readEntityFields, readEntityShape, readObjectFields, type Fail, type Field } from './fields/index.ts'
import { deriveNames, useCaseNames, type UseCaseNames } from './names.ts'
import { displayPath } from './paths.ts'
import type { ChangePlan } from './plan.ts'

/** O que o Output do use case é, para a tela escolher entre lista e detalhe. */
export interface OutputShape {
  /** Uma lista (`z.array(<x>Schema)` ou `pageSchema(<x>Schema)`), um registro (`<x>Schema`) ou outra coisa. */
  kind: 'list' | 'item' | 'other'
  /** A entidade (`Livro`), nos dois primeiros casos. */
  entity?: string
  /** A lista é uma `Page` (`{ items, total }`), e não um array. */
  page?: boolean
}

/** O que a tela gerada precisa saber de um use case que já existe no projeto. */
export interface UseCaseModel {
  names: UseCaseNames
  /** Leitura (tem a chave de cache `<chave>Key`) ou escrita. */
  access: 'read' | 'write'
  /** Os `:parâmetros` do `ENDPOINT`; vazio sem eles e no use case local. */
  params: string[]
  /** Os nomes dos campos obrigatórios do Input (lidos sem exigir o tipo de cada campo). */
  required: string[]
  /** Os campos do Input, na ordem do `.types.ts`; lança `UsageError` se um campo tem um tipo que o leitor não conhece. */
  fields: () => Field[]
  output: OutputShape
  /** Onde o use case está, relativo à raiz: o `.types.ts`. */
  types: string
}

const isCall = (node: Node, callee: string): node is Node & { getArguments(): Node[] } =>
  Node.isCallExpression(node) && node.getExpression().getText().replace(/\s+/g, '') === callee

/** Tira o `satisfies` e o `as` do fim de uma expressão. */
function unwrap(expression: Expression): Expression {
  let current = expression
  while (Node.isSatisfiesExpression(current) || Node.isAsExpression(current)) current = current.getExpression()
  return current
}

/** O objeto literal do primeiro argumento de uma chamada, se for um. */
function objectArgument(call: Node) {
  const [argument] = Node.isCallExpression(call) ? call.getArguments() : []
  return argument && Node.isObjectLiteralExpression(argument) ? argument : undefined
}

/**
 * Os campos do Input, lidos do `.types.ts` pela árvore. Vale `z.object({ ... })` (com os campos que o
 * `--input` gera, ou refinados à mão) e a entidade que o `make:usecase --crud` usa: `<entidade>InputSchema`,
 * com `.partial()` e `.extend({ ... })` no fim. Os campos da entidade saem do schema dela.
 */
function inputFields(plan: ChangePlan, source: SourceFile, variable: string, file: string): Field[] {
  const fail: Fail = (line, reason) => {
    throw new UsageError(`${file}:${line}: ${reason}.`)
  }
  const declaration = source.getVariableDeclaration(variable)
  const initializer = declaration?.getInitializer()
  if (!declaration || !initializer) return fail(1, `não achei 'export const ${variable} = ...': não sei ler o Input`)

  let expression = unwrap(initializer)
  const object = isCall(expression, 'z.object') ? objectArgument(expression) : undefined
  if (object) return readObjectFields(object, fail, variable, { entity: false }).fields

  let partial = false
  const extras: Field[] = []
  const line = declaration.getStartLineNumber()
  while (Node.isCallExpression(expression)) {
    const callee = expression.getExpression()
    if (!Node.isPropertyAccessExpression(callee)) break
    const method = callee.getName()
    const extension = method === 'extend' ? objectArgument(expression) : undefined
    if (method === 'partial') partial = true
    else if (extension) extras.unshift(...readObjectFields(extension, fail, variable, { entity: false }).fields)
    else fail(line, `não sei ler o .${method}() no ${variable} (só .partial() e .extend({ ... }) sobre o schema da entidade)`)
    expression = callee.getExpression()
  }
  const entity = Node.isIdentifier(expression) ? /^([a-z][A-Za-z0-9]*)InputSchema$/.exec(expression.getText())?.[1] : undefined
  if (!entity) {
    return fail(line, `não sei ler o ${variable}: use z.object({ ... }) ou o <entidade>InputSchema (com .partial() e .extend({ ... }))`)
  }
  const schema = schemaFileOf(plan.project, entity.charAt(0).toUpperCase() + entity.slice(1))
  if (!schema) fail(line, `o schema da entidade '${entity}' não está em src/schemas/entities`)
  const names = deriveNames(path.basename(schema!, '.ts'))
  const domain = { plural: names, singular: names }
  const fields = readEntityFields(plan, domain)
  const picked = new Set(readEntityShape(plan, domain, fields).input)
  const base = fields.filter((field) => picked.has(field.name)).map((field) => (partial ? { ...field, optional: true } : field))
  return [...base, ...extras]
}

/** Os nomes dos campos obrigatórios do Input: sem `.optional()` no fim, lidos mesmo que o tipo do campo não seja um dos do `--fields`. */
function requiredInputs(plan: ChangePlan, source: SourceFile, variable: string, file: string): string[] {
  const initializer = source.getVariableDeclaration(variable)?.getInitializer()
  const expression = initializer && unwrap(initializer)
  const object = expression && isCall(expression, 'z.object') ? objectArgument(expression) : undefined
  if (!object) return inputFields(plan, source, variable, file).filter((field) => !field.optional).map((field) => field.name)
  return object
    .getProperties()
    .filter(Node.isPropertyAssignment)
    .filter((property) => {
      const value = property.getInitializer()
      const callee = value && Node.isCallExpression(value) ? value.getExpression() : undefined
      return !(callee && Node.isPropertyAccessExpression(callee) && callee.getName() === 'optional')
    })
    .map((property) => property.getName())
}

/** O Output: lista de uma entidade, um registro dela, ou outra coisa (campos soltos, `unknown`, `void`). */
function outputShape(source: SourceFile, variable: string): OutputShape {
  const initializer = source.getVariableDeclaration(variable)?.getInitializer()
  if (!initializer) return { kind: 'other' }
  const expression = unwrap(initializer)
  const entityOf = (node: Node | undefined) => /^([a-z][A-Za-z0-9]*)Schema$/.exec(node?.getText() ?? '')?.[1]
  const pascal = (camel: string | undefined) => camel && camel.charAt(0).toUpperCase() + camel.slice(1)
  for (const [callee, page] of [['z.array', false], ['pageSchema', true]] as const) {
    if (!isCall(expression, callee)) continue
    const entity = pascal(entityOf(expression.getArguments()[0]))
    if (entity) return { kind: 'list', entity, page }
  }
  const entity = pascal(entityOf(expression))
  return entity ? { kind: 'item', entity } : { kind: 'other' }
}

/**
 * Lê um use case do projeto (`<domínio>.<ação>`) para gerar a tela dele: se é leitura ou escrita, os
 * `:parâmetros` do endereço, os campos do Input e o que o Output é. `UsageError` se o use case não existe.
 */
export function readUseCase(plan: ChangePlan, reference: string): UseCaseModel {
  const names = useCaseNames(reference)
  const { domain, action } = names
  const folder = path.join(plan.project.src, 'use-cases', domain.kebab)
  const typesFile = path.join(folder, `${action.kebab}.types.ts`)
  if (!plan.hasFile(path.join(folder, `${action.kebab}.usecase.ts`)) || !plan.hasFile(typesFile)) {
    throw new UsageError(
      `o use case '${domain.kebab}.${action.kebab}' não existe: falta src/use-cases/${domain.kebab}/${action.kebab}.usecase.ts. Rode prumo make:usecase ${domain.kebab}.${action.kebab} (ou prumo list para ver o que há).`,
    )
  }
  const file = displayPath(plan.project.root, typesFile)
  const source = plan.source(typesFile)
  return {
    names,
    access: hasQueryKey(source.getFullText(), action.camel) ? 'read' : 'write',
    params: endpointOf(source.getFullText())?.params ?? [],
    required: requiredInputs(plan, source, `${action.pascal}Input`, file),
    fields: () => inputFields(plan, source, `${action.pascal}Input`, file),
    output: outputShape(source, `${action.pascal}Output`),
    types: file,
  }
}
