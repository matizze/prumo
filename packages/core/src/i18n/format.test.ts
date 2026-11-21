import { describe, expect, it } from 'vitest'
import { createFormat } from './format'

// Intl usa espaço não separável (U+00A0) entre a moeda e o número
const nbsp = (text: string) => text.replaceAll(' ', ' ')

describe('createFormat', () => {
  it('número, moeda e percentual seguem o idioma', () => {
    const pt = createFormat('pt-BR')
    const en = createFormat('en')

    expect(pt.number(1234.5)).toBe('1.234,5')
    expect(en.number(1234.5)).toBe('1,234.5')
    expect(pt.currency(1280)).toBe(nbsp('R$ 1.280,00'))
    expect(en.currency(1280, 'USD')).toBe('$1,280.00')
    expect(pt.percent(0.253)).toBe('25,3%')
    expect(en.percent(0.253)).toBe('25.3%')
  })

  it('data segue o idioma', () => {
    const date = new Date(2026, 10, 17, 14, 30)

    expect(createFormat('pt-BR').date(date, { dateStyle: 'long' })).toBe('17 de novembro de 2026')
    expect(createFormat('en').date(date, { dateStyle: 'long' })).toBe('November 17, 2026')
    expect(createFormat('pt-BR').time(date)).toBe('14:30')
  })

  it('data relativa escolhe a unidade pela diferença', () => {
    const now = new Date(2026, 10, 17, 12, 0, 0)
    const pt = createFormat('pt-BR')
    const en = createFormat('en')

    expect(pt.relative(new Date(2026, 10, 17, 9, 0, 0), now)).toBe('há 3 horas')
    expect(pt.relative(new Date(2026, 10, 18, 12, 0, 0), now)).toBe('amanhã')
    expect(en.relative(new Date(2026, 10, 19, 12, 0, 0), now)).toBe('in 2 days')
    expect(en.relative(new Date(2026, 10, 17, 11, 59, 30), now)).toBe('30 seconds ago')
  })
})
