import { createErrorMessage } from '@matizze/prumo-core/errors'
import { i18n } from '@/i18n'

/** O texto de um erro no idioma ativo: errors.<CÓDIGO> ou, sem tradução, errors.generic. */
export const getErrorMessage = createErrorMessage(i18n)
