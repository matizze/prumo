import path from 'node:path'
import { messageLanguages, registerRepository } from '../codemods/index.ts'
import { UsageError } from '../errors.ts'
import { domainFieldVars, readEntityFields, type Field } from '../lib/fields.ts'
import { domainNames, type DomainNames } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import type { Project } from '../lib/project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../lib/templates.ts'
import { messagesLanguageOf } from './page.ts'

export interface RepositoryRequest {
  /** O nome do domínio, no plural e em kebab-case: `clientes`. */
  name: string
  /** A entidade, no singular. Sem ela, sai do nome (tira o `s` final). */
  entity?: string | undefined
}

export interface RepositoryResult {
  plan: ChangePlan
  names: DomainNames
  /** Os campos lidos do schema. */
  fields: Field[]
  /** Avisos que não impedem o comando (o `errors.json` que falta). */
  warnings: string[]
}

/** Um modelo e onde ele cai no projeto, os dois com marcadores. */
interface RepositoryFile {
  template: string
  to: string
}

/** Os arquivos do repositório de um domínio, na ordem em que o plano os lista. */
export const REPOSITORY_FILES: readonly RepositoryFile[] = [
  {
    template: 'domain/repository-contract.ts.tpl',
    to: 'src/repositories/{{plural.kebab}}/repository.contract.ts',
  },
  {
    template: 'domain/repository-mock.ts.tpl',
    to: 'src/repositories/{{plural.kebab}}/repository.mock.ts',
  },
  {
    template: 'domain/repository-fixtures.ts.tpl',
    to: 'src/repositories/{{plural.kebab}}/fixtures.ts',
  },
  { template: 'domain/repository-index.ts.tpl', to: 'src/repositories/{{plural.kebab}}/index.ts' },
  {
    template: 'domain/repository-contract-test.ts.tpl',
    to: 'src/repositories/{{plural.kebab}}/repository.contract.test.ts',
  },
]

/** O texto de `<ENTIDADE>_NOT_FOUND` em cada língua dos modelos (o mock gerado lança esse código). */
const NOT_FOUND_TEXT = { 'pt-BR': 'Registro não encontrado.', en: 'Record not found.' } as const

/**
 * Acrescenta `<ENTIDADE>_NOT_FOUND` ao `src/messages/<idioma>/errors.json` de cada idioma, para a
 * pessoa ver o texto do erro, não o genérico. Um app sem o namespace de erros (o arquivo falta ou
 * é inválido) fica sem a chave naquele idioma, e o comando devolve um aviso, sem falhar. A chave
 * que já existe não é trocada.
 */
function addNotFoundMessages(plan: ChangePlan, names: DomainNames): string[] {
  const key = `${nameVars('singular', names.singular)['singular.constant']}_NOT_FOUND`
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
    if (key in messages) continue
    const text = NOT_FOUND_TEXT[messagesLanguageOf(language)]
    plan.editText(file, `${JSON.stringify({ ...messages, [key]: text }, null, 2)}\n`)
  }
  if (missing.length === 0) return []
  return [
    `o texto de ${key} não foi acrescentado: falta o namespace de erros: ${missing.join(', ')}. Sem ele, a tela mostra o texto genérico; veja o guia de erros (docs/guides/errors-and-notifications.md) para criar o errors.json e o src/errors.ts.`,
  ]
}

/**
 * Monta o plano do repositório (fonte `mock`) de um domínio: os arquivos de `src/repositories/<domínio>/`
 * e o registro no container `src/repositories/index.ts`, com o texto de `<ENTIDADE>_NOT_FOUND` nos
 * `errors.json`. Os campos (busca, ordem, fixtures e teste de contrato) saem do schema gerado, lido
 * com `readEntityFields`. Nada vai para o disco: quem chama mostra o `summary()` ou faz o `commit()`.
 * Valida tudo antes de montar o plano; todo erro de uso é um `UsageError` (saída 2).
 */
export function generateRepository(
  project: Project,
  { name, entity }: RepositoryRequest,
): RepositoryResult {
  const names = domainNames(name, entity)
  const plan = new ChangePlan(project)
  const fields = readEntityFields(plan, names)
  const folder = path.join(project.src, 'repositories', names.plural.kebab)
  if (plan.has(folder)) {
    throw new UsageError(
      `o repositório '${names.plural.kebab}' já existe: a pasta src/repositories/${names.plural.kebab} está no projeto.`,
    )
  }

  const vars = {
    ...nameVars('plural', names.plural),
    ...nameVars('singular', names.singular),
    ...domainFieldVars(fields, names.singular.kebab),
  }
  for (const { template, to } of REPOSITORY_FILES) {
    plan.createSource(
      path.join(project.root, renderTemplate(to, vars)),
      renderTemplateFile(template, vars),
    )
  }
  registerRepository(plan, names)
  const warnings = addNotFoundMessages(plan, names)
  return { plan, names, fields, warnings }
}
