import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, daysBetween, parseLocalDate } from './index.ts'

// O core não depende de @types/node: o teste acessa o `process` do Node pelo globalThis.
const { env } = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process
const originalTz = env.TZ

afterEach(() => {
  if (originalTz === undefined) delete env.TZ
  else env.TZ = originalTz
  vi.resetModules()
})

describe('addDays', () => {
  it('soma dias em UTC e devolve AAAA-MM-DD', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01')
    expect(addDays('2026-11-20T15:30:00Z', -20)).toBe('2026-10-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('daysBetween', () => {
  it('conta os dias de uma data até outra, com sinal', () => {
    expect(daysBetween('2026-11-01', '2026-11-22')).toBe(21)
    expect(daysBetween('2026-11-22', '2026-11-01')).toBe(-21)
    expect(daysBetween('2026-11-22', '2026-11-22')).toBe(0)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('não é afetado pelo horário de verão', () => {
    env.TZ = 'America/New_York'
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1)
  })

  it('só a data conta quando há hora', () => {
    expect(daysBetween('2026-11-01T23:59:00Z', '2026-11-02T00:01:00Z')).toBe(1)
  })
})

describe('parseLocalDate', () => {
  it.each(['America/Sao_Paulo', 'Asia/Tokyo', 'Pacific/Auckland', 'UTC'])(
    'AAAA-MM-DD é o dia escrito em %s',
    (tz) => {
      env.TZ = tz
      const date = parseLocalDate('2026-11-22')
      expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 22])
      expect([date.getHours(), date.getMinutes()]).toEqual([0, 0])
    },
  )

  it('não mexe em Date, número nem ISO com hora', () => {
    const date = new Date('2026-11-22T12:00:00Z')
    expect(parseLocalDate(date)).toBe(date)
    expect(parseLocalDate(date.getTime()).getTime()).toBe(date.getTime())
    expect(parseLocalDate('2026-11-22T12:00:00Z').getTime()).toBe(date.getTime())
    expect(parseLocalDate('2026-11-22T00:00:00Z').toISOString()).toBe('2026-11-22T00:00:00.000Z')
  })

  it('data que não existe vira Invalid Date', () => {
    expect(Number.isNaN(parseLocalDate('2026-02-31').getTime())).toBe(true)
    expect(Number.isNaN(parseLocalDate('2026-13-01').getTime())).toBe(true)
  })
})

describe('format.date com data sem hora (fuso fixo)', () => {
  // O fuso é lido na criação do formatador (que o `format.ts` guarda): cada caso importa o módulo de novo.
  async function formatIn(tz: string, value: string | Date) {
    env.TZ = tz
    vi.resetModules()
    const { createFormat } = await import('../i18n/format.ts')
    return createFormat('pt-BR').date(value)
  }

  it('America/Sao_Paulo mostra o dia escrito, não o anterior', async () => {
    expect(await formatIn('America/Sao_Paulo', '2026-11-22')).toBe('22 de nov. de 2026')
    expect(await formatIn('America/Sao_Paulo', '2026-01-01')).toBe('1 de jan. de 2026')
  })

  it('um fuso a leste de UTC também mostra o dia escrito', async () => {
    expect(await formatIn('Asia/Tokyo', '2026-11-22')).toBe('22 de nov. de 2026')
    expect(await formatIn('Pacific/Auckland', '2026-11-22')).toBe('22 de nov. de 2026')
  })

  it('ISO com hora e Date seguem o instante, como antes', async () => {
    expect(await formatIn('America/Sao_Paulo', '2026-11-22T01:00:00Z')).toBe('21 de nov. de 2026')
    expect(await formatIn('Asia/Tokyo', new Date('2026-11-22T20:00:00Z'))).toBe(
      '23 de nov. de 2026',
    )
  })
})
