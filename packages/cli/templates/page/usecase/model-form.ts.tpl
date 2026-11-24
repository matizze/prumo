import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { getErrorMessage } from '@/errors'
import { useTranslations } from '@/i18n'
import { useUseCases } from '@/providers/use-cases'
import type { {{uc.input}} } from '@/use-cases/{{uc.domain}}/{{uc.kebab}}.types'
{{form.inputOf}}
export function use{{page.pascal}}Model() {
  const t = useTranslations('{{page.camel}}')
  const queryClient = useQueryClient()
  const { {{uc.key}} } = useUseCases()
  const mutation = useMutation({
    mutationFn: (input: {{uc.input}}) => {{uc.key}}.execute(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['{{uc.domain}}'] }),
  })
  return {
    title: t('title'),
    fields: {{form.labels}},
    submitText: t('submit'),
    successText: t('success'),
    // Voltar a editar tira o aviso de sucesso (ou de erro) do envio anterior
    onChange: () => mutation.reset(),
    onSubmit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      {{form.submit}}
    },
    submitting: mutation.isPending,
    succeeded: mutation.isSuccess,
    errorText: mutation.isError ? getErrorMessage(mutation.error) : null,
  }
}

export type {{page.pascal}}Model = ReturnType<typeof use{{page.pascal}}Model>
