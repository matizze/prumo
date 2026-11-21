import { createElement, useCallback, useMemo, type ReactElement, type ReactNode } from 'react'
import { createInstance, type i18n as I18nInstance } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import ICU from 'i18next-icu'
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next'
import { createFormat, type Format } from './format.ts'
import { resolveLocale as matchLocale } from './resolve-locale.ts'
import type {
  LanguageOf,
  MessageTree,
  NamespaceOf,
  TranslationValues,
  TranslatorOf,
} from './types.ts'

/** Configuração do i18n de um produto. */
export interface I18nConfig<M extends Record<string, MessageTree>, D extends keyof M & string> {
  /** Mensagens por idioma, importadas estaticamente (a inicialização é síncrona). */
  messages: M
  /** Idioma padrão; as mensagens dele são a fonte dos tipos das chaves. */
  defaultLocale: D
  /** Chave do localStorage com o idioma escolhido (padrão 'locale'). */
  storageKey?: string
  /** Idiomas escritos da direita para a esquerda (padrão nenhum). */
  rtlLocales?: readonly (keyof M & string)[]
  /** Moeda de `format.currency()` quando o código não é informado (padrão 'BRL'). */
  defaultCurrency?: string
  /** Nome de cada idioma no seletor; a ordem das chaves é a ordem do seletor. */
  languages: { [L in keyof M & string]: { name: string; shortName: string } }
}

export interface I18nProviderProps {
  children: ReactNode
  /** Instância própria (testes de detecção); o padrão é a do kit. */
  i18n?: I18nInstance
}

/** Tudo que `defineI18n` devolve, ligado a uma instância e tipado pelas mensagens `M`. */
export interface I18nKit<M, L extends string> {
  /** Instância padrão, criada quando `defineI18n` roda. */
  i18n: I18nInstance
  /** Instância nova, para testes que exercitam a detecção do zero. */
  createI18n: () => I18nInstance
  I18nProvider: (props: I18nProviderProps) => ReactElement
  /**
   * Tradutor de um namespace (`useTranslations('auth')` e depois `t('signIn.title')`). Sem
   * namespace, as chaves são completas (`t('auth.signIn.title')`). Re-renderiza ao trocar o idioma.
   */
  useTranslations: <N extends NamespaceOf<M> | undefined = undefined>(
    namespace?: N,
  ) => TranslatorOf<M, N>
  /** Tradutor fora de componentes (query client, utilitários, builders de gráfico). */
  getTranslations: <N extends NamespaceOf<M> | undefined = undefined>(
    namespace?: N,
  ) => TranslatorOf<M, N>
  /** Idioma ativo, sempre um idioma suportado. */
  useLocale: () => L
  /** Idioma ativo fora de componentes. */
  getLocale: () => L
  /** Troca o idioma; o i18next grava a escolha no localStorage e o `<html lang>` acompanha. */
  useChangeLocale: () => (locale: L) => ReturnType<I18nInstance['changeLanguage']>
  /** Formatadores no idioma ativo; re-renderiza quando o idioma muda. */
  useFormat: () => Format<L>
  /** Formatadores no idioma ativo, fora de componentes. */
  getFormat: () => Format<L>
  /**
   * Mensagens de validação do zod são chaves (ex.: `'validation.required'`). Este hook devolve
   * uma função que troca a chave pela tradução no idioma ativo, no formato que o `FieldError`
   * aceita. Texto que não é chave passa sem mudança.
   */
  useFieldError: () => (error?: { message?: string }) => { message: string } | undefined
  routing: { readonly locales: readonly L[]; readonly defaultLocale: L }
  isLocale: (value: unknown) => value is L
  isRtl: (locale: L) => boolean
  /** "pt", "pt-PT" e "pt-br" viram "pt-BR"; sem equivalente, o código volta sem mudança. */
  resolveLocale: (code: string) => string
  /** Metadados dos idiomas para o seletor, na ordem de `config.languages`. */
  languages: readonly LanguageOf<L>[]
  getLanguage: (locale: L) => LanguageOf<L>
  LOCALE_STORAGE_KEY: string
}

/**
 * Liga o i18n a um produto: recebe as mensagens e a configuração e devolve a instância, o
 * provedor e os hooks, já tipados. Os tipos vêm da inferência, sem aumento de módulo (um
 * aumento que falha deixaria as chaves como `string` sem aviso).
 */
export function defineI18n<M extends Record<string, MessageTree>, D extends keyof M & string>(
  config: I18nConfig<M, D>,
): I18nKit<M[D], keyof M & string> {
  type Locale = keyof M & string
  type Messages = M[D]

  const {
    messages,
    defaultLocale,
    storageKey = 'locale',
    rtlLocales = [],
    defaultCurrency,
  } = config
  const locales = Object.keys(messages) as Locale[]
  const resources = Object.fromEntries(
    Object.entries(messages).map(([locale, tree]) => [locale, { translation: tree }]),
  )

  const routing = { locales, defaultLocale } as const
  const isLocale = (value: unknown): value is Locale => locales.includes(value as Locale)
  const isRtl = (locale: Locale) => rtlLocales.includes(locale)
  const resolveLocale = (code: string) => matchLocale(code, locales)

  const languages = (Object.keys(config.languages) as Locale[]).map((id): LanguageOf<Locale> => ({
    id,
    name: config.languages[id].name,
    shortName: config.languages[id].shortName,
    dir: isRtl(id) ? 'rtl' : 'ltr',
  }))
  const defaultLanguage = languages.find((l) => l.id === defaultLocale) as LanguageOf<Locale>
  const getLanguage = (locale: Locale) => languages.find((l) => l.id === locale) ?? defaultLanguage

  /** `<html lang>` e `<html dir>` acompanham o idioma ativo. */
  function syncDocument(lng: string) {
    if (typeof document === 'undefined') return
    const locale = isLocale(lng) ? lng : defaultLocale
    document.documentElement.lang = locale
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
  }

  function createI18n(): I18nInstance {
    const instance = createInstance()
    instance.on('languageChanged', syncDocument)

    void instance
      .use(ICU)
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        resources,
        initAsync: false, // recursos em memória: `t` já funciona logo após o init
        supportedLngs: [...locales],
        fallbackLng: defaultLocale,
        load: 'currentOnly', // "pt-BR" não procura "pt"
        ns: ['translation'],
        defaultNS: 'translation',
        keySeparator: '.',
        nsSeparator: false, // chaves e valores podem ter ":"
        returnNull: false,
        returnObjects: false,
        interpolation: { escapeValue: false }, // o React já escapa
        detection: {
          order: ['localStorage', 'navigator'],
          lookupLocalStorage: storageKey,
          caches: ['localStorage'],
          convertDetectedLanguage: resolveLocale,
        },
        react: { useSuspense: false },
      })

    return instance
  }

  const i18n = createI18n()

  function I18nProvider({ children, i18n: instance = i18n }: I18nProviderProps) {
    return createElement(I18nextProvider, { i18n: instance }, children)
  }

  function useTranslations<N extends NamespaceOf<Messages> | undefined = undefined>(
    namespace?: N,
  ): TranslatorOf<Messages, N> {
    const { t } = useTranslation(undefined, { keyPrefix: namespace })
    return useMemo(
      () =>
        ((key: string, values?: TranslationValues) => t(key, values)) as TranslatorOf<Messages, N>,
      [t], // `t` troca de identidade quando o idioma muda
    )
  }

  function getTranslations<N extends NamespaceOf<Messages> | undefined = undefined>(
    namespace?: N,
  ): TranslatorOf<Messages, N> {
    const t = i18n.getFixedT(null, null, namespace)
    return ((key: string, values?: TranslationValues) => t(key, values)) as TranslatorOf<
      Messages,
      N
    >
  }

  const toLocale = (lng: string | undefined): Locale => (isLocale(lng) ? lng : defaultLocale)

  function useLocale(): Locale {
    const { i18n: instance } = useTranslation()
    return toLocale(instance.resolvedLanguage)
  }

  function getLocale(): Locale {
    return toLocale(i18n.resolvedLanguage)
  }

  function useChangeLocale() {
    const { i18n: instance } = useTranslation()
    return useCallback((locale: Locale) => instance.changeLanguage(locale), [instance])
  }

  function useFormat(): Format<Locale> {
    const locale = useLocale()
    return useMemo(() => createFormat(locale, { defaultCurrency }), [locale])
  }

  function getFormat(): Format<Locale> {
    return createFormat(getLocale(), { defaultCurrency })
  }

  function useFieldError() {
    const { t, i18n: instance } = useTranslation()
    return useCallback(
      (error?: { message?: string }) => {
        if (!error?.message) return undefined
        const { message } = error
        return { message: instance.exists(message) ? t(message) : message }
      },
      [t, instance],
    )
  }

  return {
    i18n,
    createI18n,
    I18nProvider,
    useTranslations,
    getTranslations,
    useLocale,
    getLocale,
    useChangeLocale,
    useFormat,
    getFormat,
    useFieldError,
    routing,
    isLocale,
    isRtl,
    resolveLocale,
    languages,
    getLanguage,
    LOCALE_STORAGE_KEY: storageKey,
  }
}
