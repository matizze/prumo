import path from 'node:path'
import { Node, type ObjectLiteralExpression } from 'ts-morph'
import { UsageError } from '../errors.ts'
import type { DomainNames } from './names.ts'
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
): Record<string, string> {
  const texts = fields.filter(isText)
  const sortable = fields.filter(isSortable)
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
  const sortBy = sortable.find((field) => field.type !== 'enum')
  const sortValue = (n: number) =>
    literal(sortBy ? sampleValue(sortBy, n) : `2026-01-${['05', '14', '23'][n - 1]}T12:00:00.000Z`)
  const edit = fields[0]!
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
      '      createdAt: (item) => item.createdAt,',
    ].join('\n'),
    'fields.create': fields.map((field) => `      ${field.name}: input.${field.name},`).join('\n'),
    'fields.fixtures': records.join('\n'),
    'test.searchField': searchBy ? searchBy.name : 'id',
    'test.searchTerm': literal(String(searchHit).toUpperCase()),
    'test.searchHit': literal(searchHit),
    'test.sortKey': sortBy ? sortBy.name : 'createdAt',
    'test.sortFirst': sortValue(3),
    'test.sortSecond': sortValue(2),
    'test.newInput': object(
      fields.map((field) => `${field.name}: ${literal(sampleValue(field, 4))}`),
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
  if (initializer.getExpression().getText() !== 'z.object') return undefined
  const [argument] = initializer.getArguments()
  return argument && Node.isObjectLiteralExpression(argument) ? argument : undefined
}

/** O tipo do campo a partir do texto do zod, sem espaços nem o `.optional()` do fim; `undefined` se não é um dos tipos do `--fields`. */
function fieldOfZod(zod: string): Omit<Field, 'name' | 'optional'> | undefined {
  const optionalless = zod.replace(/\s+/g, '')
  const simple = {
    'z.string()': 'string',
    'z.number()': 'number',
    'z.number().int()': 'int',
    'z.boolean()': 'boolean',
    'z.iso.date()': 'date',
    'z.iso.datetime()': 'datetime',
  } as const
  const type = (simple as Record<string, FieldType | undefined>)[optionalless]
  if (type) return { type }
  const list = /^z\.enum\(\[(.*)\]\)$/.exec(optionalless)?.[1]
  if (list === undefined) return undefined
  const values = list.split(',').map((item) => /^(['"])([A-Za-z][A-Za-z0-9_]*)\1$/.exec(item)?.[2])
  if (values.length < 2 || values.some((value) => value === undefined)) return undefined
  return { type: 'enum', values: values as string[] }
}

/**
 * Lê os campos da entidade em `src/schemas/entities/<entidade>.ts`, com o ts-morph: acha o
 * `z.object({ ... })` do `<entidade>Schema` e reconhece cada campo (fora `id` e `createdAt`) pelos
 * tipos do `--fields`, com o `.optional()`. Devolve os mesmos `Field[]` que o `parseFields` leu na
 * hora de gerar o schema, na ordem do arquivo. É o contrato do `make:repository` e do `make:query`
 * com o `make:schema`. Erro de uso (`UsageError`, saída 2): o schema não existe (com a dica do
 * `make:schema`), não tem o `z.object` ou tem um campo que não é dos tipos do `--fields`
 * (o schema foi editado à mão), com o arquivo, a linha e o nome do campo.
 */
export function readEntityFields(plan: ChangePlan, names: DomainNames): Field[] {
  const relative = schemaFile(names)
  const file = path.join(plan.project.root, relative)
  if (!plan.hasFile(file)) {
    throw new UsageError(
      `falta o schema ${names.plural.kebab} (${relative}); rode prumo make:schema ${names.plural.kebab}.`,
    )
  }
  const object = schemaObject(plan, names, file)
  if (!object) {
    throw new UsageError(
      `${relative} não tem 'export const ${names.singular.camel}Schema = z.object({ ... })': não sei ler os campos.`,
    )
  }
  const fields: Field[] = []
  for (const property of object.getProperties()) {
    const line = property.getStartLineNumber()
    if (!Node.isPropertyAssignment(property)) {
      throw new UsageError(
        `${relative}:${line}: não reconheço '${property.getText().split('\n')[0]}' no ${names.singular.camel}Schema (só campos 'nome: z.tipo()', nos tipos do --fields).`,
      )
    }
    const name = property.getName()
    if (RESERVED_FIELDS.has(name)) continue
    const text = (property.getInitializer()?.getText() ?? '').replace(/\s+/g, '')
    const optional = text.endsWith('.optional()')
    const parsed = fieldOfZod(optional ? text.slice(0, -'.optional()'.length) : text)
    if (!parsed) {
      throw new UsageError(
        `${relative}:${line}: não reconheço o tipo do campo '${name}' (${property.getInitializer()?.getText().replace(/\s+/g, ' ') ?? 'sem valor'}). O Prumo lê string, number, int, boolean, date, datetime e enum, com .optional() (z.string(), z.number().int(), z.iso.date(), z.enum([...])...).`,
      )
    }
    fields.push({ name, ...parsed, optional })
  }
  if (fields.length === 0) {
    throw new UsageError(`${relative}: o ${names.singular.camel}Schema não tem nenhum campo além de id e createdAt.`)
  }
  return fields
}
