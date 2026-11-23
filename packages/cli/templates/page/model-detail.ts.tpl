import { useParams } from 'wouter'
import { useTranslations } from '@/i18n'
import { {{detail.hook}} } from '@/queries/{{domain.kebab}}'

export function use{{page.pascal}}Model() {
  const t = useTranslations('{{page.camel}}')
  const { {{param.name}} } = useParams<{ {{param.name}}: string }>()
  const detail = {{detail.hook}}({{param.name}})
  return {
    title: t('title'),
    loadingText: t('loading'),
    failedText: t('failed'),
    item: detail.data,
    loading: detail.isPending,
    failed: detail.isError,
  }
}

export type {{page.pascal}}Model = ReturnType<typeof use{{page.pascal}}Model>
