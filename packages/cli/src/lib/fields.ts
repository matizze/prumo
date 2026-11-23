import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Node, type ObjectLiteralExpression, type PropertyAssignment } from 'ts-morph'
import { UsageError } from '../errors.ts'
import { deriveNames, entityFlag, type DomainNames } from './names.ts'
import type { ChangePlan } from './plan.ts'

/** Os tipos que o `--fields` aceita, e o que cada um vira no schema zod. */
export const FIELD_TYPES = ['string', 'number', 'int', 'boolean', 'date', 'datetime', 'enum'] as const

export type FieldType = (typeof FIELD_TYPES)[number]

/** Um campo da entidade. */
export interface Field {
  /** O nome, em camelCase (`publicadoEm`). */
  name: string
  type: FieldType
  /** Os valores do `enum(a|b|c)`, na ordem em que vieram (só no tipo `enum`). */
  values?: string[]
  /** Campo opcional (`apelido?:string`): o schema aceita a falta dele. */
  optional: boolean
}

/** Os nomes que o repositório já dá ao registro: o `--fields` não pode redefini-los. */
export const RESERVED_FIELDS: ReadonlySet<string> = new Set(['id', 'createdAt'])

/** O campo que um domínio sem `--fields` tem: o `name` de texto, como sempre foi. */
export const DEFAULT_FIELDS: readonly Field[] = [{ name: 'name', type: 'string', optional: false }]

/** O formato aceito, para as mensagens de erro. */
const SYNTAX = `nome:tipo separados por vírgula, por exemplo "titulo:string,ano:int,status:enum(ativo|inativo),apelido?:string" (tipos: ${FIELD_TYPES.filter((type) => type !== 'enum').join(', ')} e enum(a|b|c); ? depois do nome torna o campo opcional)`

/** O `enum(a|b|c)`: o que vem entre os parênteses. */
const ENUM_TYPE = /^enum\((.*)\)$/s

/**
 * Lê o texto do `--fields` (`titulo:string,ano:number,apelido?:string`) e confere cada campo: nome em
 * camelCase (começa com letra minúscula, só letras e números), tipo conhecido, sem repetir e sem os
 * nomes que o repositório reserva (`id`, `createdAt`). Todo erro é um `UsageError` (saída 2).
 */
export function parseFields(text: string): Field[] {
  const bad = (reason: string): never => {
    throw new UsageError(`--fields '${text}' é inválido: ${reason}. Formato: ${SYNTAX}.`)
  }
  if (text.trim() === '') bad('a lista de campos está vazia')
  const fields: Field[] = []
  for (const raw of text.split(',')) {
    const item = raw.trim()
    if (item === '') bad('há uma vírgula sobrando (campo vazio)')
    const parts = item.split(':')
    if (parts.length !== 2) bad(`'${item}' não está no formato nome:tipo`)
    const [head = '', typeText = ''] = parts.map((part) => part.trim())
    const optional = head.endsWith('?')
    const name = optional ? head.slice(0, -1) : head
    if (!/^[a-z][A-Za-z0-9]*$/.test(name)) {
      bad(`'${name}' não é um nome em camelCase (letra minúscula primeiro; só letras e números)`)
    }
    if (RESERVED_FIELDS.has(name)) {
      bad(`'${name}' é reservado: o repositório já dá ${[...RESERVED_FIELDS].join(' e ')} a todo registro`)
    }
    if (fields.some((field) => field.name === name)) bad(`o campo '${name}' aparece mais de uma vez`)
    const enumMatch = ENUM_TYPE.exec(typeText)
    if (enumMatch) {
      const values = enumMatch[1]!.split('|').map((value) => value.trim())
      const invalid = values.find((value) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(value))
      if (invalid !== undefined) {
        bad(`'${invalid}' não é um valor válido de '${name}' (letras, números e _, começando por letra)`)
      }
      if (values.length < 2) bad(`o enum '${name}' precisa de pelo menos dois valores (enum(a|b))`)
      const repeated = values.find((value, index) => values.indexOf(value) !== index)
      if (repeated !== undefined) bad(`o valor '${repeated}' aparece mais de uma vez em '${name}'`)
      fields.push({ name, type: 'enum', values, optional })
      continue
    }
    const type = FIELD_TYPES.find((candidate) => candidate === typeText && candidate !== 'enum')
    if (!type) {
      const hint = typeText === 'enum' ? ' (o enum leva os valores: enum(a|b|c))' : ''
      bad(`'${typeText}' não é um tipo de '${name}' (use ${FIELD_TYPES.filter((candidate) => candidate !== 'enum').join(', ')} ou enum(a|b|c))${hint}`)
    }
    fields.push({ name, type: type!, optional })
  }
  return fields
}

/** O texto do campo na lista de uma saída: `titulo (string)`, `apelido (string, opcional)`. */
export function describeField(field: Field): string {
  const type = field.type === 'enum' ? `enum(${(field.values ?? []).join('|')})` : field.type
  return `${field.name} (${type}${field.optional ? ', opcional' : ''})`
}

/** Um valor de exemplo, como entra no código. */
type Value = string | number | boolean

/** Um valor como literal do TypeScript: texto entre aspas simples, o resto como está. */
export function literal(value: Value): string {
  return typeof value === 'string'
    ? `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
    : String(value)
}

/** Os valores do enum (um campo `enum` sempre os tem; o `Field` à mão pode esquecê-los). */
function enumValues(field: Field): string[] {
  return field.values && field.values.length > 0 ? field.values : ['a', 'b']
}

/** O campo `name` de texto: nele os exemplos seguem o que o `make:domain` sempre gerou. */
function isLegacy(field: Field): boolean {
  return field.name === 'name' && field.type === 'string'
}

/** `publicadoEm` vira `Publicado em`: o nome do campo como texto de exemplo. */
function titleOf(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const DAYS = ['2026-01-05', '2026-01-14', '2026-01-23', '2026-02-01'] as const

/**
 * O valor de exemplo do registro `n` (1 a 3 são as fixtures, e crescem com `n`, para a ordem do
 * contrato ser previsível; 4 é o registro novo do teste de criação).
 */
export function sampleValue(field: Field, n: number): Value {
  const day = DAYS[n - 1] ?? DAYS[3]
  switch (field.type) {
    case 'string':
      if (isLegacy(field)) return n === 4 ? 'Novo' : `Exemplo ${n}`
      return `${titleOf(field.name)} ${n}`
    case 'number':
    case 'int':
      return n * 10
    case 'enum':
      return enumValues(field)[Math.min(n, enumValues(field).length) - 1]!
    case 'boolean':
      return n % 2 === 1
    case 'date':
      return day
    case 'datetime':
      return `${day}T12:00:00.000Z`
  }
}

/** O valor com que o teste edita o campo: diferente de todos os das fixtures. */
export function editValue(field: Field, partial = false): Value {
  switch (field.type) {
    case 'string':
      if (isLegacy(field)) return partial ? 'Parcial' : 'Renomeado'
      return `${titleOf(field.name)} editado`
    case 'number':
    case 'int':
      return 999
    case 'enum':
      return enumValues(field).at(-1)!
    case 'boolean':
      return false
    case 'date':
      return '2027-01-01'
    case 'datetime':
      return '2027-01-01T12:00:00.000Z'
  }
}

/** O que o campo vira no `z.object` do schema. */
export function zodOf(field: Field): string {
  const base = {
    string: 'z.string()',
    number: 'z.number()',
    int: 'z.number().int()',
    enum: `z.enum([${enumValues(field).map(literal).join(', ')}])`,
    boolean: 'z.boolean()',
    date: 'z.iso.date()',
    datetime: 'z.iso.datetime()',
  }[field.type]
  return field.optional ? `${base}.optional()` : base
}

const isText = (field: Field) => field.type === 'string'

/** Os campos pelos quais a lista ordena: tudo menos o booleano (que não tem ordem útil). */
const isSortable = (field: Field) => field.type !== 'boolean'

/**
 * Uma lista entre `open` e `close` (`{ }` ou `[ ]`) numa linha só, ou uma entrada por linha (2 espaços,
 * vírgula no fim) se a linha passar de `max` colunas. `prefix` é o tamanho do que vem antes (e depois)
 * da lista na mesma linha, fora o recuo.
 */
function bracketed(
  open: '{' | '[',
  entries: string[],
  indent: string,
  { max = 90, prefix = 0 }: { max?: number; prefix?: number } = {},
): string {
  const close = open === '{' ? '}' : ']'
  const inline = open === '{' ? `{ ${entries.join(', ')} }` : `[${entries.join(', ')}]`
  if (indent.length + prefix + inline.length <= max) return inline
  return `${open}\n${entries.map((entry) => `${indent}  ${entry},`).join('\n')}\n${indent}${close}`
}

/** Um objeto numa linha só, ou um por linha se passar de `max` colunas. */
const object = (entries: string[], indent: string, options?: { max?: number; prefix?: number }) =>
  bracketed('{', entries, indent, options)

/** A largura em que as listas longas do código gerado quebram em várias linhas. */
const WIDE = 100

/**
 * A união da `SortKey`: numa linha, ou uma opção por linha (`| 'a'`) se a declaração passar de
 * `WIDE` colunas. Vem sem o espaço depois do `=`, que o modelo deixa para este texto.
 */
function union(keys: string[], idBase: string): string {
  const inline = ` ${keys.join(' | ')}`
  // `export type <Entidade>SortKey =`: o nome em Pascal tem o tamanho do kebab, sem os hifens
  if ('export type SortKey ='.length + idBase.length + inline.length <= WIDE) return inline
  return `\n${keys.map((key) => `  | ${key}`).join('\n')}`
}

/**
 * O `const filtered = ...` do mock (num recuo de 4 colunas): numa linha só, ou com o `matchesSearch` na
 * linha de baixo (e a lista, se ainda passar de `WIDE`, uma entrada por linha).
 */
function searchStatement(entries: string[]): string {
  const head = 'const filtered = this.items.filter((item) =>'
  const oneLine = `${head} matchesSearch([${entries.join(', ')}], query.search))`
  if ('    '.length + oneLine.length <= WIDE) return oneLine
  const list = bracketed('[', entries, '      ', { max: WIDE, prefix: 'matchesSearch(, query.search),'.length })
  return `${head}\n      matchesSearch(${list}, query.search),\n    )`
}

/** `pelos campos a, b, c`; com tantos que a frase estoura a linha, `pelos campos de texto`. */
function listOf(names: string[]): string {
  const phrase = `pelos campos ${names.join(', ')}`
  return phrase.length <= 50 ? phrase : 'pelos campos de texto'
}

/** Os marcadores dos modelos do domínio, calculados dos campos. */
export function domainFieldVars(
  fields: readonly Field[],
  /** O id base dos registros (`livro`): o `id` da fixture 2 é `livro-2`. */
  idBase: string,
  /**
   * O que o schema deixa entrar e ordenar, quando foi editado à mão: os nomes dos campos do
   * `<entidade>InputSchema` (o `.pick`) e os membros do `<Entidade>SortKey`. Sem isto, valem todos
   * os campos no `pick` e os ordenáveis (fora o booleano) mais `createdAt` na chave de ordem.
   */
  shape?: { input: readonly string[]; sort: readonly string[] },
): Record<string, string> {
  const texts = fields.filter(isText)
  const inputs = shape ? fields.filter((field) => shape.input.includes(field.name)) : fields
  const sortable = shape
    ? fields.filter((field) => shape.sort.includes(field.name))
    : fields.filter(isSortable)
  const sortsByDate = shape ? shape.sort.includes('createdAt') : true
  const searchFields = texts.map((field) => `item.${field.name}${field.optional ? " ?? ''" : ''}`)
  const onlyName = texts.length === 1 && texts[0] !== undefined && isLegacy(texts[0])
  const searchPhrase =
    texts.length === 0
      ? 'pelo id'
      : onlyName
        ? 'pelo nome'
        : texts.length === 1
          ? `pelo campo ${texts[0]!.name}`
          : listOf(texts.map((field) => field.name))
  const searchBy = texts[0]
  // O enum repete valores entre os registros de exemplo: não serve para o teste de ordem
  const sortBy = sortable.find((field) => field.type !== 'enum' && field.type !== 'boolean')
  const sortValue = (n: number) =>
    literal(sortBy ? sampleValue(sortBy, n) : `2026-01-${['05', '14', '23'][n - 1]}T12:00:00.000Z`)
  const edit = inputs[0] ?? fields[0]!
  const records = [1, 2, 3].map((n) => {
    const entries = [
      `id: '${idBase}-${n}'`,
      ...fields.map((field) => `${field.name}: ${literal(sampleValue(field, n))}`),
      `createdAt: '2026-01-${['05', '14', '23'][n - 1]}T12:00:00.000Z'`,
    ]
    return `  ${object(entries, '  ')},`
  })
  const accessor = (field: Field) =>
    `      ${field.name}: (item) => item.${field.name}${field.optional ? (field.type === 'string' || field.type === 'enum' ? " ?? ''" : ' ?? 0') : ''},`
  const searchHit = searchBy ? sampleValue(searchBy, 2) : `${idBase}-2`
  return {
    'fields.schema': fields.map((field) => `  ${field.name}: ${zodOf(field)},`).join('\n'),
    'fields.pick': object(
      fields.map((field) => `${field.name}: true`),
      '',
      // `export const <entidade>InputSchema = <entidade>Schema.pick(` e o `)` do fim
      { max: WIDE, prefix: 'export const InputSchema = Schema.pick()'.length + 2 * idBase.length },
    ),
    'fields.sortKeys': union([...sortable.map((field) => `'${field.name}'`), "'createdAt'"], idBase),
    'fields.searchPhrase': searchPhrase,
    'fields.search': searchStatement(searchFields.length > 0 ? searchFields : ['item.id']),
    'fields.sortAccessors': [
      ...sortable.map(accessor),
      ...(sortsByDate ? ['      createdAt: (item) => item.createdAt,'] : []),
    ].join('\n'),
    // O campo fora do `pick` não vem na entrada: o mock dá um valor de exemplo (os opcionais ficam sem)
    'fields.create': fields
      .flatMap((field) =>
        inputs.includes(field)
          ? [`      ${field.name}: input.${field.name},`]
          : field.optional
            ? []
            : [`      ${field.name}: ${literal(sampleValue(field, 4))},`],
      )
      .join('\n'),
    'fields.fixtures': records.join('\n'),
    'test.searchField': searchBy ? searchBy.name : 'id',
    'test.searchTerm': literal(String(searchHit).toUpperCase()),
    'test.searchHit': literal(searchHit),
    'test.sortKey': sortBy ? sortBy.name : 'createdAt',
    'test.sortFirst': sortValue(3),
    'test.sortSecond': sortValue(2),
    'test.newInput': object(
      inputs.map((field) => `${field.name}: ${literal(sampleValue(field, 4))}`),
      '      ',
      // `expect(created).toMatchObject(` e o `)`
      { max: WIDE, prefix: 'expect(created).toMatchObject()'.length },
    ),
    'test.editName': edit.name,
    'test.editValue': literal(editValue(edit)),
    'test.partialValue': literal(editValue(edit, true)),
  }
}

/** O que uma tela com `--domain` mostra do registro, lido do que o projeto tem. */
export interface DomainShape {
  /** O campo que a tela mostra: o primeiro de texto, ou `id`. */
  field: string
  /** O texto desse campo no primeiro registro das fixtures, se deu para ler. */
  sample?: string
  /** Por que a tela usa o `id`, quando o campo de texto não foi descoberto. */
  warning?: string
}

/** O corpo do `z.object({ ... })` do schema `<camel>Schema`, se achar. */
function schemaBody(source: string, camel: string): string | undefined {
  const start = new RegExp(`\\b${camel}Schema\\s*=\\s*z\\.object\\(\\{`).exec(source)
  if (!start) return undefined
  const rest = source.slice(start.index + start[0].length)
  const end = /^\s*\}\)/m.exec(rest)
  return end ? rest.slice(0, end.index) : rest
}

/** O primeiro valor entre aspas de `campo:` no texto das fixtures (`id: 'a-1'`). */
function firstValue(fixtures: string | undefined, field: string): string | undefined {
  if (fixtures === undefined) return undefined
  const match = new RegExp(`\\b${field}\\s*:\\s*(?:'((?:[^'\\\\\\n])*)'|"((?:[^"'\\\\\\n])*)")`).exec(
    fixtures,
  )
  return match ? (match[1] ?? match[2]) : undefined
}

/** O `id` do primeiro registro das fixtures, se deu para ler. */
export function domainIdSample(fixtures: string | undefined): { sample?: string } {
  const sample = firstValue(fixtures, 'id')
  return sample === undefined ? {} : { sample }
}

/**
 * Descobre o que mostrar de um registro do domínio, do schema e das fixtures que existem hoje (o app
 * pode ter editado os dois depois do `make:domain`). O campo é o primeiro de texto obrigatório
 * (`z.string()`, fora `id` e `createdAt`), ou o primeiro de texto opcional; sem nenhum, ou sem achar o
 * schema, é o `id`, com um aviso.
 */
export function domainShapeOf(
  schema: { file: string; source: string | undefined; camel: string | undefined },
  fixtures: string | undefined,
): DomainShape {
  const body = schema.source && schema.camel ? schemaBody(schema.source, schema.camel) : undefined
  const idSample = firstValue(fixtures, 'id')
  const withId = (reason: string): DomainShape => ({
    field: 'id',
    ...(idSample === undefined ? {} : { sample: idSample }),
    warning: `${reason}: a tela mostra o id do registro. Troque pelo campo certo na view (e no teste).`,
  })
  if (body === undefined) return withId(`não consegui ler o schema do domínio (${schema.file})`)

  const texts: { name: string; optional: boolean }[] = []
  for (const line of body.split('\n')) {
    const match = /^\s*([A-Za-z_]\w*)\s*:\s*z\.string\(\)(.*)$/.exec(line)
    if (!match || match[1] === 'id' || match[1] === 'createdAt') continue
    texts.push({ name: match[1]!, optional: /\.optional\(\)|\.nullish\(\)/.test(match[2] ?? '') })
  }
  const chosen = texts.find((text) => !text.optional) ?? texts[0]
  if (!chosen) return withId(`o schema do domínio (${schema.file}) não tem campo de texto`)
  const sample = firstValue(fixtures, chosen.name)
  return { field: chosen.name, ...(sample === undefined ? {} : { sample }) }
}

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

/** Um valor de enum que o `--fields` aceita: letras, números e `_`, começando por letra. */
const ENUM_VALUE = /^[A-Za-z][A-Za-z0-9_]*$/

/**
 * O tipo do campo a partir da expressão do zod (sem o `.optional()` do fim), lida da árvore. Devolve
 * o tipo, ou o motivo (texto) se não é um dos tipos do `--fields` ou se o enum tem um valor que o
 * `--fields` não aceitaria.
 */
function typeOfZod(expression: Node): Omit<Field, 'name' | 'optional'> | string {
  const simple = SIMPLE_ZOD[expression.getText().replace(/\s+/g, '')]
  if (simple) return { type: simple }
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

/**
 * Lê os campos da entidade em `src/schemas/entities/<entidade>.ts`, com o ts-morph: acha o
 * `z.object({ ... })` do `<entidade>Schema` e reconhece cada campo (fora `id` e `createdAt`) pelos
 * tipos do `--fields`, com o `.optional()`, lendo a árvore (os valores do enum são os literais do
 * array, com a vírgula final ou não). Devolve os mesmos `Field[]` que o `parseFields` leu na hora
 * de gerar o schema, na ordem do arquivo. É o contrato do `make:repository` e do `make:query` com
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
  const fields: Field[] = []
  const seen = new Set<string>()
  for (const property of object.getProperties()) {
    const line = property.getStartLineNumber()
    if (!Node.isPropertyAssignment(property) || !Node.isIdentifier(property.getNameNode())) {
      fail(
        line,
        `não reconheço '${property.getText().split('\n')[0]}' no ${names.singular.camel}Schema (só campos 'nome: z.tipo()', com o nome sem aspas, nos tipos do --fields)`,
      )
    }
    const name = (property as PropertyAssignment).getName()
    const initializer = (property as PropertyAssignment).getInitializer()
    if (seen.has(name)) fail(line, `o campo '${name}' aparece mais de uma vez`)
    seen.add(name)
    if (!initializer) fail(line, `o campo '${name}' não tem tipo`)
    const { inner, optional } = withoutOptional(initializer!)
    if (RESERVED_FIELDS.has(name)) {
      const parsedType = typeOfZod(inner)
      if (optional || typeof parsedType === 'string' || parsedType.type !== 'string') {
        fail(line, `o campo '${name}' precisa ser z.string(): o repositório dá ${name} a todo registro`)
      }
      continue
    }
    if (!/^[a-z][A-Za-z0-9]*$/.test(name)) {
      fail(line, `'${name}' não é um nome em camelCase (letra minúscula primeiro; só letras e números)`)
    }
    const parsed = typeOfZod(inner)
    if (typeof parsed === 'string') fail(line, `campo '${name}': ${parsed}`)
    fields.push({ name, ...(parsed as Omit<Field, 'name' | 'optional'>), optional })
  }
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
 * Os schemas de `src/schemas/entities/` que nenhum repositório usa, quando a entidade pedida é a
 * derivada do domínio: o schema pode ter saído do `make:schema` com `--entity`, e a pessoa esqueceu
 * de repetir a opção. Sem candidatos (ou com `--entity` explícito diferente da derivada), `''`.
 */
function unusedSchemasHint(plan: ChangePlan, names: DomainNames): string {
  if (entityFlag(names) !== '') return ''
  const entities = path.join(plan.project.src, 'schemas', 'entities')
  if (!existsSync(entities)) return ''
  const repositories = path.join(plan.project.src, 'repositories')
  const contracts = existsSync(repositories)
    ? readdirSync(repositories, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(repositories, entry.name, 'repository.contract.ts'))
        .filter((file) => existsSync(file))
        .map((file) => readFileSync(file, 'utf8'))
    : []
  const candidates = readdirSync(entities)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => file.slice(0, -3))
    .filter((kebab) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(kebab))
    .filter((kebab) => {
      // O nome exato (`PedidoSchema`, com limite de palavra): `PedidoItemSchema` não esconde `item`
      const used = new RegExp(`\\b${deriveNames(kebab).pascal}Schema\\b`)
      return !contracts.some((text) => used.test(text))
    })
  if (candidates.length === 0) return ''
  return ` Se o schema saiu do make:schema com --entity, repita a opção; schemas sem repositório: ${candidates.join(', ')}.`
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
      `não achei 'export const ${inputName} = ${expected}({ campo: true, ... })': só o .pick({ ... }) é aceito (o .omit({ ... }) não), então liste no .pick os campos que entram na criação`,
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
