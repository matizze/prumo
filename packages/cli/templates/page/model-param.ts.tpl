import { useParams } from 'wouter'
import { useTranslations } from '@/i18n'

export function use{{page.pascal}}Model() {
  const t = useTranslations('{{page.camel}}')
  const { {{param.name}} } = useParams<{ {{param.name}}: string }>()
  return { title: t('title'), params: { {{param.name}} } }
}

export type {{page.pascal}}Model = ReturnType<typeof use{{page.pascal}}Model>
