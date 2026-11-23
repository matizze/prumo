import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, matchesSearch, normalize, paginate, sortBy, sum, wait } from './index.ts'

describe('utilitários de mock', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('wait resolve depois da latência simulada', async () => {
    vi.useFakeTimers()
    let done = false
    const promise = wait(300).then(() => {
      done = true
    })

    await vi.advanceTimersByTimeAsync(299)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await promise
    expect(done).toBe(true)
  })

  it('normalize tira acentos, caixa e espaços das pontas', () => {
    expect(normalize('  Ação Rápida ')).toBe('acao rapida')
  })

  it('matchesSearch aceita busca vazia e procura sem acento em qualquer campo', () => {
    expect(matchesSearch(['Maria'], '')).toBe(true)
    expect(matchesSearch(['Maria'], undefined)).toBe(true)
    expect(matchesSearch(['João Silva', 'joao@x.com'], 'joao')).toBe(true)
    expect(matchesSearch(['João Silva'], 'pedro')).toBe(false)
  })

  describe('sortBy', () => {
    type Row = { name: string; qty: number }
    const items: Row[] = [
      { name: 'Ébano', qty: 10 },
      { name: 'abacate', qty: 2 },
      { name: 'Item 10', qty: 1 },
      { name: 'Item 9', qty: 5 },
    ]
    const accessors = { name: (i: Row) => i.name, qty: (i: Row) => i.qty }

    it('sem sort devolve uma cópia na ordem original', () => {
      const result = sortBy(items, undefined, accessors)

      expect(result).toEqual(items)
      expect(result).not.toBe(items)
    })

    it('ordena números e texto (pt-BR, com números naturais) nas duas direções', () => {
      const byQty = sortBy(items, { key: 'qty', direction: 'desc' }, accessors)
      const byName = sortBy(items, { key: 'name', direction: 'asc' }, accessors)

      expect(byQty.map((i) => i.qty)).toEqual([10, 5, 2, 1])
      expect(byName.map((i) => i.name)).toEqual(['abacate', 'Ébano', 'Item 9', 'Item 10'])
    })

    it('aceita outro idioma para comparar texto', () => {
      const words = [{ w: 'z' }, { w: 'ä' }]
      const byWord = { w: (i: { w: string }) => i.w }
      const sort = { key: 'w', direction: 'asc' } as const

      expect(sortBy(words, sort, byWord, { locale: 'sv' }).map((i) => i.w)).toEqual(['z', 'ä'])
      expect(sortBy(words, sort, byWord).map((i) => i.w)).toEqual(['ä', 'z'])
    })
  })

  it('paginate fatia a partir da página 1 e mantém o total de antes da fatia', () => {
    const items = [1, 2, 3, 4, 5]

    expect(paginate(items, 2, 2)).toEqual({ items: [3, 4], total: 5 })
    expect(paginate(items, 0, 2)).toEqual({ items: [1, 2], total: 5 })
    expect(paginate(items)).toEqual({ items, total: 5 })
  })

  it('sum soma inteiros e devolve 0 para lista vazia', () => {
    expect(sum([1, 2, 3])).toBe(6)
    expect(sum([])).toBe(0)
  })

  it('continua exportando addDays, que mora em ../date', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01')
  })
})
