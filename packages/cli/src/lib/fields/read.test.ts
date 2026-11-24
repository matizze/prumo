import { describe, expect, it } from 'vitest'
import { UsageError } from '../../errors.ts'
import { fixtureProject } from '../../codemods/test-support.ts'
import { generateSchema } from '../../generators/schema.ts'
import { makeProject } from '../../test-support.ts'
import { domainNames } from '../names.ts'
import { ChangePlan } from '../plan.ts'
import { findProject } from '../project.ts'
import { readEntityFields, readEntityShape } from './read.ts'

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

describe('a dica do schema que falta, quando há schemas sem repositório', () => {
  it('sem --entity, lista os schemas que nenhum repositório usa e manda repetir a opção', () => {
    const root = makeProject({
      'src/schemas/entities/pao.ts': 'export const paoSchema = 1\n',
      'src/schemas/entities/usado.ts': 'export const usadoSchema = 1\n',
      'src/repositories/usados/repository.contract.ts': 'import type { UsadoSchema } from "@/schemas"\n',
    })
    const plan = new ChangePlan(findProject(root))
    const message = (() => {
      try {
        readEntityFields(plan, domainNames('paes'))
      } catch (error) {
        return (error as Error).message
      }
      return ''
    })()
    expect(message).toContain('rode prumo make:schema paes.')
    expect(message).toContain('repita a opção')
    expect(message).toContain('schemas sem repositório: pao')
    expect(message).toContain('repita a opção; schemas sem repositório: pao.')
    expect(message).not.toContain('make:repository')
    expect(message).not.toContain('usado')
  })

  it('o uso é pelo nome exato: PedidoItemSchema não esconde o schema item', () => {
    const root = makeProject({
      'src/schemas/entities/item.ts': 'export const itemSchema = 1\n',
      'src/schemas/entities/pedido-item.ts': 'export const pedidoItemSchema = 1\n',
      'src/repositories/pedido-itens/repository.contract.ts': 'import type { PedidoItemSchema } from "@/schemas"\n',
    })
    const plan = new ChangePlan(findProject(root))
    expect(() => readEntityFields(plan, domainNames('vendas'))).toThrow(
      /schemas sem repositório: item\.$/,
    )
  })

  it('com --entity explícito (diferente da derivada), não sugere outra entidade', () => {
    const root = makeProject({ 'src/schemas/entities/pao.ts': 'export const paoSchema = 1\n' })
    const plan = new ChangePlan(findProject(root))
    expect(() => readEntityFields(plan, domainNames('paes', 'paozinho'))).toThrow(/--entity paozinho\.$/)
  })
})

describe('readEntityShape', () => {
  const SCHEMA = (pick: string, sortKey: string) =>
    `import { z } from 'zod'

export const livroSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  ano: z.number(),
  createdAt: z.string(),
})

export const livroInputSchema = livroSchema.pick(${pick})

export type LivroSortKey =${sortKey}
`
  const names = domainNames('livros')
  const read = (source: string) => {
    const plan = new ChangePlan(findProject(makeProject({ 'src/schemas/entities/livro.ts': source })))
    return readEntityShape(plan, names, readEntityFields(plan, names))
  }

  it('lê o pick e a SortKey, numa linha ou em várias, com barra inicial e vírgula final', () => {
    expect(read(SCHEMA("{ titulo: true, ano: true }", " 'titulo' | 'createdAt'"))).toEqual({
      input: ['titulo', 'ano'],
      sort: ['titulo', 'createdAt'],
    })
    expect(read(SCHEMA("{\n  titulo: true,\n}", "\n  | 'ano'\n  | 'createdAt'"))).toEqual({
      input: ['titulo'],
      sort: ['ano', 'createdAt'],
    })
  })

  it('recusa booleano na SortKey e explica o .pick no lugar do .omit', () => {
    const withBoolean = SCHEMA('{ titulo: true }', " 'ativo'").replace('  ano: z.number(),', '  ano: z.number(),\n  ativo: z.boolean(),')
    expect(() => read(withBoolean)).toThrow(/livro\.ts:13: o LivroSortKey tem 'ativo', que é booleano/)
    expect(() =>
      read(SCHEMA('{ titulo: true }', " 'titulo'").replace('livroSchema.pick({ titulo: true })', "livroSchema.omit({ id: true, createdAt: true })")),
    ).toThrow(/só o \.pick\(\{ \.\.\. \}\) é aceito \(o \.omit/)
  })

  it('recusa, com o arquivo e a linha, o que não dá para ler', () => {
    expect(() => read(SCHEMA('{ semNome: true }', " 'titulo'"))).toThrow(
      /livro\.ts:10: o pick do livroInputSchema tem 'semNome'/,
    )
    expect(() => read(SCHEMA('{ id: true }', " 'titulo'"))).toThrow(/livro\.ts:10: o pick .* tem 'id'/)
    expect(() => read(SCHEMA('{ titulo: false }', " 'titulo'"))).toThrow(/livro\.ts:10: não reconheço 'titulo: false'/)
    expect(() => read(SCHEMA('{}', " 'titulo'"))).toThrow(/está vazio/)
    expect(() => read(SCHEMA('{ titulo: true }', " 'nada'"))).toThrow(/livro\.ts:12: o LivroSortKey tem 'nada'/)
    expect(() => read(SCHEMA('{ titulo: true }', " keyof Foo"))).toThrow(/não reconheço 'keyof Foo'/)
    expect(() =>
      read(SCHEMA('{ titulo: true }', " 'titulo'").replace('livroSchema.pick(', 'outro.pick(')),
    ).toThrow(/não achei 'export const livroInputSchema = livroSchema\.pick/)
    expect(() => read(SCHEMA('{ titulo: true }', " 'titulo'").replace('export type LivroSortKey', 'type X'))).toThrow(
      /não achei 'export type LivroSortKey/,
    )
  })
})
