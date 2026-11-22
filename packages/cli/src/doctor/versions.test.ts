import { describe, expect, it } from 'vitest'
import {
  caretRange,
  compareVersions,
  formatRange,
  formatVersion,
  parseRange,
  parseVersion,
  positionIn,
} from './versions.ts'

const v = (text: string) => {
  const version = parseVersion(text)
  if (!version) throw new Error(`versão inválida no teste: ${text}`)
  return version
}

describe('parseVersion', () => {
  it('lê versão completa, com v, e completa o que falta com zero', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseVersion('v24.1.0')).toEqual({ major: 24, minor: 1, patch: 0 })
    expect(parseVersion('24')).toEqual({ major: 24, minor: 0, patch: 0 })
    expect(parseVersion('24.3')).toEqual({ major: 24, minor: 3, patch: 0 })
  })

  it('descarta pré-lançamento e metadados', () => {
    expect(parseVersion('10.0.0+sha512.abc')).toEqual({ major: 10, minor: 0, patch: 0 })
    expect(parseVersion('0.2.0-beta.1')).toEqual({ major: 0, minor: 2, patch: 0 })
  })

  it('devolve undefined para o que não é versão', () => {
    for (const text of ['', 'lts/*', 'latest', 'node', '>=24', '1.x']) {
      expect(parseVersion(text), text).toBeUndefined()
    }
  })
})

describe('compareVersions e formatVersion', () => {
  it('ordena por major, minor e patch', () => {
    expect(compareVersions(v('1.0.0'), v('0.9.9'))).toBeGreaterThan(0)
    expect(compareVersions(v('0.1.9'), v('0.2.0'))).toBeLessThan(0)
    expect(compareVersions(v('0.1.1'), v('0.1.0'))).toBeGreaterThan(0)
    expect(compareVersions(v('2.3.4'), v('2.3.4'))).toBe(0)
  })

  it('escreve major.minor.patch', () => {
    expect(formatVersion(v('v24'))).toBe('24.0.0')
  })
})

describe('faixas', () => {
  it('lê e escreve ">=mínimo <limite"', () => {
    const range = parseRange('>=0.1.0 <0.2.0')
    expect(range).toEqual({ min: v('0.1.0'), below: v('0.2.0') })
    expect(range && formatRange(range)).toBe('>=0.1.0 <0.2.0')
  })

  it('recusa outros formatos', () => {
    for (const text of ['^0.1.0', '0.1.0', '>=0.1.0', '>=x <1.0.0', '']) {
      expect(parseRange(text), text).toBeUndefined()
    }
  })

  it('caretRange vai até a próxima minor antes da 1.0 e até a próxima major depois', () => {
    expect(formatRange(caretRange(v('0.2.3')))).toBe('>=0.2.3 <0.3.0')
    expect(formatRange(caretRange(v('1.4.0')))).toBe('>=1.4.0 <2.0.0')
  })

  it('positionIn diz se a versão está atrás, dentro ou à frente', () => {
    const range = caretRange(v('0.2.0'))
    expect(positionIn(v('0.1.9'), range)).toBe('behind')
    expect(positionIn(v('0.2.0'), range)).toBe('inside')
    expect(positionIn(v('0.2.7'), range)).toBe('inside')
    expect(positionIn(v('0.3.0'), range)).toBe('ahead')
    expect(positionIn(v('1.0.0'), range)).toBe('ahead')
  })
})
