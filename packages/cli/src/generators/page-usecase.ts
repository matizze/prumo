import path from 'node:path'
import { UsageError } from '../errors.ts'
import { readIfExists, shapeOf } from '../lib/entity.ts'
import {
  camelToSentence,
  domainIdSample,
  enumValues,
  literal,
  sampleValue,
  type Field,
} from '../lib/fields/index.ts'
import { nameVars } from '../lib/templates.ts'
import type { ChangePlan } from '../lib/plan.ts'
import { readUseCase, type UseCaseModel } from '../lib/use-case-model.ts'
import type { PageFile, RoutePath } from './page.ts'

/** A tela de um use case: lista, detalhe ou formulário. */
export type UseCasePageKind = 'list' | 'detail' | 'form'

/** O que a tela de um use case muda na tela gerada: os arquivos, os marcadores dos modelos e os avisos. */
export interface UseCasePage {
  kind: UseCasePageKind
  model: UseCaseModel
  files: readonly PageFile[]
  /** O id do primeiro registro dos dados de exemplo: o teste de detalhe abre a rota com ele. */
  firstId: string
  vars: Record<string, string>
  warnings: string[]
}

const PAGE_DIR = 'src/pages/{{page.path}}'

const pageFiles = (model: string, view: string, test: string): readonly PageFile[] => [
  { template: 'page/index.tsx.tpl', to: `${PAGE_DIR}/index.tsx` },
  { template: `page/usecase/${model}`, to: `${PAGE_DIR}/model.ts` },
  { template: `page/usecase/${view}`, to: `${PAGE_DIR}/view.tsx` },
  { template: `page/usecase/${test}`, to: `${PAGE_DIR}/index.test.tsx` },
]

/** Os arquivos de cada tela de use case. */
export const USE_CASE_PAGE_FILES: Record<UseCasePageKind, readonly PageFile[]> = {
  list: pageFiles('model-list.ts.tpl', 'view-list.tsx.tpl', 'test-list.tsx.tpl'),
  detail: pageFiles('model-detail.ts.tpl', 'view-detail.tsx.tpl', 'test-detail.tsx.tpl'),
  form: pageFiles('model-form.ts.tpl', 'view-form.tsx.tpl', 'test-form.tsx.tpl'),
}

/** O que o `<input>` de um campo é: o tipo do HTML, que o nome do campo refina (`email`, `password`). */
function controlType({ name, type }: Field): string {
  if (type === 'string' && (name === 'email' || name === 'password')) return name
  return { string: 'text', number: 'number', int: 'number', boolean: 'checkbox', date: 'date', datetime: 'datetime-local', enum: 'text' }[type]
}

/** De onde o model tira o valor do campo no `FormData`, no formato do Input. */
function readExpression(field: Field, input: string): string {
  const raw = `form.get('${field.name}')`
  const value = {
    string: `String(${raw})`,
    number: `Number(${raw})`,
    int: `Number(${raw})`,
    enum: `String(${raw}) as ${input}['${field.name}']`,
    date: `String(${raw})`,
    datetime: `new Date(String(${raw})).toISOString()`,
    boolean: `form.has('${field.name}')`,
  }[field.type]
  return field.optional && field.type !== 'boolean' ? `${raw} ? ${value} : undefined` : value
}

/** O `<div>` do campo na view: o rótulo e o controle. */
function viewField(field: Field): string {
  const { name, type, optional } = field
  const required = optional || type === 'boolean' ? '' : ' required'
  const control =
    type === 'enum'
      ? [
          `<select id="${name}" name="${name}"${required}>`,
          ...(optional ? ['  <option value="" />'] : []),
          ...enumValues(field).map((value) => `  <option value="${value}">${value}</option>`),
          '</select>',
        ]
      : [`<input id="${name}" name="${name}" type="${controlType(field)}"${type === 'number' ? ' step="any"' : ''}${required} />`]
  const lines = ['<div>', `  <label htmlFor="${name}">{m.fields.${name}}</label>`, ...control.map((line) => `  ${line}`), '</div>']
  return lines.map((line) => `        ${line}\n`).join('')
}

/** O valor com que o teste preenche o campo (o que um `<input>` daquele tipo aceita). */
function testValue(field: Field): string {
  if (field.name === 'email') return 'ana@example.com'
  if (field.name === 'password') return 'senha-1234'
  const value = sampleValue(field, 1)
  return field.type === 'datetime' ? String(value).slice(0, 16) : String(value)
}

/** A linha do teste que preenche o campo. */
function testLine(field: Field): string {
  const control = `screen.getByLabelText(${literal(camelToSentence(field.name))})`
  return field.type === 'boolean'
    ? `  fireEvent.click(${control})\n`
    : `  fireEvent.change(${control}, { target: { value: ${literal(testValue(field))} } })\n`
}

/** Um objeto numa linha por entrada, com o recuo dado; `{}` sem entradas. */
function block(entries: readonly string[], indent: string, trailingComma = true): string {
  const comma = trailingComma ? ',' : ''
  return entries.length === 0 ? '{}' : `{\n${entries.map((entry) => `${indent}  ${entry}`).join(',\n')}${comma}\n${indent}}`
}

/** Os marcadores do formulário: a leitura do `FormData`, os rótulos, os campos da view, o teste e as mensagens. */
function formVars(model: UseCaseModel): Record<string, string> {
  const input = model.fields()
  const type = `${model.names.action.pascal}Input`
  const labels = input.map((field) => [field.name, camelToSentence(field.name)] as const)
  return {
    'form.inputOf':
      input.length === 0
        ? ''
        : `\n/** Lê os campos do formulário, no formato do Input do use case. */\nfunction inputOf(form: FormData): ${type} {\n  return ${block(input.map((field) => `${field.name}: ${readExpression(field, type)}`), '  ')}\n}\n`,
    // O formulário volta ao começo depois de criar; o `form` se guarda antes, porque o `currentTarget` do evento não vale depois do envio
    'form.submit':
      input.length === 0
        ? 'mutation.mutate({})'
        : "const form = event.currentTarget\n      mutation.mutate(inputOf(new FormData(form)), { onSuccess: () => form.reset() })",
    'form.labels': block(labels.map(([name]) => `${name}: t('fields.${name}')`), '    '),
    'form.fields': input.map(viewField).join(''),
    'form.test': input.map(testLine).join(''),
    'form.messages': block(labels.map(([name, label]) => `"${name}": "${label}"`), '  ', false),
  }
}

/**
 * Prepara a tela de um use case. O use case que lê e devolve uma lista (um array ou uma `Page` de uma
 * entidade) dá a lista; o que lê um registro por um `:parâmetro` do endereço, com o mesmo parâmetro no
 * `--path`, dá o detalhe; o que escreve dá o formulário com os campos do Input. Os outros casos são
 * erro de uso, com o que mudar.
 */
export function useCasePage(plan: ChangePlan, reference: string, route: RoutePath): UseCasePage {
  const model = readUseCase(plan, reference)
  const { names, access, params, output } = model
  const { project } = plan
  const where = `o use case '${names.domain.kebab}.${names.action.kebab}'`
  const { required } = model

  let kind: UseCasePageKind
  if (access === 'write') {
    if (route.param) {
      throw new UsageError(`${where} escreve, e a tela dele é um formulário, que não lê parâmetro da rota: tire o ':${route.param}' do --path.`)
    }
    kind = 'form'
  } else if (params.length > 0) {
    if (!route.param) {
      throw new UsageError(`${where} lê um registro por ':${params.join(', :')}' (${model.types}): passe o --path com o parâmetro, como --path /${names.domain.kebab}/:${params[0]}.`)
    }
    if (!params.includes(route.param)) {
      throw new UsageError(`o parâmetro ':${route.param}' do --path não é um dos do endereço de ${where} (':${params.join(', :')}'): use o mesmo nome.`)
    }
    const others = required.filter((name) => name !== route.param)
    if (others.length > 0) {
      throw new UsageError(`${where} pede também ${others.join(', ')} no Input, e a tela de detalhe só tem o ':${route.param}' da rota: deixe ${others.length > 1 ? 'esses campos opcionais' : 'esse campo opcional'} no Input.`)
    }
    if (output.kind !== 'item') {
      throw new UsageError(`a tela de detalhe precisa que o Output de ${where} seja uma entidade (<entidade>Schema): ajuste o Output em ${model.types}.`)
    }
    kind = 'detail'
  } else {
    if (route.param) {
      throw new UsageError(`o endereço de ${where} não tem parâmetro: tire o ':${route.param}' do --path (ou use um use case que leia um registro por ':id').`)
    }
    if (output.kind !== 'list') {
      throw new UsageError(`a tela de lista precisa que o Output de ${where} seja uma lista de entidade (z.array(<entidade>Schema) ou pageSchema(<entidade>Schema)): ajuste o Output em ${model.types} (com --output <entidade>[], na criação).`)
    }
    if (required.length > 0) {
      throw new UsageError(`${where} pede ${required.join(', ')} no Input, e a tela de lista chama o use case sem entrada: deixe ${required.length > 1 ? 'esses campos opcionais' : 'esse campo opcional'} no Input.`)
    }
    kind = 'list'
  }

  const vars: Record<string, string> = {
    ...nameVars('uc', names.action),
    'uc.domain': names.domain.kebab,
    'uc.key': names.action.camel,
    'uc.input': `${names.action.pascal}Input`,
    'uc.keyFn': `${names.action.camel}Key`,
  }
  const warnings: string[] = []
  if (kind === 'form') return { kind, model, files: USE_CASE_PAGE_FILES.form, firstId: 'exemplo', vars: { ...vars, ...formVars(model) }, warnings }

  // O que a tela mostra do registro, lido do schema e dos dados de exemplo do mock
  const folder = path.join('src', 'use-cases', names.domain.kebab)
  const collection = path.join(folder, 'collection.mock.ts')
  const mock = readIfExists(path.join(project.root, collection)) === undefined ? path.join(folder, `${names.action.kebab}.mock.ts`) : collection
  const fixtures = { file: mock, text: readIfExists(path.join(project.root, mock)) }
  const shape = shapeOf(project, output.entity, fixtures, kind === 'detail')
  if (shape.warning) warnings.push(shape.warning)
  const firstId = domainIdSample(fixtures.text).sample ?? 'registro-1'
  return {
    kind,
    model,
    files: USE_CASE_PAGE_FILES[kind],
    firstId,
    vars: {
      ...vars,
      'field.name': shape.field,
      'field.sample': literal(shape.sample ?? firstId),
      'list.items': output.page ? 'list.data?.items ?? []' : 'list.data ?? []',
    },
    warnings,
  }
}
