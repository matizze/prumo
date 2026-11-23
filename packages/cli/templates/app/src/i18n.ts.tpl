import { defineI18n } from '@matizze/prumo-core/i18n'
import en from './messages/en'
import ptBR from './messages/pt-BR'

export const { I18nProvider, useTranslations, i18n } = defineI18n({
  messages: { 'pt-BR': ptBR, en },
  defaultLocale: 'pt-BR',
  languages: {
    'pt-BR': { name: 'Português (Brasil)', shortName: 'PT' },
    en: { name: 'English', shortName: 'EN' },
  },
})
