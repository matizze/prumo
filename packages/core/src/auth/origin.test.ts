import { describe, expect, it } from 'vitest'
import { buildLoginRedirect, readOrigin, safeRedirectPath } from './index.ts'

describe('safeRedirectPath', () => {
  it('aceita caminho relativo do app, com query e hash', () => {
    expect(safeRedirectPath('/clientes')).toBe('/clientes')
    expect(safeRedirectPath('/clientes?page=2&q=ana')).toBe('/clientes?page=2&q=ana')
    expect(safeRedirectPath('/clientes/42#topo')).toBe('/clientes/42#topo')
    expect(safeRedirectPath('/')).toBe('/')
  })

  it.each([
    'https://outro.site',
    'http://outro.site/x',
    '//outro.site',
    '//outro.site/x',
    '///outro.site',
    '/\\outro.site',
    '\\\\outro.site',
    '\\/outro.site',
    'javascript:alert(1)',
    'data:text/html,x',
    'clientes',
    '',
    '/\t/outro.site',
    '/\n/outro.site',
    '/clientes\r\nX: 1',
    ' /clientes',
  ])('recusa %j e devolve o fallback', (value) => {
    expect(safeRedirectPath(value, '/painel')).toBe('/painel')
  })

  it('sem valor, devolve o fallback (padrão /)', () => {
    expect(safeRedirectPath(null)).toBe('/')
    expect(safeRedirectPath(undefined, '/painel')).toBe('/painel')
  })
})

describe('buildLoginRedirect', () => {
  it('anexa a origem codificada em next', () => {
    expect(buildLoginRedirect('/login', '/clientes?page=2')).toBe(
      '/login?next=%2Fclientes%3Fpage%3D2',
    )
  })

  it('respeita uma query que o redirectTo já tem e outro nome de parâmetro', () => {
    expect(buildLoginRedirect('/login?motivo=expirou', '/a', 'voltar')).toBe(
      '/login?motivo=expirou&voltar=%2Fa',
    )
  })

  it('descarta a origem insegura', () => {
    expect(buildLoginRedirect('/login', '//outro.site')).toBe('/login')
  })
})

describe('readOrigin', () => {
  it('lê o caminho com a query da origem, com ou sem ?', () => {
    expect(readOrigin('next=%2Fclientes%3Fpage%3D2')).toBe('/clientes?page=2')
    expect(readOrigin('?next=%2Fclientes')).toBe('/clientes')
  })

  it('devolve o fallback sem parâmetro ou com valor inseguro', () => {
    expect(readOrigin('', '/painel')).toBe('/painel')
    expect(readOrigin('next=https%3A%2F%2Foutro.site', '/painel')).toBe('/painel')
    expect(readOrigin('next=%2F%2Foutro.site', '/painel')).toBe('/painel')
    expect(readOrigin('next=%2F%5Coutro.site', '/painel')).toBe('/painel')
  })

  it('aceita outro nome de parâmetro', () => {
    expect(readOrigin('voltar=%2Fa', '/', 'voltar')).toBe('/a')
    expect(readOrigin('next=%2Fa', '/', 'voltar')).toBe('/')
  })
})
