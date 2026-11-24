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

/** Um nome de campo: camelCase, começando por letra minúscula, só letras e números. */
export const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/

/** Um valor de enum que o `--fields` aceita: letras, números e `_`, começando por letra. */
export const ENUM_VALUE = /^[A-Za-z][A-Za-z0-9_]*$/

/** Os nomes que o repositório já dá ao registro: o `--fields` não pode redefini-los. */
export const RESERVED_FIELDS: ReadonlySet<string> = new Set(['id', 'createdAt'])

/** O campo que um domínio sem `--fields` tem: o `name` de texto. */
export const DEFAULT_FIELDS: readonly Field[] = [{ name: 'name', type: 'string', optional: false }]

/** Os valores do enum (um campo `enum` sempre os tem; o `Field` à mão pode esquecê-los). */
export function enumValues(field: Field): string[] {
  return field.values && field.values.length > 0 ? field.values : ['a', 'b']
}

/** O campo `name` de texto, o padrão do schema quando não há `--fields`: os exemplos dele têm texto próprio (`Exemplo 1`). */
export function isDefaultName(field: Field): boolean {
  return field.name === 'name' && field.type === 'string'
}
