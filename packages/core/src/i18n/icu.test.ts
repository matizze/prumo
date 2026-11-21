import { describe, expect, it } from 'vitest'
import i18n from './config'
import { getTranslations } from './index'

describe('sintaxe ICU', () => {
  it('plural em pt-BR (0 e 1 são "one")', () => {
    const t = getTranslations('tasks.list')

    expect(t('progress', { completed: 0, total: 0 })).toBe('0/0 concluída')
    expect(t('progress', { completed: 1, total: 1 })).toBe('1/1 concluída')
    expect(t('progress', { completed: 1, total: 2 })).toBe('1/2 concluídas')
  })

  it('o mesmo texto em en não varia com o plural', async () => {
    await i18n.changeLanguage('en')

    expect(getTranslations('tasks.list')('progress', { completed: 1, total: 2 })).toBe('1/2 done')
  })

  it('select escolhe o ramo pelo valor', () => {
    // Mensagem de teste: nenhuma tela usa select hoje, mas as próximas vão usar
    i18n.addResource(
      'pt-BR',
      'translation',
      'icuTest.notifications',
      'Notificações por e-mail {state, select, on {ativadas} other {desativadas}}',
    )

    expect(i18n.t('icuTest.notifications', { state: 'on' })).toBe(
      'Notificações por e-mail ativadas',
    )
    expect(i18n.t('icuTest.notifications', { state: 'off' })).toBe(
      'Notificações por e-mail desativadas',
    )
  })

  it('interpolação simples', async () => {
    await i18n.changeLanguage('en')

    expect(getTranslations('auth.signIn')('social', { provider: 'Google' })).toBe(
      'Sign in with Google',
    )
  })
})
