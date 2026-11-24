import { describe, expect, it } from 'vitest'
import { UsageError } from '../../errors.ts'
import { domainFieldVars, zodOf } from './generate.ts'
import { describeField, parseFields } from './parse.ts'
import { editValue, sampleValue } from './samples.ts'
import { domainShapeOf } from './page-shape.ts'
import { DEFAULT_FIELDS } from './types.ts'

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
  it('sem --fields, o schema tem só o campo name', () => {
    const vars = domainFieldVars(DEFAULT_FIELDS, 'cliente')

    expect(vars['fields.schema']).toBe('  name: z.string(),')
    expect(vars['fields.pick']).toBe('{ name: true }')
    expect(vars['fields.sortKeys']).toBe(" 'name' | 'createdAt'")
    expect(vars['fields.searchPhrase']).toBe('pelo nome')
    expect(vars['fields.search']).toBe(
      'const filtered = this.items.filter((item) => matchesSearch([item.name], query.search))',
    )
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

    expect(vars['fields.search']).toBe(
      "const filtered = this.items.filter((item) =>\n      matchesSearch([item.titulo, item.apelido ?? ''], query.search),\n    )",
    )
    expect(vars['fields.searchPhrase']).toBe('pelos campos titulo, apelido')
    expect(vars['fields.sortKeys']).toBe(" 'titulo' | 'apelido' | 'ano' | 'vistoEm' | 'createdAt'")
    expect(vars['fields.sortAccessors']).toContain("apelido: (item) => item.apelido ?? '',")
    expect(vars['fields.sortAccessors']).not.toContain('ok:')
    expect(vars['fields.create']).toContain('      ok: input.ok,')
    expect(vars['test.sortKey']).toBe('titulo')
    expect(vars['test.newInput']).toBe(
      "{\n        titulo: 'Titulo 4',\n        apelido: 'Apelido 4',\n        ano: 40,\n        ok: false,\n        vistoEm: '2026-02-01',\n      }",
    )
    expect(vars['test.editName']).toBe('titulo')
  })

  it('sem campo de texto busca pelo id; sem campo que ordene, ordena pelo createdAt', () => {
    const vars = domainFieldVars(parseFields('ativo:boolean'), 'aviso')

    expect(vars['fields.search']).toBe(
      'const filtered = this.items.filter((item) => matchesSearch([item.id], query.search))',
    )
    expect(vars['fields.searchPhrase']).toBe('pelo id')
    expect(vars['test.searchField']).toBe('id')
    expect(vars['test.searchTerm']).toBe("'AVISO-2'")
    expect(vars['test.sortKey']).toBe('createdAt')
    expect(vars['test.sortFirst']).toBe("'2026-01-23T12:00:00.000Z'")
    expect(vars['fields.sortKeys']).toBe(" 'createdAt'")
  })

  it('quebra a fixture em linhas quando passa da largura', () => {
    const vars = domainFieldVars(parseFields('titulo:string,autor:string,assunto:string,editora:string'), 'livro')

    expect(vars['fields.fixtures']).toContain("  {\n    id: 'livro-1',\n    titulo: 'Titulo 1',")
  })
})

describe('int e enum', () => {
  it('lê int e enum(a|b|c), com ? e espaços', () => {
    expect(parseFields('ano:int, status:enum(ativo|inativo|pendente),papel?:enum( admin | user )')).toEqual([
      { name: 'ano', type: 'int', optional: false },
      { name: 'status', type: 'enum', values: ['ativo', 'inativo', 'pendente'], optional: false },
      { name: 'papel', type: 'enum', values: ['admin', 'user'], optional: true },
    ])
  })

  it.each([
    ['a:enum', 'o enum leva os valores'],
    ['a:enum()', "'' não é um valor válido de 'a'"],
    ['a:enum(x)', "o enum 'a' precisa de pelo menos dois valores"],
    ['a:enum(x|x)', "o valor 'x' aparece mais de uma vez em 'a'"],
    ['a:enum(x|y z)', "'y z' não é um valor válido de 'a'"],
    ['a:enum(x|1y)', "'1y' não é um valor válido de 'a'"],
    ['a:enum(x|y', "não é um tipo de 'a'"],
  ])('recusa %j', (text, reason) => {
    expect(() => parseFields(text)).toThrow(UsageError)
    expect(() => parseFields(text)).toThrow(reason)
  })

  it('traduz para o zod e descreve o campo', () => {
    const [ano, status, papel] = parseFields('ano:int,status:enum(ativo|inativo),papel?:enum(admin|user)')
    expect(zodOf(ano!)).toBe('z.number().int()')
    expect(zodOf(status!)).toBe("z.enum(['ativo', 'inativo'])")
    expect(zodOf(papel!)).toBe("z.enum(['admin', 'user']).optional()")
    expect(describeField(status!)).toBe('status (enum(ativo|inativo))')
    expect(describeField(ano!)).toBe('ano (int)')
  })

  it('as fixtures usam inteiros e valores da lista; a edição difere do primeiro registro', () => {
    const [ano, status] = parseFields('ano:int,status:enum(ativo|inativo|pendente)')
    expect([1, 2, 3, 4].map((n) => sampleValue(ano!, n))).toEqual([10, 20, 30, 40])
    expect([1, 2, 3, 4].map((n) => sampleValue(status!, n))).toEqual(['ativo', 'inativo', 'pendente', 'pendente'])
    expect(editValue(status!)).not.toBe(sampleValue(status!, 1))
  })

  it('o enum entra na SortKey e no mock, mas o teste de ordem usa outro campo', () => {
    const vars = domainFieldVars(parseFields('situacao:enum(a|b),papel?:enum(x|y),ano:int'), 'livro')
    expect(vars['fields.sortKeys']).toBe(" 'situacao' | 'papel' | 'ano' | 'createdAt'")
    expect(vars['fields.sortAccessors']).toContain("papel: (item) => item.papel ?? '',")
    expect(vars['fields.schema']).toContain("  situacao: z.enum(['a', 'b']),")
    expect(vars['fields.searchPhrase']).toBe('pelo id')
    expect(vars['test.sortKey']).toBe('ano')
  })

  it('make:page --query não trata o enum como texto de exibição', () => {
    const schema = {
      file: 'src/schemas/entities/livro.ts',
      camel: 'livro',
      source:
        "export const livroSchema = z.object({\n  id: z.string(),\n  status: z.enum(['a', 'b']),\n  titulo: z.string(),\n  createdAt: z.string(),\n})\n",
    }
    expect(domainShapeOf(schema, undefined).field).toBe('titulo')
    const only = domainShapeOf({ ...schema, source: schema.source.replace("  titulo: z.string(),\n", '') }, undefined)
    expect(only.field).toBe('id')
    expect(only.warning).toContain('não tem campo de texto')
  })
})

describe('formatação das listas longas', () => {
  const many = parseFields(
    'titulo:string,autor:string,assunto:string,editora:string,ano:int,paginas:int,idioma:string,situacao:enum(lido|lendo|desejado),disponivel:boolean,publicadoEm:date',
  )

  it('quebra o pick, a SortKey, a busca e a entrada do teste em várias linhas', () => {
    const vars = domainFieldVars(many, 'livro')
    expect(vars['fields.searchPhrase']).toBe('pelos campos de texto')
    expect(vars['fields.pick']).toMatch(/^\{\n {2}titulo: true,\n/)
    expect(vars['fields.pick']).toMatch(/\n {2}publicadoEm: true,\n\}$/)
    expect(vars['fields.sortKeys']).toMatch(/^\n {2}\| 'titulo'\n {2}\| 'autor'/)
    expect(vars['fields.sortKeys']).toMatch(/\n {2}\| 'createdAt'$/)
    expect(vars['fields.search']).toContain('matchesSearch([\n        item.titulo,\n')
    expect(vars['test.newInput']).toMatch(/^\{\n {8}titulo: 'Titulo 4',\n/)
    expect(vars['test.newInput']).toMatch(/\n {6}\}$/)
    for (const key of ['fields.pick', 'fields.sortKeys', 'fields.search', 'test.newInput']) {
      expect(Math.max(...vars[key]!.split('\n').map((line) => line.length))).toBeLessThan(100)
    }
  })

  it('lista curta continua numa linha só', () => {
    const vars = domainFieldVars(parseFields('titulo:string,ano:int'), 'livro')
    expect(vars['fields.pick']).toBe('{ titulo: true, ano: true }')
    expect(vars['fields.sortKeys']).toBe(" 'titulo' | 'ano' | 'createdAt'")
  })
})
