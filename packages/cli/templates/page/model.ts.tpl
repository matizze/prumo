import { useTranslations } from '@/i18n'

export function use{{page.pascal}}Model() {
  const t = useTranslations('{{page.camel}}')
  return { title: t('title') }
}

export type {{page.pascal}}Model = ReturnType<typeof use{{page.pascal}}Model>
