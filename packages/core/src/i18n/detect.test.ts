// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureKit } from './fixtures.ts'

const { LOCALE_STORAGE_KEY, createI18n, resolveLocale } = fixtureKit

function stubNavigator(...languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages)
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(languages[0] ?? '')
}

// A instância do kit já gravou o idioma detectado no import; cada teste parte do zero
beforeEach(() => localStorage.clear())

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('lang')
  document.documentElement.removeAttribute('dir')
})

describe('detecção de idioma', () => {
  it.each([
    [['pt-BR'], 'pt-BR'],
    [['pt'], 'pt-BR'],
    [['pt-PT'], 'pt-BR'],
    [['en-US'], 'en'],
    [['en'], 'en'],
    // O primeiro idioma suportado da lista de preferências vence
    [['fr-FR', 'en-GB'], 'en'],
    // Nenhum suportado: cai no padrão
    [['fr-FR', 'ja'], 'pt-BR'],
    [[], 'pt-BR'],
  ])('navigator %j resolve para %s', (languages, expected) => {
    stubNavigator(...languages)

    expect(createI18n().resolvedLanguage).toBe(expected)
  })

  it('a escolha gravada no localStorage vence o navigator', () => {
    stubNavigator('en-US')
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR')

    expect(createI18n().resolvedLanguage).toBe('pt-BR')
  })

  it('valor gravado sem suporte é ignorado e segue para o navigator', () => {
    stubNavigator('en-US')
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es')

    expect(createI18n().resolvedLanguage).toBe('en')
  })

  it('grava o idioma detectado em localStorage', () => {
    stubNavigator('pt-PT')

    createI18n()

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('pt-BR')
  })

  it('aplica lang e dir no <html> já na inicialização', () => {
    stubNavigator('en-US')

    createI18n()

    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('traduz as mensagens do idioma detectado', () => {
    stubNavigator('en')
    expect(createI18n().t('auth.signIn.submit')).toBe('Sign in')

    stubNavigator('pt-BR')
    localStorage.clear()
    expect(createI18n().t('auth.signIn.submit')).toBe('Entrar')
  })
})

describe('resolveLocale', () => {
  it('normaliza variantes e devolve o resto sem mudança', () => {
    expect(resolveLocale('pt-br')).toBe('pt-BR')
    expect(resolveLocale('PT')).toBe('pt-BR')
    expect(resolveLocale('en-AU')).toBe('en')
    expect(resolveLocale('de')).toBe('de')
  })
})
