import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  ChangePlan,
  domainNames,
  registerQueriesEntry,
  registerRepository,
  registerSchema,
  type DomainNames,
} from '../codemod/index.ts'
import { messageLanguages } from '../codemod/messages.ts'
import { UsageError } from '../errors.ts'
import type { Project } from '../project.ts'
import { messagesLanguageOf } from './page.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../templates.ts'

/** Um arquivo do domínio: o modelo e onde ele cai no projeto, os dois com marcadores. */
interface DomainFile {
  /** O modelo, em `templates/`. */
  template: string
  /** O caminho no projeto, relativo à raiz. */
  to: string
}

/** Os arquivos de um domínio novo, na ordem em que o plano os lista. */
export const DOMAIN_FILES: readonly DomainFile[] = [
  { template: 'domain/schema.ts.tpl', to: 'src/schemas/entities/{{singular.kebab}}.ts' },
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
  { template: 'domain/queries.ts.tpl', to: 'src/queries/{{plural.kebab}}.ts' },
]

/** Os nomes que o domínio exporta de `src/queries/index.ts`: as chaves, as queries e os hooks. */
export function queriesExports(to: DomainNames): string[] {
  const { plural, singular } = to
  return [
    `${singular.camel}Keys`,
    `${singular.camel}Queries`,
    `use${plural.pascal}List`,
    `use${singular.pascal}Detail`,
    `useCreate${singular.pascal}`,
    `useUpdate${singular.pascal}`,
    `useRemove${singular.pascal}`,
  ]
}

/** O texto de `<ENTIDADE>_NOT_FOUND` em cada língua dos modelos (o mock gerado lança esse código). */
const NOT_FOUND_TEXT = { 'pt-BR': 'Registro não encontrado.', en: 'Record not found.' } as const

/**
 * Acrescenta `<ENTIDADE>_NOT_FOUND` ao `src/messages/<idioma>/errors.json` de cada idioma, para a
 * pessoa ver o texto do erro, não o genérico. Um app criado antes do `new` trazer o namespace de
 * erros não tem o arquivo (ou o tem inválido): nesse caso o idioma fica sem a chave e o comando
 * devolve um aviso, sem falhar. A chave que já existe não é trocada.
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

export interface DomainRequest {
  /** O nome do domínio, no plural e em kebab-case: `clientes`. */
  name: string
  /** A entidade, no singular. Sem ela, sai do nome (tira o `s` final). */
  entity?: string | undefined
}

/**
 * Monta o plano de um domínio novo: os arquivos dos modelos (schema, repositório com contrato,
 * mock, fixtures, index e teste de contrato, e as queries) e as costuras nos índices de schemas,
 * repositórios (com o mapa `factories`, que é o container) e queries. Nada vai para o disco: o
 * chamador mostra o `summary()` ou faz o `commit()`. Valida o nome e confere o projeto antes de
 * montar qualquer coisa, e todo erro de uso é um `UsageError` (saída 2).
 */
export function generateDomain(
  project: Project,
  { name, entity }: DomainRequest,
): { plan: ChangePlan; names: DomainNames; warnings: string[] } {
  const names = domainNames(name, entity)
  const folder = path.join(project.src, 'repositories', names.plural.kebab)
  if (existsSync(folder)) {
    throw new UsageError(
      `o domínio '${names.plural.kebab}' já existe: a pasta src/repositories/${names.plural.kebab} está no projeto.`,
    )
  }

  const vars = { ...nameVars('plural', names.plural), ...nameVars('singular', names.singular) }
  const plan = new ChangePlan(project)
  for (const { template, to } of DOMAIN_FILES) {
    plan.createSource(
      path.join(project.root, renderTemplate(to, vars)),
      renderTemplateFile(template, vars),
    )
  }

  registerSchema(plan, names)
  registerRepository(plan, names)
  registerQueriesEntry(plan, { module: names.plural.kebab, exports: queriesExports(names) })
  const warnings = addNotFoundMessages(plan, names)
  return { plan, names, warnings }
}
