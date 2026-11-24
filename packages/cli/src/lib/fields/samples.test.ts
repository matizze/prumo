import { describe, expect, it } from 'vitest'
import { parseFields } from './parse.ts'
import { editValue, literal, sampleValue } from './samples.ts'
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
})
