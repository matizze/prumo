import { getTranslations, type MessageKey } from '@/i18n'
import i18n from '@/i18n/config'
import { UIError } from '@matizze/prumo-core/errors'

/**
 * Texto do erro que pode ir para a interface, no idioma ativo. O repositório não conhece
 * idioma: só o `code` do UIError importa, e a UI procura a chave `errors.<CODE>`
 * (ex.: INVALID_CREDENTIALS -> errors.INVALID_CREDENTIALS). Código sem tradução, ou qualquer
 * erro que não seja UIError (bug, rede, falha do storage…), vira `errors.generic`, para não
 * vazar texto técnico nem mensagem em outro idioma.
 */
export function getErrorMessage(error: unknown): string {
  const t = getTranslations()
  const key = error instanceof UIError ? `errors.${error.code}` : null
  if (key && i18n.exists(key)) return t(key as MessageKey)
  return t('errors.generic')
}
