import path from 'node:path'
import { registerSchema } from '../codemods/index.ts'
import { UsageError } from '../errors.ts'
import { DEFAULT_FIELDS, domainFieldVars, parseFields, schemaFile, type Field } from '../lib/fields/index.ts'
import { domainNames, type DomainNames } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import type { Project } from '../lib/project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../lib/templates.ts'

export interface SchemaRequest {
  /** O nome do domínio, no plural e em kebab-case: `clientes`. */
  name: string
  /** A entidade, no singular. Sem ela, sai do nome (tira o `s` final). */
  entity?: string | undefined
  /** Os campos, no formato do `--fields` (`titulo:string,ano:int`). Sem eles, só `name:string`. */
  fields?: string | undefined
}

export interface SchemaResult {
  plan: ChangePlan
  names: DomainNames
  fields: Field[]
}

/** O modelo do schema e onde ele cai no projeto, os dois com marcadores. */
export const SCHEMA_FILE = {
  template: 'domain/schema.ts.tpl',
  to: 'src/schemas/entities/{{singular.kebab}}.ts',
} as const

/**
 * Monta o plano de um schema novo: `src/schemas/entities/<entidade>.ts` a partir do modelo, com os
 * campos do `--fields`, e o `export *` em `src/schemas/index.ts`. Nada vai para o disco: quem chama
 * mostra o `summary()` ou faz o `commit()`. Valida tudo antes de montar o plano (o nome, a entidade,
 * os campos, o schema que já existe e o índice); todo erro de uso é um `UsageError` (saída 2).
 */
export function generateSchema(
  project: Project,
  { name, entity, fields: fieldsText }: SchemaRequest,
): SchemaResult {
  const names = domainNames(name, entity)
  const fields = fieldsText === undefined ? [...DEFAULT_FIELDS] : parseFields(fieldsText)
  const plan = new ChangePlan(project)
  const file = path.join(project.root, schemaFile(names))
  if (plan.has(file)) {
    throw new UsageError(
      `o schema '${names.singular.kebab}' já existe: ${schemaFile(names)} está no projeto (use --entity se o domínio é outro).`,
    )
  }

  const vars = {
    ...nameVars('plural', names.plural),
    ...nameVars('singular', names.singular),
    ...domainFieldVars(fields, names.singular.kebab),
  }
  plan.createSource(path.join(project.root, renderTemplate(SCHEMA_FILE.to, vars)), renderTemplateFile(SCHEMA_FILE.template, vars))
  registerSchema(plan, names)
  return { plan, names, fields }
}
