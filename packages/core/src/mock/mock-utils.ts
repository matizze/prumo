import { invoiceTotals, type Page, type Sort } from '@/schemas'

/** Espera `ms` (latência simulada dos mocks). */
export function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Minúsculas e sem acentos, para busca tolerante. */
export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Verdadeiro quando `search` está vazio ou aparece em algum dos campos. */
export function matchesSearch(fields: readonly string[], search?: string) {
  const query = normalize(search ?? '')
  if (!query) return true
  return fields.some((field) => normalize(field).includes(query))
}

/** Ordena uma cópia; sem `sort` mantém a ordem original. Texto compara por pt-BR. */
export function sortBy<T, K extends string>(
  items: readonly T[],
  sort: Sort<K> | undefined,
  accessors: Record<K, (item: T) => string | number>,
): T[] {
  const copy = [...items]
  if (!sort) return copy
  const get = accessors[sort.key]
  const sign = sort.direction === 'asc' ? 1 : -1
  return copy.sort((a, b) => {
    const left = get(a)
    const right = get(b)
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), 'pt-BR', { numeric: true })
    return result * sign
  })
}

/** Fatia a lista. `page` começa em 1; sem `page_size` devolve tudo. `total` é o de antes da fatia. */
export function paginate<T>(items: readonly T[], page = 1, pageSize?: number): Page<T> {
  if (!pageSize) return { items: [...items], total: items.length }
  const start = (Math.max(1, page) - 1) * pageSize
  return { items: items.slice(start, start + pageSize), total: items.length }
}

/** Soma de uma lista de inteiros. */
export function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0)
}

/** Soma `days` dias a uma data ISO (AAAA-MM-DD) e devolve AAAA-MM-DD, em UTC. */
export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Preço unitário (centavos) de um item único cujo total com imposto (`taxRate`, razão) fica mais
 * perto de `totalReais`; usado para as fixtures baterem com os totais da lista do Pro.
 */
export function unitPriceFor(totalReais: number, taxRate: number) {
  const target = totalReais * 100
  const guess = Math.round(target / (1 + taxRate))
  for (let delta = 0; delta <= 3; delta += 1) {
    for (const candidate of [guess + delta, guess - delta]) {
      if (
        invoiceTotals([{ quantity: 1, unit_price_cents: candidate, discount: 0 }], taxRate)
          .total_cents === target
      ) {
        return candidate
      }
    }
  }
  return guess
}
