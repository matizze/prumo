import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { fixtureProject } from '../codemods/test-support.ts'
import { generateSchema } from '../generators/schema.ts'
import { makeProject } from '../test-support.ts'
import { domainNames } from './names.ts'
import { ChangePlan } from './plan.ts'
import { findProject } from './project.ts'
import {
  DEFAULT_FIELDS,
  domainFieldVars,
  describeField,
  domainShapeOf,
  editValue,
  literal,
  parseFields,
  readEntityFields,
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

  it('make:page --domain não trata o enum como texto de exibição', () => {
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

describe('readEntityFields', () => {
  /** Gera o schema do `--fields` pelo gerador e lê de volta, do mesmo plano. */
  function roundTrip(fieldsText: string | undefined, entity?: string) {
    const { plan, names, fields } = generateSchema(fixtureProject(), {
      name: 'livros',
      entity,
      fields: fieldsText,
    })
    return { read: readEntityFields(plan, names), fields }
  }

  it.each([
    undefined,
    'titulo:string',
    'a:string,b:number,c:int,d:boolean,e:date,f:datetime,g:enum(x|y|z)',
    'a?:string,b?:number,c?:int,d?:boolean,e?:date,f?:datetime,g?:enum(lido|lendo)',
    'titulo:string,autor:string,ano:number,paginas:int,situacao:enum(lido|lendo|desejado),disponivel:boolean,publicadoEm:date,lidoEm?:datetime,apelido?:string',
    'id2:string, nota?:int',
  ])('lê de volta os campos que o --fields gerou: %s', (fieldsText) => {
    const { read, fields } = roundTrip(fieldsText)
    expect(read).toEqual(fields)
  })

  it('lê com a entidade informada (--entity)', () => {
    const { read, fields } = roundTrip('a:int', 'livro')
    expect(read).toEqual(fields)
  })

  const SCHEMA = (body: string) =>
    `import { z } from 'zod'\n\nexport const livroSchema = z.object({\n  id: z.string(),\n${body}\n  createdAt: z.string(),\n})\n`
  const names = domainNames('livros')
  const planWith = (source: string) =>
    new ChangePlan(findProject(makeProject({ 'src/schemas/entities/livro.ts': source })))

  it('lê um schema editado à mão com o mesmo estilo (espaços, aspas duplas, quebras)', () => {
    const plan = planWith(
      SCHEMA(`  titulo: z.string(),\n  nota: z\n    .number()\n    .int()\n    .optional(),\n  situacao: z.enum(["a", 'b']),`),
    )
    expect(readEntityFields(plan, names)).toEqual([
      { name: 'titulo', type: 'string', optional: false },
      { name: 'nota', type: 'int', optional: true },
      { name: 'situacao', type: 'enum', values: ['a', 'b'], optional: false },
    ])
  })

  it('campo que não reconhece vira UsageError com o arquivo, a linha e o nome do campo', () => {
    const plan = planWith(SCHEMA(`  titulo: z.string(),\n  preco: z.string().min(3),`))
    expect(() => readEntityFields(plan, names)).toThrow(UsageError)
    expect(() => readEntityFields(plan, names)).toThrow(
      /src\/schemas\/entities\/livro\.ts:6: campo 'preco': não reconheço o tipo \(z\.string\(\)\.min\(3\)\)/,
    )
  })

  it.each([
    ['z.array(z.string())'],
    ['z.string().nullable()'],
    ['z.enum(["a"])'],
    ["z.enum(['a', 'a'])"],
    ["z.enum(['em andamento', 'ok'])"],
    ["z.enum(['1a', 'b'])"],
    ['z.enum(valores)'],
    ['z.date()'],
    ['z.string().optional().optional()'],
  ])('recusa %s', (zod) => {
    const plan = planWith(SCHEMA(`  campo: ${zod},`))
    expect(() => readEntityFields(plan, names)).toThrow(/livro\.ts:5: campo 'campo'/)
  })

  it('recusa spread e atalho de propriedade, com a linha', () => {
    const plan = planWith(SCHEMA('  ...base,'))
    expect(() => readEntityFields(plan, names)).toThrow(/livro\.ts:5: não reconheço '\.\.\.base'/)
  })

  it('recusa o schema que não existe, com a dica do make:schema', () => {
    const plan = new ChangePlan(findProject(makeProject({}, ['src'])))
    expect(() => readEntityFields(plan, names)).toThrow(
      'falta o schema livros (src/schemas/entities/livro.ts); rode prumo make:schema livros.',
    )
  })

  it('a dica do schema que falta traz o --entity quando o singular não é o derivado', () => {
    const plan = new ChangePlan(findProject(makeProject({}, ['src'])))
    expect(() => readEntityFields(plan, domainNames('clientes', 'cli'))).toThrow(
      'rode prumo make:schema clientes --entity cli.',
    )
    expect(() => readEntityFields(plan, domainNames('categories', 'category'))).toThrow(
      'rode prumo make:schema categories --entity category.',
    )
    expect(() => readEntityFields(plan, domainNames('paes', 'pao'))).toThrow(
      'rode prumo make:schema paes --entity pao.',
    )
    // paes deriva pae: sem --entity
    expect(() => readEntityFields(plan, domainNames('paes'))).toThrow(/make:schema paes\.$/)
    expect(() => readEntityFields(plan, domainNames('paes'))).toThrow(
      'rode prumo make:schema paes.',
    )
    expect(() => readEntityFields(plan, domainNames('paes', 'paozinho'))).toThrow(
      '--entity paozinho.',
    )
  })

  it('reconhece id e createdAt pela árvore, também em várias linhas', () => {
    const plan = planWith(
      "export const livroSchema = z.object({\n  id: z\n    .string(),\n  titulo: z.string(),\n  createdAt: z\n    .string(),\n})\n",
    )
    expect(readEntityFields(plan, names)).toEqual([
      { name: 'titulo', type: 'string', optional: false },
    ])
    const optional = planWith(
      "export const livroSchema = z.object({\n  id: z.string().optional(),\n  titulo: z.string(),\n  createdAt: z.string(),\n})\n",
    )
    expect(() => readEntityFields(optional, names)).toThrow(/o campo 'id' precisa ser z\.string\(\)/)
  })

  it('não altera os valores do enum: espaços dentro das aspas são recusados, não apagados', () => {
    const plan = planWith(SCHEMA("  situacao: z.enum(['em andamento', 'concluido']),"))
    expect(() => readEntityFields(plan, names)).toThrow(
      /livro\.ts:5: campo 'situacao': o valor 'em andamento' do enum não é válido/,
    )
  })

  it('lê o enum em várias linhas com vírgula no fim (Prettier), obrigatório ou opcional', () => {
    const plan = planWith(
      SCHEMA(`  situacao: z.enum([
    'lido',
    'lendo',
    'desejado',
  ]),
  tipo: z
    .enum([
      'a',
      'b',
    ])
    .optional(),`),
    )
    expect(readEntityFields(plan, names)).toEqual([
      { name: 'situacao', type: 'enum', values: ['lido', 'lendo', 'desejado'], optional: false },
      { name: 'tipo', type: 'enum', values: ['a', 'b'], optional: true },
    ])
  })

  it.each([
    ["'nome-completo': z.string()", /livro\.ts:5: não reconheço/],
    ["['titulo']: z.string()", /livro\.ts:5: não reconheço/],
    ['1: z.string()', /livro\.ts:5: não reconheço/],
    ["'id': z.number()", /livro\.ts:5: não reconheço/],
    ['Titulo: z.string()', /'Titulo' não é um nome em camelCase/],
    ['nome_completo: z.string()', /não é um nome em camelCase/],
    ['titulo: z.string(), titulo: z.number()', /o campo 'titulo' aparece mais de uma vez/],
  ])('recusa o nome de campo %s', (field, message) => {
    const plan = planWith(SCHEMA(`  ${field},`))
    expect(() => readEntityFields(plan, names)).toThrow(UsageError)
    expect(() => readEntityFields(plan, names)).toThrow(message)
  })

  it('exige id e createdAt como z.string()', () => {
    const noId = planWith(
      "export const livroSchema = z.object({\n  titulo: z.string(),\n  createdAt: z.string(),\n})\n",
    )
    expect(() => readEntityFields(noId, names)).toThrow(/falta o campo 'id: z\.string\(\)'/)
    const noDate = planWith(
      "export const livroSchema = z.object({\n  id: z.string(),\n  titulo: z.string(),\n})\n",
    )
    expect(() => readEntityFields(noDate, names)).toThrow(/falta o campo 'createdAt/)
    const wrong = planWith(
      "export const livroSchema = z.object({\n  id: z.number(),\n  titulo: z.string(),\n  createdAt: z.string(),\n})\n",
    )
    expect(() => readEntityFields(wrong, names)).toThrow(/livro\.ts:2: o campo 'id' precisa ser z\.string\(\)/)
  })

  it('recusa o arquivo sem o z.object do schema e o schema sem campos', () => {
    expect(() => readEntityFields(planWith('export const x = 1\n'), names)).toThrow(
      /não tem 'export const livroSchema = z\.object/,
    )
    expect(() => readEntityFields(planWith(SCHEMA('')), names)).toThrow(/não tem nenhum campo/)
  })
})
