import { describe, expect, it } from 'vitest'
import { UsageError } from '../../errors.ts'
import { parseFields } from './parse.ts'

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
