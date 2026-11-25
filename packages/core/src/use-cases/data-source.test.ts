import { describe, expect, it } from 'vitest'
import { resolveDataSource } from './data-source.ts'

const SOURCES = ['memory', 'indexeddb'] as const

describe('resolveDataSource', () => {
  it.each([undefined, ''])('usa o fallback quando o valor é %j', (value) => {
    expect(resolveDataSource(value, SOURCES, 'memory')).toBe('memory')
  })

  it.each(SOURCES)('aceita a fonte %s', (source) => {
    expect(resolveDataSource(source, SOURCES, 'memory')).toBe(source)
  })

  it('lança em vez de cair em outra fonte quando o valor é inválido', () => {
    expect(() => resolveDataSource('foo', SOURCES, 'memory')).toThrow(
      'Invalid dataSource "foo". Expected one of: memory, indexeddb.',
    )
  })

  it('usa o nome da configuração na mensagem de erro', () => {
    expect(() => resolveDataSource('foo', SOURCES, 'memory', 'VITE_DATA_SOURCE')).toThrow(
      'Invalid VITE_DATA_SOURCE "foo". Expected one of: memory, indexeddb.',
    )
  })
})
