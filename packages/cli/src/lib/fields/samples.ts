import { enumValues, isDefaultName, type Field } from './types.ts'

/** Um valor de exemplo, como entra no código. */
type Value = string | number | boolean

/** Um valor como literal do TypeScript: texto entre aspas simples, o resto como está. */
export function literal(value: Value): string {
  return typeof value === 'string'
    ? `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
    : String(value)
}

/** `publicadoEm` vira `Publicado em`: o nome do campo como texto de exemplo. */
function camelToSentence(name: string): string {
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
      if (isDefaultName(field)) return n === 4 ? 'Novo' : `Exemplo ${n}`
      return `${camelToSentence(field.name)} ${n}`
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
      if (isDefaultName(field)) return partial ? 'Parcial' : 'Renomeado'
      return `${camelToSentence(field.name)} editado`
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

/** Um exemplo de dado: um valor, uma lista, um objeto ou `undefined` (o `void`). */
export type Sample = Value | undefined | Sample[] | { [key: string]: Sample }

/** O objeto de exemplo `n` com os campos; com `entity`, leva também o `id` (`livro-1`) e o `createdAt` de uma entidade. */
export function sampleRecord(fields: readonly Field[], n: number, entity?: string): Record<string, Value> {
  const record = Object.fromEntries(fields.map((field) => [field.name, sampleValue(field, n)]))
  if (entity === undefined) return record
  return {
    id: `${entity}-${n}`,
    ...record,
    createdAt: `${DAYS[n - 1] ?? DAYS[3]}T12:00:00.000Z`,
  }
}

/** A largura em que um objeto ou lista de exemplo passa a ocupar uma linha por entrada. */
const INLINE_MAX = 80

/**
 * O exemplo como código do TypeScript: numa linha, se cabe, ou com uma entrada por linha (recuo de
 * 2 espaços). `indent` é o recuo da linha onde o código começa.
 */
export function sampleCode(sample: Sample, indent = ''): string {
  if (sample === undefined) return 'undefined'
  if (typeof sample !== 'object') return literal(sample)
  const isList = Array.isArray(sample)
  const entries = isList
    ? sample.map((item) => sampleCode(item, `${indent}  `))
    : Object.entries(sample).map(([key, value]) => `${key}: ${sampleCode(value, `${indent}  `)}`)
  const [open, close] = isList ? ['[', ']'] : ['{', '}']
  const inline = isList ? `[${entries.join(', ')}]` : `{ ${entries.join(', ')} }`
  if (entries.length === 0) return `${open}${close}`
  if (indent.length + inline.length <= INLINE_MAX && !inline.includes('\n')) return inline
  return `${open}\n${entries.map((entry) => `${indent}  ${entry},`).join('\n')}\n${indent}${close}`
}
