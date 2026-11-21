import { describe, expect, it } from 'vitest'
import { icuPlaceholders } from './icu.ts'

describe('icuPlaceholders', () => {
  it('lê interpolação, plural e select com argumentos aninhados', () => {
    expect(icuPlaceholders('Olá, {name}!')).toEqual(['name'])
    expect(icuPlaceholders('{n, plural, one {# item de {owner}} other {# itens}}')).toEqual([
      'n',
      'owner',
    ])
    expect(icuPlaceholders('{n}/{total, plural, one {a} other {b}}')).toEqual(['n', 'total'])
    expect(icuPlaceholders('{state, select, on {ligado} other {desligado}}')).toEqual([
      'state:select[on|other]',
    ])
    expect(icuPlaceholders('Sem argumentos')).toEqual([])
  })

  it('conta {n} e {n, plural, ...} como o mesmo argumento, e guarda o formato de data', () => {
    expect(icuPlaceholders('{n}')).toEqual(icuPlaceholders('{n, plural, one {#} other {#}}'))
    expect(icuPlaceholders('Em {when, date}')).toEqual(['when:date'])
    expect(icuPlaceholders('{n, selectordinal, one {#o} other {#o}}')).toEqual(['n'])
  })

  it('ignora a ordem dos argumentos e a repetição', () => {
    expect(icuPlaceholders('{b} e {a} e {b}')).toEqual(['a', 'b'])
  })

  it('lança um erro quando uma chave não fecha', () => {
    expect(() => icuPlaceholders('Olá, {name')).toThrow('Chave não fechada')
  })
})
