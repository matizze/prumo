import type { i18n as I18nInstance } from 'i18next'
import { UIError } from './ui-error.ts'

/** Opções de `createErrorMessage`; os padrões são as convenções do app de referência. */
export interface ErrorMessageOptions {
  /** Prefixo das chaves de erro; a chave de um `UIError` é `<prefix><code>` (padrão `errors.`). */
  prefix?: string
  /** Chave do texto genérico, para o que não tem tradução (padrão `errors.generic`). */
  fallbackKey?: string
}

/**
 * Cria o `getErrorMessage` de um produto: o texto do erro que pode ir para a interface, no idioma
 * ativo da instância. O repositório não conhece idioma: só o `code` do `UIError` importa, e a UI
 * procura a chave `<prefix><CODE>` (ex.: INVALID_CREDENTIALS -> errors.INVALID_CREDENTIALS).
 * Código sem tradução, ou qualquer erro que não seja `UIError` (bug, rede, falha do storage…),
 * vira a chave de reserva, para não vazar texto técnico nem mensagem em outro idioma.
 */
export function createErrorMessage(
  i18n: I18nInstance,
  { prefix = 'errors.', fallbackKey = 'errors.generic' }: ErrorMessageOptions = {},
): (error: unknown) => string {
  return function getErrorMessage(error: unknown): string {
    const key = error instanceof UIError ? `${prefix}${error.code}` : null
    if (key && i18n.exists(key)) return i18n.t(key)
    return i18n.t(fallbackKey)
  }
}
