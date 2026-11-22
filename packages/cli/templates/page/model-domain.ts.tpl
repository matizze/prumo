import { useTranslations } from '@/i18n'
import { use{{domain.pascal}}List } from '@/queries/{{domain.kebab}}'

export function use{{page.pascal}}Model() {
  const t = useTranslations('{{page.camel}}')
  const list = use{{domain.pascal}}List()
  return {
    title: t('title'),
    loadingText: t('loading'),
    failedText: t('failed'),
    items: list.data?.items ?? [],
    loading: list.isPending,
    failed: list.isError,
  }
}

export type {{page.pascal}}Model = ReturnType<typeof use{{page.pascal}}Model>
