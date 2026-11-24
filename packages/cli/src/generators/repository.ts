import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  addDataSource,
  readDataSourceFromEnv,
  registerContractSource,
  registerFactorySource,
  registerRepository,
  type RepositorySource,
} from '../codemods/index.ts'
import { UsageError } from '../errors.ts'
import { domainFieldVars, readEntityFields, readEntityShape, type Field } from '../lib/fields/index.ts'
import { domainNames, type DomainNames } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import type { Project } from '../lib/project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../lib/templates.ts'
import { addErrorMessages } from './error-messages.ts'

/** As fontes de dados que o comando aceita: o mock (sempre existe) e as que se acrescentam a ele. */
export const DATA_SOURCE_CHOICES = ['mock', 'http', 'storage'] as const

export type DataSourceChoice = (typeof DATA_SOURCE_CHOICES)[number]

export interface RepositoryRequest {
  /** O nome do domínio, no plural e em kebab-case: `clientes`. */
  name: string
  /** A entidade, no singular. Sem ela, sai do nome (tira o `s` final). */
  entity?: string | undefined
  /**
   * A fonte a criar. `mock` (padrão) cria o repositório e recusa o que já existe; `http` e `storage`
   * criam o repositório, se falta, e acrescentam a fonte.
   */
  dataSource?: DataSourceChoice | undefined
}

export interface RepositoryResult {
  plan: ChangePlan
  names: DomainNames
  /** Os campos lidos do schema. */
  fields: Field[]
  /** A fonte pedida. */
  dataSource: DataSourceChoice
  /** O repositório foi criado agora (e não só ganhou a fonte). */
  created: boolean
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

/** Os arquivos de cada fonte acrescentada, ao lado do mock. */
export const SOURCE_FILES: Readonly<Record<RepositorySource, RepositoryFile>> = {
  http: {
    template: 'domain/repository-http.ts.tpl',
    to: 'src/repositories/{{plural.kebab}}/repository.http.ts',
  },
  storage: {
    template: 'domain/repository-storage.ts.tpl',
    to: 'src/repositories/{{plural.kebab}}/repository.storage.ts',
  },
}

/**
 * O que a primeira fonte http do app cria, se faltam (o app novo já os traz): a instância do cliente
 * da API e os tipos do `import.meta.env`. Cada arquivo que já existe é aproveitado, não recriado.
 */
export const HTTP_CLIENT_FILES: readonly RepositoryFile[] = [
  { template: 'app/src/http/api.ts.tpl', to: 'src/http/api.ts' },
  { template: 'app/src/vite-env.d.ts.tpl', to: 'src/vite-env.d.ts' },
]

/** Os códigos de erro que os repositórios gerados lançam, e o texto de cada um em cada língua dos modelos. */
const ERROR_TEXT = {
  NOT_FOUND: { 'pt-BR': 'Registro não encontrado.', en: 'Record not found.' },
  INVALID: { 'pt-BR': 'Dados inválidos.', en: 'Invalid data.' },
} as const

type ErrorSuffix = keyof typeof ERROR_TEXT

/** Acrescenta `<ENTIDADE>_<sufixo>` aos `errors.json` do projeto (veja `addErrorMessages`). */
function addEntityErrors(
  plan: ChangePlan,
  names: DomainNames,
  suffixes: readonly ErrorSuffix[],
): string[] {
  const base = nameVars('singular', names.singular)['singular.constant']
  return addErrorMessages(
    plan,
    Object.fromEntries(suffixes.map((suffix) => [`${base}_${suffix}`, ERROR_TEXT[suffix]])),
  )
}

/** O nome do app (o `name` do `package.json`), que separa as chaves do `localStorage`; sem ele, o da pasta. */
function appNameOf(project: Project): string {
  try {
    const manifest = JSON.parse(readFileSync(path.join(project.root, 'package.json'), 'utf8')) as {
      name?: unknown
    }
    if (typeof manifest.name === 'string' && manifest.name !== '') return manifest.name
  } catch {
    // package.json que não se lê: o nome da pasta serve
  }
  return path.basename(project.root)
}

/** Um texto para dentro de um literal de aspas simples. */
const inQuotes = (text: string) => text.replace(/[\\']/g, '\\$&')

/**
 * Monta o plano do repositório de um domínio: os arquivos de `src/repositories/<domínio>/` e o
 * registro no container `src/repositories/index.ts`, com o texto de `<ENTIDADE>_NOT_FOUND` nos
 * `errors.json`. Com `dataSource` `http` ou `storage`, acrescenta também `repository.<fonte>.ts`, a
 * fonte em `DATA_SOURCES`, a linha da fábrica e o teste de contrato da fonte (e, na primeira fonte
 * http do app, o cliente e a instância dele); se o repositório já existe, só a fonte entra. Os
 * campos (busca, ordem, fixtures e teste de contrato) saem do schema gerado, lido com
 * `readEntityFields`, e o `create` e a ordem seguem o `pick` e a `SortKey` (`readEntityShape`). Nada
 * vai para o disco: quem chama mostra o `summary()` ou faz o `commit()`. Valida tudo antes de montar
 * o plano; todo erro de uso é um `UsageError` (saída 2).
 */
export function generateRepository(
  project: Project,
  { name, entity, dataSource = 'mock' }: RepositoryRequest,
): RepositoryResult {
  const names = domainNames(name, entity)
  const plan = new ChangePlan(project)
  const fields = readEntityFields(plan, names)
  const shape = readEntityShape(plan, names, fields)
  const folder = path.join(project.src, 'repositories', names.plural.kebab)
  const exists = plan.has(folder)
  if (dataSource === 'mock' && exists) {
    throw new UsageError(
      `o repositório '${names.plural.kebab}' já existe: a pasta src/repositories/${names.plural.kebab} está no projeto.`,
    )
  }
  if (dataSource !== 'mock' && plan.has(path.join(folder, `repository.${dataSource}.ts`))) {
    throw new UsageError(
      `o repositório '${names.plural.kebab}' já tem a fonte ${dataSource}: src/repositories/${names.plural.kebab}/repository.${dataSource}.ts está no projeto.`,
    )
  }

  const vars = {
    ...nameVars('plural', names.plural),
    ...nameVars('singular', names.singular),
    ...domainFieldVars(fields, names.singular.kebab, shape),
    'app.kebab': inQuotes(appNameOf(project)),
  }
  const create = ({ template, to }: RepositoryFile) =>
    plan.createSource(
      path.join(project.root, renderTemplate(to, vars)),
      renderTemplateFile(template, vars),
    )
  const warnings: string[] = []
  if (!exists) {
    REPOSITORY_FILES.forEach(create)
    registerRepository(plan, names)
    warnings.push(...addEntityErrors(plan, names, dataSource === 'storage' ? ['NOT_FOUND', 'INVALID'] : ['NOT_FOUND']))
  }
  if (dataSource !== 'mock') {
    const oldApi = path.join(project.src, 'repositories', 'api.ts')
    if (dataSource === 'http' && plan.has(oldApi) && !plan.has(path.join(project.root, HTTP_CLIENT_FILES[0]!.to))) {
      warnings.push(
        "o app tem o src/repositories/api.ts de antes dos use cases, e o comando criou o src/http/api.ts ao lado dele: passe a usar o de src/http e apague o antigo e o src/repositories/http.ts (veja docs/guides/real-api.md).",
      )
    }
    create(SOURCE_FILES[dataSource])
    if (dataSource === 'http') {
      for (const file of HTTP_CLIENT_FILES) {
        if (!plan.has(path.join(project.root, file.to))) create(file)
      }
    }
    // O container lê a fonte do ambiente, e o tipo do `import.meta.env` precisa existir
    const envTypes = HTTP_CLIENT_FILES.find((file) => file.to === 'src/vite-env.d.ts')!
    if (!plan.has(path.join(project.root, envTypes.to))) create(envTypes)
    const containerWarning = readDataSourceFromEnv(plan)
    if (containerWarning) warnings.push(containerWarning)
    if (exists && dataSource === 'storage') {
      warnings.push(...addEntityErrors(plan, names, ['INVALID']))
    }
    addDataSource(plan, dataSource)
    registerFactorySource(plan, names, dataSource)
    const warning = registerContractSource(plan, names, dataSource)
    if (warning) warnings.push(warning)
  }
  return { plan, names, fields, dataSource, created: !exists, warnings }
}
