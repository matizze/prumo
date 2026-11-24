import path from 'node:path'
import { messageLanguages } from '../codemods/index.ts'
import type { ChangePlan } from '../lib/plan.ts'
import { messagesLanguageOf } from './page.ts'

/** O texto de um erro em cada língua dos modelos. */
export interface ErrorText {
  'pt-BR': string
  en: string
}

/**
 * Acrescenta cada código de `errors` (`NOT_FOUND`, `SIGN_IN_FAILED`) ao `src/messages/<idioma>/errors.json`
 * de cada idioma, para a pessoa ver o texto do erro, não o genérico. Um app sem o namespace de erros
 * (o arquivo falta ou é inválido) fica sem a chave naquele idioma, e o comando devolve um aviso, sem
 * falhar. A chave que já existe não é trocada.
 */
export function addErrorMessages(plan: ChangePlan, errors: Readonly<Record<string, ErrorText>>): string[] {
  const keys = Object.keys(errors)
  const missing: string[] = []
  let languages: string[]
  try {
    languages = messageLanguages(plan.project)
  } catch {
    languages = []
    missing.push('src/messages (o projeto não tem idioma)')
  }
  for (const language of languages) {
    const file = path.join(plan.project.messages, language, 'errors.json')
    const relative = `src/messages/${language}/errors.json`
    if (!plan.hasFile(file)) {
      missing.push(relative)
      continue
    }
    let messages: unknown
    try {
      messages = JSON.parse(plan.readText(file))
    } catch {
      missing.push(`${relative} (JSON inválido)`)
      continue
    }
    if (typeof messages !== 'object' || messages === null || Array.isArray(messages)) {
      missing.push(`${relative} (não é um objeto)`)
      continue
    }
    const added: Record<string, string> = {}
    for (const [key, text] of Object.entries(errors)) {
      if (!(key in messages)) added[key] = text[messagesLanguageOf(language)]
    }
    if (Object.keys(added).length === 0) continue
    plan.editText(file, `${JSON.stringify({ ...messages, ...added }, null, 2)}\n`)
  }
  if (missing.length === 0) return []
  return [
    `o texto de ${keys.join(' e ')} não foi acrescentado: falta o namespace de erros: ${missing.join(', ')}. Sem ele, a tela mostra o texto genérico; veja o guia de erros (https://docs.prumo.matizze.com.br/guides/errors-and-notifications) para criar o errors.json e o src/errors.ts.`,
  ]
}
