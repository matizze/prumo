import { describe, expect, it } from 'vitest'
import { patternMatches } from './route-elements.ts'

describe('patternMatches', () => {
  it.each([
    ['/inbox', '/inbox'],
    ['/inbox', '/inbox/'],
    ['/', '/'],
    ['/inbox/*?', '/inbox'],
    ['/inbox/*?', '/inbox/x'],
    ['/inbox/*?', '/inbox/x/y'],
    ['/inbox/*', '/inbox/x'],
    // O wouter exige algo depois da barra, mas a checagem erra para o lado seguro
    ['/inbox/*', '/inbox'],
    ['/*?', '/qualquer/coisa'],
    ['/pedidos/:id', '/pedidos/42'],
    ['/pedidos/:id', '/pedidos/:id'],
    ['/pedidos/:id?', '/pedidos'],
    ['/pedidos/:id?', '/pedidos/42'],
    ['/files/:rest*', '/files'],
    ['/files/:rest*', '/files/a/b'],
    ['/files/:rest+', '/files/a/b'],
    ['/:slug', '/nova'],
    ['/a/:x/b', '/a/1/b'],
  ])('%s casa com %s', (pattern, address) => {
    expect(patternMatches(pattern, address)).toBe(true)
  })

  it.each([
    ['/inbox', '/inbox-details'],
    ['/inbox', '/inbox/x'],
    ['/', '/inbox'],
    ['/inbox/*?', '/inbox-details'],
    ['/inbox/*?', '/outro'],
    ['/pedidos/:id', '/pedidos'],
    ['/pedidos/:id', '/pedidos/42/itens'],
    ['/files/:rest+', '/files'],
    ['/a/:x/b', '/a/1/c'],
    ['/a.b', '/aXb'],
  ])('%s não casa com %s', (pattern, address) => {
    expect(patternMatches(pattern, address)).toBe(false)
  })
})
