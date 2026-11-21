// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineI18n } from './define.ts'

// Mensagens de fixture: o teste não depende das mensagens de nenhum produto
const fixtureEn = { greeting: { hello: 'Hello', bye: 'Bye' }, title: 'Title' }
const fixturePt = { greeting: { hello: 'Olá', bye: 'Tchau' }, title: 'Título' }
const fixtureAr = { greeting: { hello: 'مرحبا', bye: 'وداعا' }, title: 'عنوان' }

const kit = defineI18n({
  messages: { pt: fixturePt, en: fixtureEn, ar: fixtureAr },
  defaultLocale: 'pt',
  storageKey: 'fixture-locale',
  rtlLocales: ['ar'],
  defaultCurrency: 'USD',
  languages: {
    pt: { name: 'Português', shortName: 'PT' },
    en: { name: 'English', shortName: 'EN' },
    ar: { name: 'العربية', shortName: 'AR' },
  },
})

// O jsdom anuncia `en-US`: cada teste parte do idioma padrão
beforeEach(() => kit.i18n.changeLanguage('pt'))

afterEach(() => {
  localStorage.clear()
})

describe('defineI18n: tipos', () => {
  it('rejeita namespace e chave inexistentes em tempo de compilação', () => {
    const { result } = renderHook(() => ({
      root: kit.useTranslations(),
      greeting: kit.useTranslations('greeting'),
      // @ts-expect-error `nope` não é um namespace das mensagens
      missing: kit.useTranslations('nope'),
    }))
    const { root, greeting } = result.current

    expect(root('greeting.hello')).toBe('Olá')
    expect(greeting('bye')).toBe('Tchau')
    // @ts-expect-error `nope` não é uma chave de `greeting`
    greeting('nope')
    // @ts-expect-error `nope` não é uma chave das mensagens
    root('nope')
    // @ts-expect-error uma chave de outro namespace não vale dentro de `greeting`
    greeting('title')
    // @ts-expect-error `greeting` é um namespace, não uma folha
    root('greeting')
  })

  it('o idioma é a união das chaves das mensagens', () => {
    const locale: 'pt' | 'en' | 'ar' = kit.getLocale()
    expect(locale).toBe('pt')
    // @ts-expect-error `fr` não tem mensagens
    kit.getLanguage('fr')
  })
})

describe('defineI18n: configuração', () => {
  it('expõe idiomas, padrão e chave de armazenamento', () => {
    expect(kit.routing).toEqual({ locales: ['pt', 'en', 'ar'], defaultLocale: 'pt' })
    expect(kit.LOCALE_STORAGE_KEY).toBe('fixture-locale')
    expect(kit.languages.map((l) => [l.id, l.dir])).toEqual([
      ['pt', 'ltr'],
      ['en', 'ltr'],
      ['ar', 'rtl'],
    ])
    expect(kit.getLanguage('en')).toMatchObject({ name: 'English', shortName: 'EN' })
    expect(kit.isLocale('ar')).toBe(true)
    expect(kit.isLocale('fr')).toBe(false)
    expect(kit.isRtl('ar')).toBe(true)
    expect(kit.isRtl('pt')).toBe(false)
  })

  it('troca de idioma grava na chave configurada e atualiza lang e dir', async () => {
    const { result } = renderHook(
      () => ({ change: kit.useChangeLocale(), locale: kit.useLocale() }),
      { wrapper: kit.I18nProvider },
    )

    await act(() => result.current.change('ar'))

    expect(result.current.locale).toBe('ar')
    expect(localStorage.getItem('fixture-locale')).toBe('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(kit.getTranslations('greeting')('hello')).toBe('مرحبا')
  })

  it('a moeda padrão vem da configuração', () => {
    // Comparação exata: o BRL, que seria a moeda sem a configuração, também tem "$" no símbolo.
    // O Intl separa o símbolo do número com um espaço não separável (U+00A0).
    expect(kit.getFormat().currency(5)).toBe('US$\u00a05,00')
    expect(kit.getFormat().currency(5)).not.toContain('R$')
    expect(kit.getFormat().currency(5, 'EUR')).toBe('€\u00a05,00')
    expect(kit.getFormat().currency(5, 'BRL')).toBe('R$\u00a05,00')
  })

  it('o hook useFormat usa a moeda padrão da configuração e acompanha o idioma', () => {
    const { result } = renderHook(() => kit.useFormat().currency(5))

    expect(result.current).toBe('US$\u00a05,00')

    act(() => {
      void kit.i18n.changeLanguage('en')
    })

    expect(result.current).toBe('$5.00')
  })
})

describe('resolveLocale', () => {
  it('igualdade sem caixa vence, depois a língua-base, senão devolve o código', () => {
    expect(kit.resolveLocale('PT')).toBe('pt')
    expect(kit.resolveLocale('pt-BR')).toBe('pt')
    expect(kit.resolveLocale('en-US')).toBe('en')
    expect(kit.resolveLocale('AR')).toBe('ar')
    expect(kit.resolveLocale('fr-FR')).toBe('fr-FR')
  })
})
