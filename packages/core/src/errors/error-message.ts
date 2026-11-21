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
 *
 * A instância precisa estar inicializada, com as mensagens carregadas (o `defineI18n` inicializa
 * de forma síncrona, então a instância dele já serve): a criação confere que a chave de reserva
 * existe e lança um `Error` se não existir. Sem a conferência, o i18next devolveria a própria
 * chave e a tela mostraria `errors.generic`.
 */
export function createErrorMessage(
  i18n: I18nInstance,
  { prefix = 'errors.', fallbackKey = 'errors.generic' }: ErrorMessageOptions = {},
): (error: unknown) => string {
  if (!i18n.exists(fallbackKey)) {
    throw new Error(
      `A chave de reserva '${fallbackKey}' não existe nas mensagens da instância i18next. ` +
        'Crie o texto no produto (ou informe outra chave em fallbackKey) e use uma instância ' +
        'já inicializada: sem esse texto, a tela mostraria a própria chave.',
    )
  }
  return function getErrorMessage(error: unknown): string {
    const key = error instanceof UIError ? `${prefix}${error.code}` : null
    if (key && i18n.exists(key)) return i18n.t(key)
    return i18n.t(fallbackKey)
  }
}
