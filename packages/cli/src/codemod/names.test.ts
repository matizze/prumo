import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { assertValidName, deriveNames, domainNames, isValidName, singularOf } from './names.ts'

describe('isValidName', () => {
  it.each(['produtos', 'pedidos-recentes', 'error-404', 'a', 'tela2', 'ai-settings-general'])(
    'aceita %s',
    (name) => expect(isValidName(name)).toBe(true),
  )

  it.each([
    '',
    'Produtos',
    'pedidosRecentes',
    'pedidos_recentes',
    '2fa',
    '-produtos',
    'produtos-',
    'pedidos--recentes',
    'pedidos recentes',
    'pedidos/recentes',
    'pedidos.recentes',
    'ações',
  ])('recusa %j', (name) => expect(isValidName(name)).toBe(false))
})

describe('assertValidName', () => {
  it('lança um UsageError (saída 2) que diz o que foi recusado e a regra', () => {
    expect(() => assertValidName('Pedidos', 'o nome da tela')).toThrow(UsageError)
    expect(() => assertValidName('Pedidos', 'o nome da tela')).toThrow(
      /o nome da tela 'Pedidos' é inválido: use kebab-case/,
    )
    expect(() => assertValidName('ok')).not.toThrow()
  })
})

describe('deriveNames', () => {
  it('deriva Pascal e camel do kebab', () => {
    expect(deriveNames('pedidos-recentes')).toEqual({
      kebab: 'pedidos-recentes',
      pascal: 'PedidosRecentes',
      camel: 'pedidosRecentes',
    })
    expect(deriveNames('produtos')).toEqual({
      kebab: 'produtos',
      pascal: 'Produtos',
      camel: 'produtos',
    })
  })

  it('mantém os números como no app (error-404 vira Error404 e error404)', () => {
    expect(deriveNames('error-404')).toMatchObject({ pascal: 'Error404', camel: 'error404' })
    expect(deriveNames('ai-settings-general')).toMatchObject({ camel: 'aiSettingsGeneral' })
  })

  it('recusa nome inválido', () => {
    expect(() => deriveNames('Produtos')).toThrow(UsageError)
  })
})

describe('singularOf', () => {
  it('tira o s final, em inglês e em português', () => {
    expect(singularOf('suppliers')).toBe('supplier')
    expect(singularOf('customers')).toBe('customer')
    expect(singularOf('pedidos')).toBe('pedido')
    expect(singularOf('order-items')).toBe('order-item')
  })

  it('não adivinha o que não termina em s e pede o singular explícito', () => {
    expect(() => singularOf('catalog')).toThrow(/--entity/)
    expect(() => singularOf('s')).toThrow(UsageError)
  })
})

describe('domainNames', () => {
  it('deriva o singular do plural', () => {
    const names = domainNames('suppliers')
    expect(names.plural).toEqual({ kebab: 'suppliers', pascal: 'Suppliers', camel: 'suppliers' })
    expect(names.singular).toEqual({ kebab: 'supplier', pascal: 'Supplier', camel: 'supplier' })
  })

  it('aceita um singular explícito para o que a regra erra', () => {
    expect(domainNames('categories', 'category').singular.pascal).toBe('Category')
    expect(domainNames('catalog', 'product').singular.camel).toBe('product')
  })

  it('recusa singular inválido ou igual ao plural', () => {
    expect(() => domainNames('suppliers', 'Supplier')).toThrow(/a entidade 'Supplier' é inválido/)
    expect(() => domainNames('status', 'status')).toThrow(/igual ao nome do domínio/)
    expect(() => domainNames('Suppliers')).toThrow(/o nome do domínio/)
  })
})
