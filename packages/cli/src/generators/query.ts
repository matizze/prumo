import path from 'node:path'
import { isQueriesRegistered, registerQueriesEntry } from '../codemods/index.ts'
import { UsageError } from '../errors.ts'
import { domainNames, entityFlag, type DomainNames } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import type { Project } from '../lib/project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../lib/templates.ts'

export interface QueryRequest {
  /** O nome do domínio, no plural e em kebab-case: `clientes`. */
  name: string
  /** A entidade, no singular. Sem ela, sai do nome (tira o `s` final). */
  entity?: string | undefined
}

export interface QueryResult {
  plan: ChangePlan
  names: DomainNames
  /** Os nomes que `src/queries/index.ts` reexporta. */
  exports: string[]
}

/** O modelo das queries e onde ele cai no projeto, os dois com marcadores. */
export const QUERY_FILE = {
  template: 'domain/queries.ts.tpl',
  to: 'src/queries/{{plural.kebab}}.ts',
} as const

/** Os nomes que o domínio exporta de `src/queries/index.ts`: as chaves, as queries e os hooks. */
export function queriesExports(names: DomainNames): string[] {
  const { plural, singular } = names
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

/**
 * Monta o plano das queries de um domínio: `src/queries/<domínio>.ts`, a partir do modelo, e o
 * `export { ... } from './<domínio>'` em `src/queries/index.ts`. As queries só usam o contrato do
 * repositório (`useRepositories()`), então valem para qualquer fonte e não leem os campos. Nada
 * vai para o disco. Valida tudo antes de montar o plano (o repositório que falta, a query que já
 * existe e o índice); todo erro de uso é um `UsageError` (saída 2).
 */
export function generateQuery(project: Project, { name, entity }: QueryRequest): QueryResult {
  const names = domainNames(name, entity)
  const plan = new ChangePlan(project)
  const repository = path.join(project.src, 'repositories', names.plural.kebab)
  if (!plan.has(repository)) {
    throw new UsageError(
      `falta o repositório ${names.plural.kebab} (src/repositories/${names.plural.kebab}); rode prumo make:repository ${names.plural.kebab}${entityFlag(names)}.`,
    )
  }
  const vars = { ...nameVars('plural', names.plural), ...nameVars('singular', names.singular) }
  const target = renderTemplate(QUERY_FILE.to, vars)
  if (plan.has(path.join(project.root, target)) || isQueriesRegistered(plan, names.plural.kebab)) {
    throw new UsageError(`a query '${names.plural.kebab}' já existe: ${target} está no projeto.`)
  }
  plan.createSource(path.join(project.root, target), renderTemplateFile(QUERY_FILE.template, vars))
  const exports = queriesExports(names)
  registerQueriesEntry(plan, { module: names.plural.kebab, exports })
  return { plan, names, exports }
}
