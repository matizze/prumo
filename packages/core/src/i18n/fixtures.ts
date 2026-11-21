import { defineI18n } from './define.ts'

/** Mensagens de fixture para os testes: nenhum teste do pacote depende das mensagens de um produto. */
export const ptBR = {
  auth: {
    signIn: {
      submit: 'Entrar',
      social: 'Entrar com {provider}',
    },
  },
  tasks: {
    list: {
      progress: '{completed}/{total} {total, plural, one {concluída} other {concluídas}}',
    },
  },
  errors: { generic: 'Algo deu errado. Tente novamente.' },
}

export const en = {
  auth: {
    signIn: {
      submit: 'Sign in',
      social: 'Sign in with {provider}',
    },
  },
  tasks: {
    list: {
      progress: '{completed}/{total} done',
    },
  },
  errors: { generic: 'Something went wrong. Please try again.' },
}

/** Kit de fixture com os mesmos idiomas e o mesmo padrão do app de referência. */
export const fixtureKit = defineI18n({
  messages: { 'pt-BR': ptBR, en },
  defaultLocale: 'pt-BR',
  languages: {
    'pt-BR': { name: 'Português (Brasil)', shortName: 'PT' },
    en: { name: 'English', shortName: 'EN' },
  },
})
