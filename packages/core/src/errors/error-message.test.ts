import { createInstance } from 'i18next'
import { describe, expect, it } from 'vitest'
import { createErrorMessage, UIError } from './index.ts'

/** Instância i18next só com mensagens de fixture: o teste não depende dos textos de um produto. */
function createFixture() {
  const i18n = createInstance()
  void i18n.init({
    lng: 'pt-BR',
    initAsync: false,
    keySeparator: '.',
    nsSeparator: false,
    resources: {
      'pt-BR': {
        translation: {
          errors: { generic: 'Algo deu errado.', NOT_FOUND: 'Não encontrado.' },
          falhas: { generica: 'Falha genérica.', NOT_FOUND: 'Item não encontrado.' },
        },
      },
      en: {
        translation: {
          errors: { generic: 'Something went wrong.', NOT_FOUND: 'Not found.' },
        },
      },
    },
  })
  return i18n
}

describe('createErrorMessage', () => {
  it('traduz o UIError pelo código, no idioma ativo', async () => {
    const i18n = createFixture()
    const getErrorMessage = createErrorMessage(i18n)
    const error = new UIError('NOT_FOUND', 'texto do repositório, ignorado')

    expect(getErrorMessage(error)).toBe('Não encontrado.')

    await i18n.changeLanguage('en')

    expect(getErrorMessage(error)).toBe('Not found.')
  })

  it('código sem tradução vira a mensagem genérica', () => {
    const getErrorMessage = createErrorMessage(createFixture())

    expect(getErrorMessage(new UIError('SEM_TRADUCAO', 'x'))).toBe('Algo deu errado.')
  })

  it('erro que não é UIError vira a mensagem genérica, sem vazar o texto técnico', () => {
    const getErrorMessage = createErrorMessage(createFixture())

    expect(getErrorMessage(new TypeError('Failed to fetch'))).toBe('Algo deu errado.')
    expect(getErrorMessage('texto solto')).toBe('Algo deu errado.')
    expect(getErrorMessage(undefined)).toBe('Algo deu errado.')
    // Um objeto com `code` que não é UIError também não conta.
    expect(getErrorMessage({ code: 'NOT_FOUND' })).toBe('Algo deu errado.')
  })

  it('aceita outro prefixo e outra chave de reserva', () => {
    const getErrorMessage = createErrorMessage(createFixture(), {
      prefix: 'falhas.',
      fallbackKey: 'falhas.generica',
    })

    expect(getErrorMessage(new UIError('NOT_FOUND', 'x'))).toBe('Item não encontrado.')
    expect(getErrorMessage(new UIError('SEM_TRADUCAO', 'x'))).toBe('Falha genérica.')
    expect(getErrorMessage(new Error('x'))).toBe('Falha genérica.')
  })

  it('lança na criação se a chave de reserva não existe nas mensagens', () => {
    const i18n = createInstance()
    void i18n.init({
      lng: 'pt-BR',
      initAsync: false,
      keySeparator: '.',
      nsSeparator: false,
      resources: { 'pt-BR': { translation: { errors: { NOT_FOUND: 'Não encontrado.' } } } },
    })

    expect(() => createErrorMessage(i18n)).toThrow(/'errors\.generic'/)
    expect(() =>
      createErrorMessage(createFixture(), { fallbackKey: 'falhas.inexistente' }),
    ).toThrow(/'falhas\.inexistente'/)
  })

  it('lança na criação com a instância ainda sem inicializar', () => {
    expect(() => createErrorMessage(createInstance())).toThrow(/errors\.generic/)
  })
})
