import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Node, type ObjectLiteralExpression, type PropertyAssignment } from 'ts-morph'
import { UsageError } from '../../errors.ts'
import { deriveNames, entityFlag, type DomainNames } from '../names.ts'
import type { ChangePlan } from '../plan.ts'
import { ENUM_VALUE, FIELD_NAME, RESERVED_FIELDS, type Field, type FieldType } from './types.ts'

/** O caminho do schema da entidade, relativo à raiz do projeto: `src/schemas/entities/cliente.ts`. */
export function schemaFile(names: DomainNames): string {
  return `src/schemas/entities/${names.singular.kebab}.ts`
}

/** O `z.object({ ... })` do `<entidade>Schema`, se o arquivo o tem. */
function schemaObject(
  plan: ChangePlan,
  names: DomainNames,
  file: string,
): ObjectLiteralExpression | undefined {
  const initializer = plan
    .source(file)
    .getVariableDeclaration(`${names.singular.camel}Schema`)
    ?.getInitializer()
  if (!initializer || !Node.isCallExpression(initializer)) return undefined
  if (initializer.getExpression().getText().replace(/\s+/g, '') !== 'z.object') return undefined
  const [argument] = initializer.getArguments()
  return argument && Node.isObjectLiteralExpression(argument) ? argument : undefined
}

const SIMPLE_ZOD: Record<string, FieldType> = {
  'z.string()': 'string',
  'z.number()': 'number',
  'z.number().int()': 'int',
  'z.boolean()': 'boolean',
  'z.iso.date()': 'date',
  'z.iso.datetime()': 'datetime',
}

/**
 * O tipo do campo a partir da expressão do zod (sem o `.optional()` do fim), lida da árvore. Devolve
 * o tipo, ou o motivo (texto) se não é um dos tipos do `--fields` ou se o enum tem um valor que o
 * `--fields` não aceitaria.
 */
function typeOfZod(expression: Node, loose = false): Omit<Field, 'name' | 'optional'> | string {
  const simple = SIMPLE_ZOD[expression.getText().replace(/\s+/g, '')]
  if (simple) return { type: simple }
  const found = loose ? looseTypeOfZod(expression) : undefined
  if (found) return found
  const unknown = `não reconheço o tipo (${expression.getText().replace(/\s+/g, ' ')}). O Prumo lê string, number, int, boolean, date, datetime e enum, com .optional() (z.string(), z.number().int(), z.iso.date(), z.enum([...])...)`
  if (!Node.isCallExpression(expression) || expression.getExpression().getText().replace(/\s+/g, '') !== 'z.enum') {
    return unknown
  }
  const [list, ...rest] = expression.getArguments()
  if (rest.length > 0 || !list || !Node.isArrayLiteralExpression(list)) return unknown
  const values: string[] = []
  for (const element of list.getElements()) {
    if (!Node.isStringLiteral(element)) return unknown
    const value = element.getLiteralText()
    if (!ENUM_VALUE.test(value)) {
      return `o valor '${value}' do enum não é válido (letras, números e _, começando por letra)`
    }
    if (values.includes(value)) return `o valor '${value}' aparece mais de uma vez no enum`
    values.push(value)
  }
  if (values.length < 2) return 'o enum precisa de pelo menos dois valores'
  return { type: 'enum', values }
}

/** A chamada de base de cada tipo que um `types/<ação>.ts` costuma usar, com ou sem refinamentos (`z.string().min(8)`, `z.email()`). */
const LOOSE_ZOD: Record<string, FieldType> = {
  'z.string': 'string',
  'z.email': 'string',
  'z.url': 'string',
  'z.uuid': 'string',
  'z.number': 'number',
  'z.int': 'int',
  'z.boolean': 'boolean',
  'z.iso.date': 'date',
  'z.iso.datetime': 'datetime',
}

/** O tipo pela chamada de base da cadeia (`z.string().min(8)` é texto), para o `types/<ação>.ts` que a pessoa refinou à mão. */
function looseTypeOfZod(expression: Node): { type: FieldType } | undefined {
  let current = expression
  let integer = false
  while (Node.isCallExpression(current)) {
    const callee = current.getExpression()
    const type = LOOSE_ZOD[callee.getText().replace(/\s+/g, '')]
    if (type) return { type: type === 'number' && integer ? 'int' : type }
    if (!Node.isPropertyAccessExpression(callee)) return undefined
    integer ||= callee.getName() === 'int'
    current = callee.getExpression()
  }
  return undefined
}

/** Tira o `.optional()` do fim da expressão: devolve a expressão de dentro e se havia o `.optional()`. */
function withoutOptional(expression: Node): { inner: Node; optional: boolean } {
  if (Node.isCallExpression(expression) && expression.getArguments().length === 0) {
    const callee = expression.getExpression()
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'optional') {
      return { inner: callee.getExpression(), optional: true }
    }
  }
  return { inner: expression, optional: false }
}

/** Quem lança o erro de uso de um campo que não se lê: recebe a linha e o motivo. */
export type Fail = (line: number, reason: string) => never

/**
 * Os campos de um `z.object({ ... })`, pela árvore: nome, tipo e `.optional()`. `owner` é o nome do
 * objeto nas mensagens. Com `entity`, `id` e `createdAt` são os do schema de uma entidade (precisam
 * ser `z.string()` e ficam fora da lista); sem ele, são campos como os outros, e o tipo aceita o que
 * a pessoa refinou à mão (`z.string().min(8)`, `z.email()`), como no Input de um use case.
 */
export function readObjectFields(
  object: ObjectLiteralExpression,
  fail: Fail,
  owner: string,
  { entity }: { entity: boolean },
): { fields: Field[]; seen: Set<string> } {
  const fields: Field[] = []
  const seen = new Set<string>()
  for (const property of object.getProperties()) {
    const line = property.getStartLineNumber()
    if (!Node.isPropertyAssignment(property) || !Node.isIdentifier(property.getNameNode())) {
      fail(
        line,
        `não reconheço '${property.getText().split('\n')[0]}' no ${owner} (só campos 'nome: z.tipo()', com o nome sem aspas, nos tipos do --fields)`,
      )
    }
    const name = (property as PropertyAssignment).getName()
    const initializer = (property as PropertyAssignment).getInitializer()
    if (seen.has(name)) fail(line, `o campo '${name}' aparece mais de uma vez`)
    seen.add(name)
    if (!initializer) fail(line, `o campo '${name}' não tem tipo`)
    const { inner, optional } = withoutOptional(initializer!)
    if (entity && RESERVED_FIELDS.has(name)) {
      const parsedType = typeOfZod(inner)
      if (optional || typeof parsedType === 'string' || parsedType.type !== 'string') {
        fail(line, `o campo '${name}' precisa ser z.string(): o repositório dá ${name} a todo registro`)
      }
      continue
    }
    if (!FIELD_NAME.test(name)) {
      fail(line, `'${name}' não é um nome em camelCase (letra minúscula primeiro; só letras e números)`)
    }
    const parsed = typeOfZod(inner, !entity)
    if (typeof parsed === 'string') fail(line, `campo '${name}': ${parsed}`)
    fields.push({ name, ...(parsed as Omit<Field, 'name' | 'optional'>), optional })
  }
  return { fields, seen }
}

/**
 * Lê os campos da entidade em `src/schemas/entities/<entidade>.ts`, com o ts-morph: acha o
 * `z.object({ ... })` do `<entidade>Schema` e reconhece cada campo (fora `id` e `createdAt`) pelos
 * tipos do `--fields`, com o `.optional()`, lendo a árvore (os valores do enum são os literais do
 * array, com a vírgula final ou não). Devolve os mesmos `Field[]` que o `parseFields` leu na hora
 * de gerar o schema, na ordem do arquivo. É o contrato do `make:usecase --crud` e do `make:page` com
 * o `make:schema`. Erro de uso (`UsageError`, saída 2): o schema não existe (com a dica do
 * `make:schema`, e o `--entity` se a entidade não é a derivada), não tem o `z.object`, não tem
 * `id` e `createdAt` como `z.string()`, ou tem um campo que o `--fields` não geraria (nome que
 * não é um identificador em camelCase, repetido, tipo fora dos tipos, enum com valor inválido,
 * repetido ou menos de dois valores), com o arquivo, a linha e o nome do campo.
 */
export function readEntityFields(plan: ChangePlan, names: DomainNames): Field[] {
  const relative = schemaFile(names)
  const file = path.join(plan.project.root, relative)
  if (!plan.hasFile(file)) {
    throw new UsageError(
      `falta o schema ${names.plural.kebab} (${relative}); rode prumo make:schema ${names.plural.kebab}${entityFlag(names)}.${unusedSchemasHint(plan, names)}`,
    )
  }
  const object = schemaObject(plan, names, file)
  if (!object) {
    throw new UsageError(
      `${relative} não tem 'export const ${names.singular.camel}Schema = z.object({ ... })': não sei ler os campos.`,
    )
  }
  const fail = (line: number, reason: string): never => {
    throw new UsageError(`${relative}:${line}: ${reason}.`)
  }
  const { fields, seen } = readObjectFields(object, fail, `${names.singular.camel}Schema`, { entity: true })
  for (const reserved of RESERVED_FIELDS) {
    if (!seen.has(reserved)) {
      fail(
        object.getStartLineNumber(),
        `falta o campo '${reserved}: z.string()' no ${names.singular.camel}Schema: o repositório e as fixtures dependem dele`,
      )
    }
  }
  if (fields.length === 0) {
    fail(object.getStartLineNumber(), `o ${names.singular.camel}Schema não tem nenhum campo além de id e createdAt`)
  }
  return fields
}

/**
 * Os schemas de `src/schemas/entities/` que nenhum use case usa, quando a entidade pedida é a
 * derivada do domínio: o schema pode ter saído do `make:schema` com `--entity`, e a pessoa esqueceu
 * de repetir a opção. Sem candidatos (ou com `--entity` explícito diferente da derivada), `''`.
 */
function unusedSchemasHint(plan: ChangePlan, names: DomainNames): string {
  if (entityFlag(names) !== '') return ''
  const entities = path.join(plan.project.src, 'schemas', 'entities')
  if (!existsSync(entities)) return ''
  const useCases = path.join(plan.project.src, 'use-cases')
  const typesFiles = existsSync(useCases)
    ? readdirSync(useCases, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => {
          const types = path.join(useCases, entry.name, 'types')
          return existsSync(types)
            ? readdirSync(types)
                .filter((file) => file.endsWith('.ts'))
                .map((file) => readFileSync(path.join(types, file), 'utf8'))
            : []
        })
    : []
  const candidates = readdirSync(entities)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => file.slice(0, -3))
    .filter((kebab) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(kebab))
    .filter((kebab) => {
      // O nome exato (`PedidoSchema`, com limite de palavra): `PedidoItemSchema` não esconde `item`
      const used = new RegExp(`\\b${deriveNames(kebab).pascal}Schema\\b`)
      return !typesFiles.some((text) => used.test(text))
    })
  if (candidates.length === 0) return ''
  return ` Se o schema saiu do make:schema com --entity, repita a opção; schemas sem use case: ${candidates.join(', ')}.`
}

/** O que o schema deixa entrar (o `.pick` do `<entidade>InputSchema`) e ordenar (o `<Entidade>SortKey`). */
export interface EntityShape {
  /** Os nomes dos campos do `pick`, na ordem do arquivo. */
  input: string[]
  /** Os membros da chave de ordem: nomes de campos e `createdAt`. */
  sort: string[]
}

/**
 * Lê o `<entidade>InputSchema = <entidade>Schema.pick({ campo: true, ... })` e o `export type
 * <Entidade>SortKey = 'a' | 'b'` do schema, pela árvore, para o repositório gerar o `create` e a
 * ordem só com o que o schema aceita (a pessoa pode ter acrescentado um campo só ao `z.object`, ou
 * tirado um do `pick`). `fields` são os campos que `readEntityFields` já leu. `UsageError` com
 * arquivo e linha: `pick` ou `SortKey` que não dá para ler, nome que não é campo, `id`/`createdAt`
 * no `pick`, `pick` vazio ou `SortKey` sem campo que se ordene no teste.
 */
export function readEntityShape(
  plan: ChangePlan,
  names: DomainNames,
  fields: readonly Field[],
): EntityShape {
  const relative = schemaFile(names)
  const source = plan.source(path.join(plan.project.root, relative))
  const fail = (line: number, reason: string): never => {
    throw new UsageError(`${relative}:${line}: ${reason}.`)
  }
  const known = new Set(fields.map((field) => field.name))

  const inputName = `${names.singular.camel}InputSchema`
  const declaration = source.getVariableDeclaration(inputName)
  const pick = declaration?.getInitializer()
  const expected = `${names.singular.camel}Schema.pick`
  const [argument] =
    pick && Node.isCallExpression(pick) && pick.getExpression().getText().replace(/\s+/g, '') === expected
      ? pick.getArguments()
      : []
  if (!declaration || !argument || !Node.isObjectLiteralExpression(argument)) {
    return fail(
      declaration?.getStartLineNumber() ?? 1,
      `não achei 'export const ${inputName} = ${expected}({ campo: true, ... })': só o .pick({ ... }) é aceito (o .omit({ ... }) não): o formato esperado é exatamente '${expected}({ campo: true, ... })', sem .extend nem outro encadeamento. Liste no .pick os campos que entram na criação`,
    )
  }
  const input: string[] = []
  for (const property of argument.getProperties()) {
    const line = property.getStartLineNumber()
    if (
      !Node.isPropertyAssignment(property) ||
      !Node.isIdentifier(property.getNameNode()) ||
      property.getInitializer()?.getText() !== 'true'
    ) {
      fail(line, `não reconheço '${property.getText().split('\n')[0]}' no pick do ${inputName} (só 'campo: true')`)
    }
    const name = (property as PropertyAssignment).getName()
    if (!known.has(name)) fail(line, `o pick do ${inputName} tem '${name}', que não é campo do ${names.singular.camel}Schema`)
    input.push(name)
  }
  if (input.length === 0) fail(argument.getStartLineNumber(), `o pick do ${inputName} está vazio`)

  const sortName = `${names.singular.pascal}SortKey`
  const alias = source.getTypeAlias(sortName)
  const node = alias?.getTypeNode()
  if (!alias || !node) {
    return fail(1, `não achei 'export type ${sortName} = ...': não sei por quais campos a lista ordena`)
  }
  const members = Node.isUnionTypeNode(node) ? node.getTypeNodes() : [node]
  const sort: string[] = []
  for (const member of members) {
    const line = member.getStartLineNumber()
    const literal = Node.isLiteralTypeNode(member) ? member.getLiteral() : undefined
    if (!literal || !Node.isStringLiteral(literal)) {
      fail(line, `não reconheço '${member.getText()}' no ${sortName} (só nomes de campo entre aspas)`)
    }
    const name = (literal as { getLiteralText(): string }).getLiteralText()
    if (!known.has(name) && name !== 'createdAt') {
      fail(line, `o ${sortName} tem '${name}', que não é campo do ${names.singular.camel}Schema (nem createdAt)`)
    }
    if (fields.some((field) => field.name === name && field.type === 'boolean')) {
      fail(line, `o ${sortName} tem '${name}', que é booleano: a lista não ordena por booleano (o --fields também não gera essa chave)`)
    }
    sort.push(name)
  }
  const testable = sort.some(
    (name) => name === 'createdAt' || fields.some((field) => field.name === name && field.type !== 'enum' && field.type !== 'boolean'),
  )
  if (!testable) {
    fail(alias.getStartLineNumber(), `o ${sortName} não tem createdAt nem campo que não seja enum ou booleano: o teste de ordem não tem por onde ordenar`)
  }
  return { input, sort }
}
