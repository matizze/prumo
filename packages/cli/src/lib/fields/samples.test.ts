import { describe, expect, it } from 'vitest'
import { parseFields } from './parse.ts'
import { editValue, literal, sampleCode, sampleRecord, sampleValue } from './samples.ts'
import { DEFAULT_FIELDS } from './types.ts'

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

  it('sampleRecord: os campos do exemplo n e, com a entidade, o id e a data de um registro', () => {
    const fields = parseFields('nome:string,idade:int')
    expect(sampleRecord(fields, 2)).toEqual({ nome: 'Nome 2', idade: 20 })
    expect(sampleRecord(fields, 2, 'cliente')).toEqual({
      id: 'cliente-2',
      nome: 'Nome 2',
      idade: 20,
      createdAt: '2026-01-14T12:00:00.000Z',
    })
  })
})

describe('sampleCode', () => {
  it('valores, listas e objetos que cabem ficam numa linha', () => {
    expect(sampleCode(undefined)).toBe('undefined')
    expect(sampleCode("a'b")).toBe("'a\\'b'")
    expect(sampleCode(true)).toBe('true')
    expect(sampleCode([])).toBe('[]')
    expect(sampleCode({})).toBe('{}')
    expect(sampleCode({ token: 'Token 1', ok: true })).toBe("{ token: 'Token 1', ok: true }")
    expect(sampleCode([1, 2])).toBe('[1, 2]')
  })

  it('o que passa da largura vai uma entrada por linha, com o recuo dado', () => {
    const item = { id: 'cliente-1', nome: 'Nome 1', createdAt: '2026-01-05T12:00:00.000Z' }
    expect(sampleCode([item, item], '  ')).toBe(
      `[\n    { id: 'cliente-1', nome: 'Nome 1', createdAt: '2026-01-05T12:00:00.000Z' },\n    { id: 'cliente-1', nome: 'Nome 1', createdAt: '2026-01-05T12:00:00.000Z' },\n  ]`,
    )
    expect(sampleCode({ ...item, extra: 'um texto a mais para passar da largura' })).toBe(
      `{\n  id: 'cliente-1',\n  nome: 'Nome 1',\n  createdAt: '2026-01-05T12:00:00.000Z',\n  extra: 'um texto a mais para passar da largura',\n}`,
    )
  })
})
