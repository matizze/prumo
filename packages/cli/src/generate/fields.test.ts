import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import {
  DEFAULT_FIELDS,
  domainFieldVars,
  domainShapeOf,
  editValue,
  literal,
  parseFields,
  sampleValue,
  zodOf,
} from './fields.ts'

describe('parseFields', () => {
  it('lê nome:tipo separados por vírgula, com espaços e o ? de opcional', () => {
    expect(parseFields('titulo:string, ano:number ,apelido?:string,publicadoEm:date,lidoEm:datetime,ok:boolean')).toEqual([
      { name: 'titulo', type: 'string', optional: false },
      { name: 'ano', type: 'number', optional: false },
      { name: 'apelido', type: 'string', optional: true },
      { name: 'publicadoEm', type: 'date', optional: false },
      { name: 'lidoEm', type: 'datetime', optional: false },
      { name: 'ok', type: 'boolean', optional: false },
    ])
  })

  it.each([
    ['', 'a lista de campos está vazia'],
    ['titulo', "'titulo' não está no formato nome:tipo"],
    ['titulo:string:x', 'não está no formato nome:tipo'],
    ['titulo:string,', 'vírgula sobrando'],
    ['Titulo:string', 'não é um nome em camelCase'],
    ['data_nascimento:date', 'não é um nome em camelCase'],
    ['1a:string', 'não é um nome em camelCase'],
    [':string', 'não é um nome em camelCase'],
    ['id:string', "'id' é reservado"],
    ['createdAt:date', "'createdAt' é reservado"],
    ['a:string,a:number', "o campo 'a' aparece mais de uma vez"],
    ['a:text', "'text' não é um tipo de 'a'"],
    ['a:', "'' não é um tipo de 'a'"],
  ])('recusa %j', (text, reason) => {
    expect(() => parseFields(text)).toThrow(UsageError)
    expect(() => parseFields(text)).toThrow(reason)
  })

  it('a mensagem de erro traz o formato esperado', () => {
    expect(() => parseFields('a:text')).toThrow('Formato: nome:tipo separados por vírgula')
  })
})

describe('valores de exemplo', () => {
  it('o campo name de texto segue os exemplos de sempre', () => {
    const [name] = DEFAULT_FIELDS
    expect([1, 2, 3, 4].map((n) => sampleValue(name!, n))).toEqual([
      'Exemplo 1',
      'Exemplo 2',
      'Exemplo 3',
      'Novo',
    ])
    expect(editValue(name!)).toBe('Renomeado')
    expect(editValue(name!, true)).toBe('Parcial')
  })

  it('cada tipo tem valores crescentes (a ordem do contrato é previsível) e editado diferente', () => {
    const [titulo, ano, ok, dia, hora] = parseFields(
      'tituloDoLivro:string,ano:number,ok:boolean,dia:date,hora:datetime',
    )
    expect([1, 2, 3].map((n) => sampleValue(titulo!, n))).toEqual([
      'Titulo do livro 1',
      'Titulo do livro 2',
      'Titulo do livro 3',
    ])
    expect([1, 2, 3].map((n) => sampleValue(ano!, n))).toEqual([10, 20, 30])
    expect([1, 2, 3].map((n) => sampleValue(ok!, n))).toEqual([true, false, true])
    expect([1, 2, 3].map((n) => sampleValue(dia!, n))).toEqual(['2026-01-05', '2026-01-14', '2026-01-23'])
    expect(sampleValue(hora!, 2)).toBe('2026-01-14T12:00:00.000Z')
    expect(editValue(ok!)).toBe(!sampleValue(ok!, 1))
    expect(editValue(ano!)).not.toBe(sampleValue(ano!, 1))
  })

  it('literal escapa o texto', () => {
    expect(literal("it's \\")).toBe("'it\\'s \\\\'")
    expect(literal(10)).toBe('10')
    expect(literal(false)).toBe('false')
  })
})

describe('zodOf', () => {
  it('traduz cada tipo, com o .optional()', () => {
    const fields = parseFields('a:string,b:number,c:boolean,d:date,e:datetime,f?:number')
    expect(fields.map(zodOf)).toEqual([
      'z.string()',
      'z.number()',
      'z.boolean()',
      'z.iso.date()',
      'z.iso.datetime()',
      'z.number().optional()',
    ])
  })
})

describe('domainFieldVars', () => {
  it('sem --fields o campo name gera o que o make:domain sempre gerou', () => {
    const vars = domainFieldVars(DEFAULT_FIELDS, 'cliente')

    expect(vars['fields.schema']).toBe('  name: z.string(),')
    expect(vars['fields.pick']).toBe('name: true')
    expect(vars['fields.sortKeys']).toBe("'name' | 'createdAt'")
    expect(vars['fields.searchPhrase']).toBe('pelo nome')
    expect(vars['fields.search']).toBe('item.name')
    expect(vars['fields.fixtures']).toBe(
      [1, 2, 3]
        .map(
          (n) =>
            `  { id: 'cliente-${n}', name: 'Exemplo ${n}', createdAt: '2026-01-${['05', '14', '23'][n - 1]}T12:00:00.000Z' },`,
        )
        .join('\n'),
    )
    expect(vars['test.searchTerm']).toBe("'EXEMPLO 2'")
    expect(vars['test.sortFirst']).toBe("'Exemplo 3'")
  })

  it('busca nos campos de texto (o opcional com ?? \'\'), ordena menos pelo booleano', () => {
    const vars = domainFieldVars(
      parseFields('titulo:string,apelido?:string,ano:number,ok:boolean,vistoEm?:date'),
      'livro',
    )

    expect(vars['fields.search']).toBe("item.titulo, item.apelido ?? ''")
    expect(vars['fields.searchPhrase']).toBe('pelos campos titulo, apelido')
    expect(vars['fields.sortKeys']).toBe("'titulo' | 'apelido' | 'ano' | 'vistoEm' | 'createdAt'")
    expect(vars['fields.sortAccessors']).toContain("apelido: (item) => item.apelido ?? '',")
    expect(vars['fields.sortAccessors']).not.toContain('ok:')
    expect(vars['fields.create']).toContain('      ok: input.ok,')
    expect(vars['test.sortKey']).toBe('titulo')
    expect(vars['test.newInput']).toBe(
      "titulo: 'Titulo 4', apelido: 'Apelido 4', ano: 40, ok: false, vistoEm: '2026-02-01'",
    )
    expect(vars['test.editName']).toBe('titulo')
  })

  it('sem campo de texto busca pelo id; sem campo que ordene, ordena pelo createdAt', () => {
    const vars = domainFieldVars(parseFields('ativo:boolean'), 'aviso')

    expect(vars['fields.search']).toBe('item.id')
    expect(vars['fields.searchPhrase']).toBe('pelo id')
    expect(vars['test.searchField']).toBe('id')
    expect(vars['test.searchTerm']).toBe("'AVISO-2'")
    expect(vars['test.sortKey']).toBe('createdAt')
    expect(vars['test.sortFirst']).toBe("'2026-01-23T12:00:00.000Z'")
    expect(vars['fields.sortKeys']).toBe("'createdAt'")
  })

  it('quebra a fixture em linhas quando passa da largura', () => {
    const vars = domainFieldVars(parseFields('titulo:string,autor:string,assunto:string,editora:string'), 'livro')

    expect(vars['fields.fixtures']).toContain("  {\n    id: 'livro-1',\n    titulo: 'Titulo 1',")
  })
})

describe('domainShapeOf', () => {
  const schema = (fields: string) => ({
    file: 'src/schemas/entities/livro.ts',
    camel: 'livro',
    source: `export const livroSchema = z.object({\n  id: z.string(),\n${fields}  createdAt: z.string(),\n})\n`,
  })

  it('pega o primeiro campo de texto obrigatório e o valor dele na primeira fixture', () => {
    const shape = domainShapeOf(
      schema('  ano: z.number(),\n  apelido: z.string().optional(),\n  titulo: z.string(),\n'),
      "[{ id: 'livro-1', ano: 1, apelido: 'a', titulo: 'Dom Casmurro' }]",
    )

    expect(shape).toEqual({ field: 'titulo', sample: 'Dom Casmurro' })
  })

  it('só com campo de texto opcional, usa o primeiro deles', () => {
    expect(domainShapeOf(schema('  apelido: z.string().optional(),\n'), undefined).field).toBe('apelido')
  })

  it('datas (z.iso.date) não são campo de texto', () => {
    const shape = domainShapeOf(schema('  publicadoEm: z.iso.date(),\n'), "{ id: 'livro-1' }")

    expect(shape.field).toBe('id')
    expect(shape.sample).toBe('livro-1')
    expect(shape.warning).toContain('não tem campo de texto')
  })

  it('sem schema legível, usa o id e diz por quê', () => {
    const shape = domainShapeOf({ file: 'src/schemas/entities/livro.ts', source: undefined, camel: 'livro' }, undefined)

    expect(shape.field).toBe('id')
    expect(shape.warning).toContain('não consegui ler o schema')
  })
})
