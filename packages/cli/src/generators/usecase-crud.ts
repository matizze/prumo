import path from 'node:path'
import {
  domainFieldVars,
  readEntityFields,
  readEntityShape,
  type Field,
} from '../lib/fields/index.ts'
import { domainNames, useCaseNames, type DomainNames, type UseCaseNames } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import type { Project } from '../lib/project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../lib/templates.ts'
import { addErrorMessages, type ErrorText } from './error-messages.ts'
import {
  addUseCase,
  assertUseCaseFree,
  FAILED_TEXT,
  FOLDER,
  requestVars,
  typesVars,
  USE_CASE_FILES,
  type Access,
  type Endpoint,
  type UseCaseFile,
} from './usecase.ts'

/** As cinco operações do CRUD, na ordem em que o plano as lista. */
export const CRUD_OPERATIONS = ['list', 'get', 'create', 'update', 'remove'] as const

export type CrudOperation = (typeof CRUD_OPERATIONS)[number]

export interface CrudRequest {
  /** O nome do domínio, no plural e em kebab-case: `livros`. */
  name: string
  /** A entidade, no singular. Sem ela, sai do nome (tira o `s` final). */
  entity?: string | undefined
}

/** Um dos use cases gerados. */
export interface CrudUseCase {
  operation: CrudOperation
  names: UseCaseNames
  /** A chave no registro: `listLivros`. */
  key: string
  access: Access
  endpoint: Endpoint
}

export interface CrudResult {
  plan: ChangePlan
  names: DomainNames
  /** Os campos lidos do schema. */
  fields: Field[]
  useCases: CrudUseCase[]
  /** Avisos que não impedem o comando (o `errors.json` que falta). */
  warnings: string[]
}

const NOT_FOUND_TEXT: ErrorText = { 'pt-BR': 'Registro não encontrado.', en: 'Record not found.' }

/** Como cada operação se chama, se lê e se endereça (`:id` no caminho de um registro). */
const OPERATIONS: Record<
  CrudOperation,
  { method: Endpoint['method']; record: boolean; access: Access; plural: boolean }
> = {
  list: { method: 'GET', record: false, access: 'read', plural: true },
  get: { method: 'GET', record: true, access: 'read', plural: false },
  create: { method: 'POST', record: false, access: 'write', plural: false },
  update: { method: 'PATCH', record: true, access: 'write', plural: false },
  remove: { method: 'DELETE', record: true, access: 'write', plural: false },
}

/** O modelo e o destino de um arquivo de use case do CRUD, com marcadores. */
const crudFile = (template: string, to: string): UseCaseFile => ({ template: `usecase/crud/${template}`, to: `${FOLDER}/${to}` })

/** Os arquivos de um use case do CRUD: os tipos e a classe de um use case comum, e o mock e o teste do CRUD. */
export const CRUD_FILES: readonly UseCaseFile[] = [
  USE_CASE_FILES[0]!,
  USE_CASE_FILES[1]!,
  crudFile('mock.ts.tpl', '{{action.kebab}}.mock.ts'),
  crudFile('test.ts.tpl', '{{action.kebab}}.usecase.test.ts'),
]

/** A coleção do mock, criada com o primeiro use case do domínio. */
export const COLLECTION_FILE: UseCaseFile = crudFile('collection.mock.ts.tpl', 'collection.mock.ts')

/** Os casos de teste de cada operação, que entram no teste do use case dela. */
export const CASES_TEMPLATES: readonly string[] = CRUD_OPERATIONS.map((operation) => `usecase/crud/cases-${operation}.ts.tpl`)

/** O que muda de uma operação para outra nos tipos, na chamada, no mock e no teste. */
interface Pieces {
  /** O import do schema, depois do `zod`. */
  imports: string
  input: string
  /** O tipo do Input, quando não é o que o zod infere. */
  inputType?: string
  output: string
  /** O `execute`, quando não é o padrão de `requestVars`. */
  request?: string
  /** O import do mock: o schema que valida o corpo. */
  mockImport: string
  /** O que o handler da rota de mock lê da chamada. */
  params: string
  /** O que o handler responde, sobre a coleção. */
  body: string
  /** O Input do teste que vê o erro da API virar `<AÇÃO>_FAILED`. */
  failInput: string
}

/** Os campos que as rotas com `:id` pedem no Input. */
const ID_FIELD: Field = { name: 'id', type: 'string', optional: false }

/** O texto que cada operação tem de diferente, a partir dos nomes do domínio e do que o schema aceita. */
function piecesOf(
  operation: CrudOperation,
  { singular, plural }: DomainNames,
  sortKeys: readonly string[],
  vars: Record<string, string>,
): Pieces {
  const schema = `${singular.camel}Schema`
  const inputSchema = `${singular.camel}InputSchema`
  const listQuery = `${singular.pascal}ListQuery`
  const collection = `${plural.camel}Collection`
  const idObject = 'z.object({ id: z.string() })'
  const schemasImport = (...names: string[]) => `import { ${names.join(', ')} } from '@/schemas'\n`
  switch (operation) {
    case 'list':
      return {
        imports: `import { pageSchema } from '@matizze/prumo-core/data'\n${schemasImport(schema, `type ${listQuery}`)}`,
        input: `z.object({
  search: z.string().optional(),
  sort: z
    .object({
      key: z.enum([${sortKeys.map((key) => `'${key}'`).join(', ')}]),
      direction: z.enum(['asc', 'desc']),
    })
    .optional(),
  page: z.number().int().optional(),
  page_size: z.number().int().optional(),
}) satisfies z.ZodType<${listQuery}>`,
        inputType: listQuery,
        output: `pageSchema(${schema})`,
        request: `    const { sort, ...rest } = ${vars['action.pascal']}Input.parse(input)\n    const query = { ...rest, sort: sort && \`\${sort.key}:\${sort.direction}\` }`,
        mockImport: '',
        params: '{ query }',
        body: `${collection}.list(query)`,
        failInput: '{}',
      }
    case 'get':
      return {
        imports: schemasImport(schema),
        input: idObject,
        output: schema,
        mockImport: '',
        params: '{ params }',
        body: `${collection}.get(params.id)`,
        failInput: "{ id: '" + singular.kebab + "-1' }",
      }
    case 'create':
      return {
        imports: schemasImport(inputSchema, schema),
        input: inputSchema,
        output: schema,
        mockImport: schemasImport(inputSchema),
        params: '{ body }',
        body: `${collection}.create(${inputSchema}.parse(body))`,
        failInput: vars['test.newInput']!,
      }
    case 'update':
      return {
        imports: schemasImport(inputSchema, schema),
        input: `${inputSchema}.partial().extend({ id: z.string() })`,
        output: schema,
        mockImport: schemasImport(inputSchema),
        params: '{ params, body }',
        body: `${collection}.update(params.id, ${inputSchema}.partial().parse(body))`,
        failInput: "{ id: '" + singular.kebab + "-1' }",
      }
    case 'remove':
      return {
        imports: '',
        input: idObject,
        output: 'z.void()',
        mockImport: '',
        params: '{ params }',
        body: `${collection}.remove(params.id)`,
        failInput: "{ id: '" + singular.kebab + "-1' }",
      }
  }
}

/** O nome da ação de cada operação: `list-livros` (no plural) e `get-livro`, `create-livro`... (no singular). */
const actionOf = (operation: CrudOperation, { singular, plural }: DomainNames) =>
  `${operation}-${OPERATIONS[operation].plural ? plural.kebab : singular.kebab}`

/**
 * Monta o plano do CRUD de um domínio: os cinco use cases (`list-livros`, `get-livro`, `create-livro`,
 * `update-livro` e `remove-livro`, com endpoints REST) em `src/use-cases/<domínio>/`, a coleção do
 * mock que os cinco dividem (`collection.mock.ts`, com as fixtures lidas do schema), o registro e o
 * texto de `<ENTIDADE>_NOT_FOUND` e dos `_FAILED` nos `errors.json`. Os campos (busca, ordem, fixtures e
 * testes) saem do schema, como no `make:repository`. Nada vai para o disco; recusa, sem escrever, se
 * algum dos cinco já existe. Todo erro de uso é um `UsageError` (saída 2).
 */
export function generateCrudUseCases(project: Project, { name, entity }: CrudRequest): CrudResult {
  const domain = domainNames(name, entity)
  const plan = new ChangePlan(project)
  const fields = readEntityFields(plan, domain)
  const shape = readEntityShape(plan, domain, fields)
  const all = CRUD_OPERATIONS.map((operation) => ({
    operation,
    names: useCaseNames(`${domain.plural.kebab}.${actionOf(operation, domain)}`),
  }))
  for (const { names } of all) assertUseCaseFree(project, names)

  const base = {
    ...nameVars('plural', domain.plural),
    ...nameVars('singular', domain.singular),
    ...nameVars('domain', domain.plural),
    ...domainFieldVars(fields, domain.singular.kebab, shape),
  }
  // Os accessors de ordem vêm num recuo de 6 colunas, do mock do repositório; a coleção os quer em 4
  const sortFields = base['fields.sortAccessors'].replaceAll(/^ {2}/gm, '')
  const collectionVars = { ...base, 'fields.sortFields': sortFields }
  plan.createSource(
    path.join(project.root, renderTemplate(COLLECTION_FILE.to, collectionVars)),
    renderTemplateFile(COLLECTION_FILE.template, collectionVars),
  )

  const notFoundCode = `${base['singular.constant']}_NOT_FOUND`
  const keys = Object.fromEntries(all.map(({ operation, names }) => [`key.${operation}`, names.action.camel]))
  const useCases = all.map(({ operation, names }): CrudUseCase => {
    const { method, record, access } = OPERATIONS[operation]
    const endpoint: Endpoint = {
      method,
      path: `/${domain.plural.kebab}${record ? '/:id' : ''}`,
      params: record ? ['id'] : [],
    }
    const vars = { ...base, ...keys, ...nameVars('action', names.action) }
    const pieces = piecesOf(operation, domain, shape.sort, vars)
    const input: Field[] = record ? [ID_FIELD, ...(operation === 'update' ? fields : [])] : []
    const typed = typesVars(names, endpoint, access, { kind: 'default' })
    addUseCase(
      plan,
      names,
      {
        ...vars,
        ...typed,
        ...requestVars(names, endpoint, access, input),
        'types.schemaImport': pieces.imports,
        'types.input': pieces.input,
        'types.inputType': pieces.inputType ?? typed['types.inputType']!,
        'types.output': pieces.output,
        ...(pieces.request ? { 'usecase.request': pieces.request } : {}),
        'usecase.notFound': record
          ? `      if (error instanceof HttpError && error.status === 404) throw new UIError('${notFoundCode}', error.message)\n`
          : '',
        'mock.schemaImport': pieces.mockImport,
        'mock.params': pieces.params,
        'mock.body': pieces.body,
        'test.failInput': pieces.failInput,
        'test.cases': renderTemplateFile(CASES_TEMPLATES[CRUD_OPERATIONS.indexOf(operation)]!, vars),
      },
      CRUD_FILES,
      { local: false },
    )
    return { operation, names, key: names.action.camel, access, endpoint }
  })

  const warnings = addErrorMessages(plan, {
    [notFoundCode]: NOT_FOUND_TEXT,
    ...Object.fromEntries(
      useCases.map(({ names, access }) => [
        `${nameVars('action', names.action)['action.constant']}_FAILED`,
        FAILED_TEXT[access],
      ]),
    ),
  })
  return { plan, names: domain, fields, useCases, warnings }
}
