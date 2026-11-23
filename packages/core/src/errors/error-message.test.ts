import { createInstance } from 'i18next'
import ICU from 'i18next-icu'
import { describe, expect, it } from 'vitest'
import { createErrorMessage, UIError } from './index.ts'

/** Instância i18next só com mensagens de fixture: o teste não depende dos textos de um produto. */
function createFixture() {
  const i18n = createInstance().use(ICU)
  void i18n.init({
    lng: 'pt-BR',
    initAsync: false,
    keySeparator: '.',
    nsSeparator: false,
    resources: {
      'pt-BR': {
        translation: {
          errors: {
            generic: 'Algo deu errado.',
            NOT_FOUND: 'Não encontrado.',
            LOAN_LIMIT:
              'Você já tem {limite, plural, one {# livro emprestado} other {# livros emprestados}}.',
          },
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

  it('o UIError leva params para o texto ICU', () => {
    const getErrorMessage = createErrorMessage(createFixture())

    expect(getErrorMessage(new UIError('LOAN_LIMIT', 'x', { limite: 3 }))).toBe(
      'Você já tem 3 livros emprestados.',
    )
    expect(getErrorMessage(new UIError('LOAN_LIMIT', 'x', { limite: 1 }))).toBe(
      'Você já tem 1 livro emprestado.',
    )
  })

  it('traduz um código solto, com params, sem montar um UIError', () => {
    const getErrorMessage = createErrorMessage(createFixture())

    expect(getErrorMessage('LOAN_LIMIT', { limite: 3 })).toBe('Você já tem 3 livros emprestados.')
    expect(getErrorMessage('NOT_FOUND')).toBe('Não encontrado.')
    expect(getErrorMessage('SEM_TRADUCAO', { limite: 3 })).toBe('Algo deu errado.')
  })

  it('params informados valem mais que os do UIError', () => {
    const getErrorMessage = createErrorMessage(createFixture())
    const error = new UIError('LOAN_LIMIT', 'x', { limite: 3 })

    expect(getErrorMessage(error, { limite: 5 })).toBe('Você já tem 5 livros emprestados.')
  })
})
