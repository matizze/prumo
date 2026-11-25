import path from 'node:path'
import { registerUseCase, registerUseCaseDomain } from '../codemods/index.ts'
import { UsageError } from '../errors.ts'
import {
  parseFields,
  readEntityFields,
  sampleCode,
  sampleRecord,
  schemaFile,
  zodOf,
  type Field,
  type FieldType,
  type Sample,
} from '../lib/fields/index.ts'
import { listUseCases, type UseCaseKind } from '../lib/listing.ts'
import { assertValidName, deriveNames, RESERVED_WORDS, useCaseNames, type UseCaseNames } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import type { Project } from '../lib/project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../lib/templates.ts'

/** Os verbos que começam uma ação de leitura (o model usa com `useQuery`); o resto é escrita (`useMutation`). */
export const READ_VERBS = ['get', 'list', 'search', 'find', 'check', 'count'] as const

export type Access = 'read' | 'write'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

type Method = (typeof METHODS)[number]

/** O endereço da API de um use case. */
export interface Endpoint {
  method: Method
  /** O caminho, com `:parâmetros` (`/livros/:id`). */
  path: string
  /** Os nomes dos `:parâmetros`, na ordem do caminho: cada um sai de um campo do Request. */
  params: string[]
}

export interface UseCaseRequest {
  /** `<domínio>.<ação>` ou `<domínio>/<ação>`, em kebab-case. */
  name: string
  /** Os campos do Request, na sintaxe do `--fields` do make:schema. */
  input?: string | undefined
  /** Os campos do Response, ou o nome de uma entidade (`store`, `store[]`) que já tem schema. */
  output?: string | undefined
  /** `<MÉTODO> <caminho>`: troca o endereço padrão. */
  endpoint?: string | undefined
  /** Força a leitura (o padrão sai do verbo da ação). */
  read?: boolean | undefined
  /** Força a escrita. */
  write?: boolean | undefined
  /** Use case sem API: usa o `storage` do navegador. */
  local?: boolean | undefined
}

export interface UseCaseResult {
  plan: ChangePlan
  names: UseCaseNames
  /** Leitura (o model usa com `useQuery`) ou escrita (`useMutation`), também no `local`. */
  access: Access
  /** `read`, `write` ou `local`. */
  kind: UseCaseKind
  /** O endereço da API; `null` no `local`. */
  endpoint: Endpoint | null
  /** A chave no registro: `useUseCases().<chave>`. */
  key: string
  /** Avisos que não impedem o comando (o Request e o Response que ficaram no padrão). */
  warnings: string[]
}

/** O que o Response é: o padrão, os campos dados ou uma entidade que já tem schema. */
export type OutputSpec =
  | { kind: 'default' }
  | { kind: 'fields'; fields: Field[] }
  | { kind: 'entity'; entity: string; fields: Field[]; list: boolean }

/** Um modelo e onde ele cai no projeto, os dois com marcadores. */
export interface UseCaseFile {
  template: string
  to: string
}

export const FOLDER = 'src/use-cases/{{domain.kebab}}'

/** Os arquivos de um use case com API, na ordem em que o plano os lista. */
export const USE_CASE_FILES: readonly UseCaseFile[] = [
  { template: 'usecase/types.ts.tpl', to: `${FOLDER}/types/{{action.kebab}}.ts` },
  { template: 'usecase/usecase.ts.tpl', to: `${FOLDER}/services/{{action.kebab}}.usecase.ts` },
  { template: 'usecase/mock.ts.tpl', to: `${FOLDER}/mocks/{{action.kebab}}.ts` },
  { template: 'usecase/test.ts.tpl', to: `${FOLDER}/services/{{action.kebab}}.usecase.test.ts` },
]

/** Os arquivos de um use case `--local`: sem a rota de mock. */
export const LOCAL_USE_CASE_FILES: readonly UseCaseFile[] = [
  USE_CASE_FILES[0]!,
  { template: 'usecase/usecase-local.ts.tpl', to: `${FOLDER}/services/{{action.kebab}}.usecase.ts` },
  { template: 'usecase/test-local.ts.tpl', to: `${FOLDER}/services/{{action.kebab}}.usecase.test.ts` },
]

/** O índice do domínio, criado com o primeiro use case dele. */
export const DOMAIN_INDEX_FILE: UseCaseFile = {
  template: 'usecase/index.ts.tpl',
  to: `${FOLDER}/index.ts`,
}

/** Os tipos de campo que cabem num `:parâmetro` do caminho. */
const PARAM_TYPES: readonly FieldType[] = ['string', 'number', 'int', 'boolean', 'enum']

/** Os nomes que o `execute` gerado declara: um `:parâmetro` com um deles redeclararia a variável. */
const EXECUTE_LOCALS: ReadonlySet<string> = new Set(['input', 'path', 'body', 'query', 'response'])

/** Leitura ou escrita: `--read` e `--write` mandam; sem eles, o verbo no começo da ação decide. */
function accessOf(action: string, { read, write }: UseCaseRequest): Access {
  if (read && write) throw new UsageError("use '--read' ou '--write', não os dois.")
  if (read) return 'read'
  if (write) return 'write'
  const verb = action.split('-')[0] ?? ''
  return READ_VERBS.some((candidate) => candidate === verb) ? 'read' : 'write'
}

/**
 * Lê o `--endpoint` (`PATCH /livros/:id`) e confere com o Request: cada `:parâmetro` do caminho sai
 * de um campo obrigatório do Request com o mesmo nome, e um não pode ser o começo do nome de outro
 * (o `execute` troca cada um por texto).
 */
function parseEndpoint(text: string, input: readonly Field[]): Endpoint {
  const match = /^(\w+)\s+(\/\S*)$/.exec(text.trim())
  const method = match?.[1]?.toUpperCase()
  const route = match?.[2]
  const found = METHODS.find((candidate) => candidate === method)
  if (!found || route === undefined || /[?#]/.test(route)) {
    throw new UsageError(
      `--endpoint '${text}' é inválido: use '<MÉTODO> <caminho>', como 'PATCH /livros/:id' (métodos: ${METHODS.join(', ')}; o caminho começa com / e não leva ? nem #: o que vai na query sai do Request).`,
    )
  }
  const params = [...route.matchAll(/\/:([A-Za-z][A-Za-z0-9_]*)/g)].map((param) => param[1]!)
  for (const [index, param] of params.entries()) {
    const field = input.find((candidate) => candidate.name === param)
    if (!field) {
      throw new UsageError(
        `--endpoint '${text}': o parâmetro ':${param}' do caminho não é um campo do Request: acrescente '${param}:string' ao --input.`,
      )
    }
    if (field.optional) {
      throw new UsageError(`--endpoint '${text}': o campo '${param}' do Request tem que ser obrigatório, porque o caminho precisa dele.`)
    }
    if (RESERVED_WORDS.has(param)) {
      throw new UsageError(`--endpoint '${text}': o parâmetro ':${param}' é palavra reservada do JavaScript: use outro nome (por exemplo, ':id').`)
    }
    if (!PARAM_TYPES.includes(field.type)) {
      throw new UsageError(`--endpoint '${text}': o campo '${param}' do Request é ${field.type}, e um parâmetro do caminho só pode ser string, number, int, boolean ou enum.`)
    }
    if (EXECUTE_LOCALS.has(param)) {
      throw new UsageError(`--endpoint '${text}': o parâmetro ':${param}' tem o nome de uma variável do execute gerado: use outro (por exemplo, ':id').`)
    }
    const clash = params.find((other, at) => at !== index && other.startsWith(param))
    if (clash !== undefined) {
      throw new UsageError(`--endpoint '${text}': o parâmetro ':${param}' é o começo de ':${clash}': use nomes que não se confundam.`)
    }
  }
  return { method: found, path: route, params }
}

/** O Output: campos (`token:string`), uma entidade com schema (`store`, `store[]`) ou o padrão. */
function readOutput(plan: ChangePlan, text: string | undefined): OutputSpec {
  if (text === undefined) return { kind: 'default' }
  if (text.includes(':')) {
    return { kind: 'fields', fields: parseFields(text, { option: '--output', reserved: true }) }
  }
  const match = /^(.+?)(\[\])?$/.exec(text.trim())
  const entity = match?.[1] ?? ''
  assertValidName(entity, 'a entidade do --output')
  const names = deriveNames(entity)
  const domain = { plural: names, singular: names }
  if (!plan.hasFile(path.join(plan.project.root, schemaFile(domain)))) {
    throw new UsageError(
      `--output '${text}': o schema da entidade '${entity}' não existe (${schemaFile(domain)}). Crie com prumo make:schema <domínio> --entity ${entity}, ou descreva os campos (--output "campo:tipo").`,
    )
  }
  return { kind: 'entity', entity, fields: readEntityFields(plan, domain), list: match?.[2] !== undefined }
}

/** O `z.object({ ... })` dos campos, um por linha. */
export function zodObject(fields: readonly Field[]): string {
  if (fields.length === 0) return 'z.object({})'
  return `z.object({\n${fields.map((field) => `  ${field.name}: ${zodOf(field)},`).join('\n')}\n})`
}

/** O schema zod do Response: o que o `--output` descreve ou, sem ele, `z.unknown()` (a API real pode devolver corpo). */
function outputZod(output: OutputSpec): string {
  switch (output.kind) {
    case 'fields':
      return zodObject(output.fields)
    case 'entity': {
      const schema = `${deriveNames(output.entity).camel}Schema`
      return output.list ? `z.array(${schema})` : schema
    }
    case 'default':
      return 'z.unknown()'
  }
}

/** Um Response de exemplo, no formato do schema (o que o mock responde). */
function outputSample(output: OutputSpec): Sample {
  switch (output.kind) {
    case 'fields':
      return sampleRecord(output.fields, 1)
    case 'entity': {
      const item = (n: number) => sampleRecord(output.fields, n, output.entity)
      return output.list ? [item(1), item(2)] : item(1)
    }
    case 'default':
      return {}
  }
}

/** Um objeto literal numa posição de expressão (o corpo de uma arrow) precisa de parênteses. */
const asExpression = (code: string) => (code.startsWith('{') ? `(${code})` : code)

/** Os blocos de `types/<ação>.ts` que variam: o import da entidade, o `ENDPOINT` e a chave de cache. */
export function typesVars(
  { domain, action }: UseCaseNames,
  endpoint: Endpoint | null,
  access: Access,
  output: OutputSpec,
): Record<string, string> {
  const key = `${action.camel}Key`
  return {
    'types.schemaImport':
      output.kind === 'entity' ? `import { ${deriveNames(output.entity).camel}Schema } from '@/schemas'\n` : '',
    'types.endpoint': endpoint
      ? `export const ENDPOINT = { method: '${endpoint.method}', path: '${endpoint.path}' } as const\n\n`
      : '',
    'types.inputType': `z.infer<typeof ${action.pascal}Request>`,
    'types.key':
      access === 'read'
        ? `\n\nexport function ${key}(input: ${action.pascal}Request) {\n  return ['${domain.kebab}', '${action.kebab}', input] as const\n}`
        : '',
  }
}

/**
 * Do `execute` com API: valida o Request e monta a chamada. O Request vai na query (leitura) ou no
 * corpo (escrita), menos os campos que são `:parâmetros` do caminho, que entram nele, codificados.
 * `usecase.request` é o que vem antes da chamada (vazio, ou linhas terminadas em quebra de linha).
 */
export function requestVars({ action }: UseCaseNames, endpoint: Endpoint, access: Access, input: readonly Field[]) {
  const slot = access === 'read' ? 'query' : 'body'
  const parse = `${action.pascal}Request.parse(input)`
  if (endpoint.params.length === 0) {
    return {
      'usecase.request': '',
      'usecase.call': `ENDPOINT.path, { method: ENDPOINT.method, ${slot}: ${parse} }`,
    }
  }
  const rest = input.some((field) => !endpoint.params.includes(field.name))
  const replaces = endpoint.params.map((param) => `.replace(':${param}', encodeURIComponent(${param}))`)
  const path =
    replaces.length === 1
      ? `ENDPOINT.path${replaces[0]}`
      : `ENDPOINT.path\n${replaces.map((replace) => `      ${replace}`).join('\n')}`
  return {
    'usecase.request': [
      `    const { ${endpoint.params.join(', ')}${rest ? `, ...${slot}` : ''} } = ${parse}`,
      `    const path = ${path}`,
      '',
    ].join('\n'),
    'usecase.call': `path, { method: ENDPOINT.method${rest ? `, ${slot}` : ''} }`,
  }
}

/** Do `execute` do `--local`: valida o Request, deixa a regra marcada e devolve o Response validado. */
function ruleVars({ action }: UseCaseNames, access: Access, sample: Sample): Record<string, string> {
  const parse = `${action.pascal}Request.parse(input)`
  const result = sampleCode(sample, '    ')
  const rule =
    access === 'read'
      ? `    ${parse}\n    // A regra do use case entra aqui.\n    const stored = this.#storage.getItem(STORAGE_KEY)\n    return ${action.pascal}Response.parse(stored === null ? ${result} : JSON.parse(stored))`
      : `    const parsed = ${parse}\n    // A regra do use case entra aqui.\n    this.#storage.setItem(STORAGE_KEY, JSON.stringify(parsed))\n    return ${action.pascal}Response.parse(${result})`
  return { 'usecase.rule': rule }
}

/** Recusa o use case que já existe e a chave que já é de outro use case (as chaves são únicas no app). */
export function assertUseCaseFree(project: Project, { domain, action }: UseCaseNames): void {
  const clash = listUseCases(project).find((existing) => existing.key === action.camel)
  if (clash?.domain === domain.kebab && clash.name === action.kebab) {
    throw new UsageError(`o use case '${domain.kebab}.${action.kebab}' já existe.`)
  }
  if (clash) {
    throw new UsageError(
      `a chave '${action.camel}' do registro já é do use case '${clash.domain}.${clash.name}': as chaves são únicas no app (o useUseCases() devolve todas num só objeto). Dê outro nome à ação.`,
    )
  }
}

/**
 * Acrescenta ao plano os `files` de um use case (e o índice do domínio, se falta) e o registra no
 * índice do domínio e no registro geral.
 */
export function addUseCase(
  plan: ChangePlan,
  names: UseCaseNames,
  vars: Record<string, string>,
  files: readonly UseCaseFile[],
  { local }: { local: boolean },
): void {
  const create = ({ template, to }: UseCaseFile) =>
    plan.createSource(path.join(plan.project.root, renderTemplate(to, vars)), renderTemplateFile(template, vars))
  const domainIndex = path.join(plan.project.root, renderTemplate(DOMAIN_INDEX_FILE.to, vars))
  if (!plan.has(domainIndex)) create(DOMAIN_INDEX_FILE)
  files.forEach(create)
  registerUseCase(plan, names, { local })
  registerUseCaseDomain(plan, names)
}

/**
 * Monta o plano de um use case: os arquivos de `src/use-cases/<domínio>/` (tipos, classe, rota de
 * mock e teste), o registro no índice do domínio (criado, se falta) e no registro geral
 * `src/use-cases/index.ts`. Com `local`, o use case
 * não chama a API: recebe o `storage`, e não tem `ENDPOINT` nem rota de mock. Nada vai para o
 * disco: quem chama mostra o `summary()` ou faz o `commit()`. Valida tudo antes de montar o plano;
 * todo erro de uso é um `UsageError` (saída 2).
 */
export function generateUseCase(project: Project, request: UseCaseRequest): UseCaseResult {
  const names = useCaseNames(request.name)
  const { domain, action } = names
  const local = request.local === true
  if (local && request.endpoint !== undefined) {
    throw new UsageError("um use case '--local' não chama a API: tire o '--endpoint'.")
  }
  const access = accessOf(action.kebab, request)
  const input: Field[] = request.input === undefined ? [] : parseFields(request.input, { option: '--input', reserved: true })
  const plan = new ChangePlan(project)
  const output = readOutput(plan, request.output)
  const endpoint = local
    ? null
    : parseEndpoint(request.endpoint ?? `${access === 'read' ? 'GET' : 'POST'} /${domain.kebab}/${action.kebab}`, input)
  if (endpoint?.method === 'GET' && access === 'write') {
    throw new UsageError("uma escrita não pode usar GET (o GET não leva corpo): use '--read' ou outro método no --endpoint.")
  }

  assertUseCaseFree(project, names)

  const sample = outputSample(output)
  const vars: Record<string, string> = {
    ...nameVars('domain', domain),
    ...nameVars('action', action),
    ...typesVars(names, endpoint, access, output),
    'types.input': zodObject(input),
    'types.output': outputZod(output),
    'test.input': sampleCode(sampleRecord(input, 1)),
    'mock.response': asExpression(sampleCode(sample, '  ')),
    ...(endpoint ? requestVars(names, endpoint, access, input) : ruleVars(names, access, sample)),
  }
  addUseCase(plan, names, vars, local ? LOCAL_USE_CASE_FILES : USE_CASE_FILES, { local })

  const warnings: string[] = []
  const types = `src/use-cases/${domain.kebab}/types/${action.kebab}.ts`
  if (request.input === undefined) {
    warnings.push(`sem --input, o Request é um objeto vazio: descreva os campos em ${types}.`)
  }
  if (request.output === undefined) {
    warnings.push(`sem --output, o Response é z.unknown(): descreva o que o use case devolve em ${types}.`)
  }
  return { plan, names, access, kind: local ? 'local' : access, endpoint, key: action.camel, warnings }
}
