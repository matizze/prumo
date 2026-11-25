import { enumValues, isDefaultName, type Field } from './types.ts'
import { editValue, literal, sampleValue } from './samples.ts'

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
  /** O recuo das linhas de `fields.sortAccessors` (padrão: 6 espaços, o do mock do repositório). */
  sortIndent = '      ',
): Record<string, string> {
  const texts = fields.filter(isText)
  const inputs = shape ? fields.filter((field) => shape.input.includes(field.name)) : fields
  const sortable = shape
    ? fields.filter((field) => shape.sort.includes(field.name))
    : fields.filter(isSortable)
  const sortsByDate = shape ? shape.sort.includes('createdAt') : true
  const searchFields = texts.map((field) => `item.${field.name}${field.optional ? " ?? ''" : ''}`)
  const onlyName = texts.length === 1 && texts[0] !== undefined && isDefaultName(texts[0])
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
    `${sortIndent}${field.name}: (item) => item.${field.name}${field.optional ? (field.type === 'string' || field.type === 'enum' ? " ?? ''" : ' ?? 0') : ''},`
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
    'fields.searchList': (searchFields.length > 0 ? searchFields : ['item.id']).join(', '),
    'fields.search': searchStatement(searchFields.length > 0 ? searchFields : ['item.id']),
    'fields.sortAccessors': [
      ...sortable.map(accessor),
      ...(sortsByDate ? [`${sortIndent}createdAt: (item) => item.createdAt,`] : []),
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
