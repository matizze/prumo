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
import { UsageError } from '../errors.ts'
import type { Project } from '../project.ts'
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
): { plan: ChangePlan; names: DomainNames } {
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
  return { plan, names }
}
