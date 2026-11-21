type DateInput = Date | number | string

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value))

/** Unidades de `relative`, da maior para a menor, com o tamanho em segundos. */
const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
]

const formatters = new Map<
  string,
  Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat
>()

/** Intl.* é caro de construir: reaproveita a instância por idioma e opções. */
function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(
  kind: string,
  locale: string,
  options: object | undefined,
  create: () => T,
): T {
  const key = `${kind}|${locale}|${JSON.stringify(options ?? {})}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = create()
    formatters.set(key, formatter)
  }
  return formatter as T
}

/** Opções de `createFormat`. */
export interface FormatOptions {
  /** Moeda usada por `currency()` quando o código não é informado (padrão 'BRL'). */
  defaultCurrency?: string
}

/**
 * Formatadores Intl ligados a um idioma. Em componentes, use `useFormat()` do kit criado por
 * `defineI18n`; fora deles, `getFormat()`.
 */
export function createFormat<L extends string>(
  locale: L,
  { defaultCurrency = 'BRL' }: FormatOptions = {},
) {
  const number = (value: number, options?: Intl.NumberFormatOptions) =>
    cached('n', locale, options, () => new Intl.NumberFormat(locale, options)).format(value)

  return {
    locale,
    /** 1234.5 -> "1.234,5" (pt-BR) / "1,234.5" (en). */
    number,
    /** 12_400 -> "12 mil" (pt-BR) / "12K" (en). */
    compact: (value: number, options?: Intl.NumberFormatOptions) =>
      number(value, { notation: 'compact', ...options }),
    /** 0.253 -> "25,3%" (valor em fração, não em pontos percentuais). */
    percent: (value: number, options?: Intl.NumberFormatOptions) =>
      number(value, { style: 'percent', maximumFractionDigits: 1, ...options }),
    /** Moeda padrão do produto (BRL, se nada for configurado); passe o código ISO para outra ("USD"). */
    currency: (value: number, currency = defaultCurrency, options?: Intl.NumberFormatOptions) =>
      number(value, { style: 'currency', currency, ...options }),
    /** Só a data. Padrão: dia, mês abreviado e ano ("17 de nov. de 2026"). */
    date: (value: DateInput, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
      cached('d', locale, options, () => new Intl.DateTimeFormat(locale, options)).format(
        toDate(value),
      ),
    /** Data e hora. */
    dateTime: (
      value: DateInput,
      options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
    ) =>
      cached('d', locale, options, () => new Intl.DateTimeFormat(locale, options)).format(
        toDate(value),
      ),
    /** Só a hora. */
    time: (value: DateInput, options: Intl.DateTimeFormatOptions = { timeStyle: 'short' }) =>
      cached('d', locale, options, () => new Intl.DateTimeFormat(locale, options)).format(
        toDate(value),
      ),
    /**
     * Data relativa a `now`: "há 3 horas", "amanhã", "in 2 days". Escolhe a maior unidade
     * que cabe na diferença.
     */
    relative: (value: DateInput, now: DateInput = Date.now()) => {
      const diffSeconds = Math.round((toDate(value).getTime() - toDate(now).getTime()) / 1000)
      const abs = Math.abs(diffSeconds)
      const [unit, size] = RELATIVE_UNITS.find(([, s]) => abs >= s) ?? RELATIVE_UNITS.at(-1)!
      const rtf = cached(
        'r',
        locale,
        undefined,
        () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
      )
      return rtf.format(Math.trunc(diffSeconds / size), unit)
    },
  }
}

/** Formatadores de um idioma `L`, o que `createFormat` devolve. */
export type Format<L extends string = string> = ReturnType<typeof createFormat<L>>
