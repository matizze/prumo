import { UsageError } from '../errors.ts'

/** Os tipos que o `--fields` aceita, e o que cada um vira no schema zod. */
export const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'datetime'] as const

export type FieldType = (typeof FIELD_TYPES)[number]

/** Um campo da entidade. */
export interface Field {
  /** O nome, em camelCase (`publicadoEm`). */
  name: string
  type: FieldType
  /** Campo opcional (`apelido?:string`): o schema aceita a falta dele. */
  optional: boolean
}

/** Os nomes que o repositório já dá ao registro: o `--fields` não pode redefini-los. */
export const RESERVED_FIELDS: ReadonlySet<string> = new Set(['id', 'createdAt'])

/** O campo que um domínio sem `--fields` tem: o `name` de texto, como sempre foi. */
export const DEFAULT_FIELDS: readonly Field[] = [{ name: 'name', type: 'string', optional: false }]

/** O formato aceito, para as mensagens de erro. */
const SYNTAX = `nome:tipo separados por vírgula, por exemplo "titulo:string,ano:number,apelido?:string" (tipos: ${FIELD_TYPES.join(', ')}; ? depois do nome torna o campo opcional)`

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
    const type = FIELD_TYPES.find((candidate) => candidate === typeText)
    if (!type) bad(`'${typeText}' não é um tipo de '${name}' (use ${FIELD_TYPES.join(', ')})`)
    fields.push({ name, type: type!, optional })
  }
  return fields
}

/** O texto do campo na lista de uma saída: `titulo (string)`, `apelido (string, opcional)`. */
export function describeField(field: Field): string {
  return `${field.name} (${field.type}${field.optional ? ', opcional' : ''})`
}

/** Um valor de exemplo, como entra no código. */
type Value = string | number | boolean

/** Um valor como literal do TypeScript: texto entre aspas simples, o resto como está. */
export function literal(value: Value): string {
  return typeof value === 'string'
    ? `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
    : String(value)
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
      return n * 10
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
      return 999
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
    boolean: 'z.boolean()',
    date: 'z.iso.date()',
    datetime: 'z.iso.datetime()',
  }[field.type]
  return field.optional ? `${base}.optional()` : base
}

const isText = (field: Field) => field.type === 'string'

/** Os campos pelos quais a lista ordena: tudo menos o booleano (que não tem ordem útil). */
const isSortable = (field: Field) => field.type !== 'boolean'

/** Um objeto numa linha só, ou um por linha se passar de `max` colunas. */
function object(entries: string[], indent: string, max = 90): string {
  const inline = `{ ${entries.join(', ')} }`
  if (indent.length + inline.length <= max) return inline
  return `{\n${entries.map((entry) => `${indent}  ${entry},`).join('\n')}\n${indent}}`
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
          : `pelos campos ${texts.map((field) => field.name).join(', ')}`
  const searchBy = texts[0]
  const sortBy = sortable[0]
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
    `      ${field.name}: (item) => item.${field.name}${field.optional ? (field.type === 'string' ? " ?? ''" : ' ?? 0') : ''},`
  const searchHit = searchBy ? sampleValue(searchBy, 2) : `${idBase}-2`
  return {
    'fields.schema': fields.map((field) => `  ${field.name}: ${zodOf(field)},`).join('\n'),
    'fields.pick': fields.map((field) => `${field.name}: true`).join(', '),
    'fields.sortKeys': [...sortable.map((field) => `'${field.name}'`), "'createdAt'"].join(' | '),
    'fields.searchPhrase': searchPhrase,
    'fields.search': searchFields.length > 0 ? searchFields.join(', ') : 'item.id',
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
    'test.newInput': fields.map((field) => `${field.name}: ${literal(sampleValue(field, 4))}`).join(', '),
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
