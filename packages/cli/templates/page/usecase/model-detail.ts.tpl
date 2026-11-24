import { useQuery } from '@tanstack/react-query'
import { useParams } from 'wouter'
import { useTranslations } from '@/i18n'
import { useUseCases } from '@/providers/use-cases'
import { {{uc.keyFn}} } from '@/use-cases/{{uc.domain}}/{{uc.kebab}}.types'

export function use{{page.pascal}}Model() {
  const t = useTranslations('{{page.camel}}')
  const { {{param.name}} } = useParams<{ {{param.name}}: string }>()
  const { {{uc.key}} } = useUseCases()
  const input = { {{param.name}} }
  const detail = useQuery({ queryKey: {{uc.keyFn}}(input), queryFn: () => {{uc.key}}.execute(input) })
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
