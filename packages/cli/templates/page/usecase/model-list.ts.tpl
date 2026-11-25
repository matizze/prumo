import { useQuery } from '@tanstack/react-query'
import { useTranslations } from '@/i18n'
import { useUseCases } from '@/providers/use-cases'
import { {{uc.keyFn}} } from '@/use-cases/{{uc.domain}}/types/{{uc.kebab}}'

export function use{{page.pascal}}Model() {
  const t = useTranslations('{{page.camel}}')
  const { {{uc.key}} } = useUseCases()
  const input = {}
  const list = useQuery({ queryKey: {{uc.keyFn}}(input), queryFn: () => {{uc.key}}.execute(input) })
  return {
    title: t('title'),
    loadingText: t('loading'),
    failedText: t('failed'),
    emptyText: t('empty'),
    items: {{list.items}},
    loading: list.isPending,
    failed: list.isError,
  }
}

export type {{page.pascal}}Model = ReturnType<typeof use{{page.pascal}}Model>
