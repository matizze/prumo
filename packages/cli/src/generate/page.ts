import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  addRouteSnippet,
  assertValidName,
  ChangePlan,
  deriveNames,
  registerMessageNamespace,
  usableNames,
  type Names,
} from '../codemod/index.ts'
import { messageLanguages } from '../codemod/messages.ts'
import { UsageError } from '../errors.ts'
import type { Project } from '../project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../templates.ts'
import { domainIdSample, domainShapeOf, literal, type DomainShape } from './fields.ts'

/** Um arquivo da tela: o modelo e onde ele cai no projeto, os dois com marcadores. */
interface PageFile {
  /** O modelo, em `templates/`. */
  template: string
  /** O caminho no projeto, relativo à raiz. */
  to: string
}

const PAGE_DIR = 'src/pages/{{page.kebab}}'

/** Os arquivos de uma tela sem domínio: só o título. */
export const PAGE_FILES: readonly PageFile[] = [
  { template: 'page/index.tsx.tpl', to: `${PAGE_DIR}/index.tsx` },
  { template: 'page/model.ts.tpl', to: `${PAGE_DIR}/model.ts` },
  { template: 'page/view.tsx.tpl', to: `${PAGE_DIR}/view.tsx` },
  { template: 'page/index-test.tsx.tpl', to: `${PAGE_DIR}/index.test.tsx` },
]

/** Os arquivos de uma tela com `--domain`: o model lê a lista, e a view a mostra. */
export const PAGE_DOMAIN_FILES: readonly PageFile[] = [
  { template: 'page/index.tsx.tpl', to: `${PAGE_DIR}/index.tsx` },
  { template: 'page/model-domain.ts.tpl', to: `${PAGE_DIR}/model.ts` },
  { template: 'page/view-domain.tsx.tpl', to: `${PAGE_DIR}/view.tsx` },
  { template: 'page/index-domain-test.tsx.tpl', to: `${PAGE_DIR}/index.test.tsx` },
]

/** Os arquivos de uma tela cuja rota tem parâmetro: o model lê o parâmetro e a view o mostra. */
export const PAGE_PARAM_FILES: readonly PageFile[] = [
  { template: 'page/index.tsx.tpl', to: `${PAGE_DIR}/index.tsx` },
  { template: 'page/model-param.ts.tpl', to: `${PAGE_DIR}/model.ts` },
  { template: 'page/view-param.tsx.tpl', to: `${PAGE_DIR}/view.tsx` },
  { template: 'page/index-param-test.tsx.tpl', to: `${PAGE_DIR}/index.test.tsx` },
]

/** Os arquivos de uma tela de detalhe (`--domain` e rota com parâmetro): o model busca o registro. */
export const PAGE_DETAIL_FILES: readonly PageFile[] = [
  { template: 'page/index.tsx.tpl', to: `${PAGE_DIR}/index.tsx` },
  { template: 'page/model-detail.ts.tpl', to: `${PAGE_DIR}/model.ts` },
  { template: 'page/view-detail.tsx.tpl', to: `${PAGE_DIR}/view.tsx` },
  { template: 'page/index-detail-test.tsx.tpl', to: `${PAGE_DIR}/index.test.tsx` },
]

/** Os idiomas dos modelos de mensagens: o `pt-BR` e o `en`. */
export const MESSAGE_LANGUAGES = ['pt-BR', 'en'] as const

/** O modelo do JSON de mensagens de um idioma, com ou sem domínio. */
export function messagesTemplate(language: (typeof MESSAGE_LANGUAGES)[number], domain: boolean) {
  return `page/messages${domain ? '-domain' : ''}.${language}.json.tpl`
}

/**
 * Qual dos dois modelos de mensagens vale para um idioma do projeto: os `pt` (`pt-BR`, `pt-PT`)
 * usam o texto em português, e qualquer outro (`en`, `es`) o texto em inglês, que a pessoa traduz.
 */
export function messagesLanguageOf(language: string): (typeof MESSAGE_LANGUAGES)[number] {
  return language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

/** Onde mora o módulo `src/<módulo>`: `<módulo>.ts`, `<módulo>.tsx` ou a pasta com `index`. */
export function moduleFile(project: Project, module: string): string | undefined {
  return [`${module}.ts`, `${module}.tsx`, `${module}/index.ts`, `${module}/index.tsx`]
    .map((file) => path.join(project.src, file))
    .find((file) => existsSync(file))
}

/** Palavras que não servem de nome de variável: o parâmetro vira uma constante no model. */
const RESERVED_WORDS = new Set(
  'break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await async undefined'.split(
    ' ',
  ),
)

/** O caminho de uma rota já validado: o texto, o parâmetro (no máximo um) e um endereço de exemplo. */
export interface RoutePath {
  path: string
  /** O nome do parâmetro (`id` em `/livros/:id`), se a rota tem um. */
  param?: string
  /** O caminho com o parâmetro trocado pelo valor de exemplo. */
  example: (value: string) => string
}

/**
 * Valida o caminho de `--path`: começa com `/`, sem barra no fim nem `//`, com segmentos fixos
 * (letras, números, `-`, `_`, `.`, `~`) ou parâmetros `:nome` (um identificador). Recusa o que o
 * wouter aceita mas o gerador não sabe usar (`:id?`, `:id*`, `*`, expressões regulares) e mais de
 * um parâmetro: a tela gerada lê um só.
 */
export function parseRoutePath(route: string): RoutePath {
  const bad = (reason: string): never => {
    throw new UsageError(`o caminho '${route}' é inválido: ${reason}.`)
  }
  if (!route.startsWith('/')) bad('precisa começar com /')
  const segments = route === '/' ? [] : route.slice(1).split('/')
  if (route !== '/' && segments.includes('')) bad('não pode ter barra no fim nem //')
  const params: string[] = []
  for (const segment of segments) {
    if (segment.startsWith(':')) {
      const name = segment.slice(1)
      if (/[?*+(]/.test(name)) {
        bad(`o parâmetro '${segment}' usa um modificador do wouter (?, * ou +), que o gerador não trata: use :nome`)
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || RESERVED_WORDS.has(name)) {
        bad(`'${segment}' não é um parâmetro válido: use :nome, com letras, números e _ (por exemplo, :id)`)
      }
      params.push(name)
    } else if (!/^[A-Za-z0-9._~-]+$/.test(segment)) {
      bad(`o segmento '${segment}' só pode ter letras, números, -, _, . e ~ (ou ser um parâmetro :nome)`)
    }
  }
  if (params.length > 1) {
    bad(`tem ${params.length} parâmetros (${params.map((p) => `:${p}`).join(', ')}), e a tela gerada lê um só: gere com um e acrescente o outro à mão`)
  }
  const param = params[0]
  return {
    path: route,
    ...(param ? { param } : {}),
    example: (value) => route.replace(/:[^/]+/, value),
  }
}

/**
 * A entidade do domínio (`Livro`, `livro`), lida do hook `use<Entidade>Detail` de
 * `src/queries/<domínio>.ts` (ou, com `anyHook`, também dos de criar, editar e remover).
 */
function entityOf(
  project: Project,
  domain: Names,
  anyHook = false,
): { pascal: string; kebab: string } | undefined {
  const file = moduleFile(project, `queries/${domain.kebab}`)
  const source = file ? readFileSync(file, 'utf8') : ''
  const match =
    /\buse([A-Z][A-Za-z0-9]*)Detail\b/.exec(source) ??
    (anyHook ? /\buse(?:Create|Update|Remove)([A-Z][A-Za-z0-9]*)\b/.exec(source) : null)
  if (!match) return undefined
  const pascal = match[1]!
  return { pascal, kebab: pascal.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() }
}

/** O hook de detalhe do domínio (`useLivroDetail`) e o nome do registro (`livro`), lidos de `src/queries/<domínio>.ts`. */
function detailHookOf(project: Project, domain: Names): { hook: string; fixture: string } {
  const entity = entityOf(project, domain)
  if (!entity) {
    throw new UsageError(
      `o domínio '${domain.kebab}' não tem o hook use<Entidade>Detail em src/queries/${domain.kebab}.ts: a tela de detalhe (--domain com um caminho com parâmetro) busca o registro por ele.`,
    )
  }
  return { hook: `use${entity.pascal}Detail`, fixture: entity.kebab }
}

/** Lê o arquivo, ou `undefined` se não existe. */
function readIfExists(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

/**
 * O que a tela mostra do registro do domínio: o primeiro campo de texto do schema que o projeto tem
 * hoje (veja `domainShapeOf`), ou o `id`, com um aviso. Com `needSample` (a tela de detalhe, cujo
 * teste confere o texto), um campo sem valor nas fixtures também cai no `id`.
 */
function shapeOf(project: Project, domain: Names, needSample: boolean): DomainShape {
  const entity = entityOf(project, domain, true)
  const file = entity ? `src/schemas/entities/${entity.kebab}.ts` : 'src/schemas/entities/<entidade>.ts'
  const fixturesFile = `src/repositories/${domain.kebab}/fixtures.ts`
  const fixtures = readIfExists(path.join(project.root, fixturesFile))
  const shape = domainShapeOf(
    {
      file,
      source: entity ? readIfExists(path.join(project.root, file)) : undefined,
      camel: entity ? entity.pascal.charAt(0).toLowerCase() + entity.pascal.slice(1) : undefined,
    },
    fixtures,
  )
  if (!needSample || shape.field === 'id' || shape.sample !== undefined) return shape
  return {
    field: 'id',
    ...domainIdSample(fixtures),
    warning: `não achei o valor de '${shape.field}' no primeiro registro de ${fixturesFile}: a tela mostra o id do registro. Troque pelo campo certo na view (e no teste).`,
  }
}

export interface PageRequest {
  /** O nome da tela, em kebab-case: `clientes`. */
  name: string
  /** O domínio cuja lista a tela mostra (o nome dele, no plural), criado por `make:domain`. */
  domain?: string | undefined
  /**
   * A rota da tela (`--path`). Padrão: `/<nome>`. A tela inicial de um app novo usa `/`. Com um
   * parâmetro (`/livros/:id`), a tela o lê com o `useParams`; com `domain`, vira a tela de detalhe.
   */
  route?: string | undefined
}

export interface PageResult {
  plan: ChangePlan
  names: Names
  /** O domínio, se a tela tem um. */
  domain?: Names
  /** A rota nova no `src/App.tsx`: `/clientes`. */
  route: string
  /** Avisos que o comando mostra (por exemplo, a tela mostra o `id` por falta de campo de texto). */
  warnings: string[]
}

/** O `<Route>` da tela, como entra no `src/App.tsx`. */
function routeElement(names: Names, route: string): string {
  return `<Route path="${route}">\n  <${names.pascal}Page />\n</Route>`
}

/**
 * Confere que o domínio existe e traz o hook de lista que o model usa: `src/queries/<domínio>.ts`
 * com `use<Domínio>List`, o que o `make:domain` gera. Sem isso, a tela nasceria sem compilar.
 */
function assertDomain(project: Project, domain: Names): void {
  const hook = `use${domain.pascal}List`
  const file = moduleFile(project, `queries/${domain.kebab}`)
  if (!file) {
    throw new UsageError(
      `o domínio '${domain.kebab}' não existe: falta src/queries/${domain.kebab}.ts (crie-o com prumo make:domain ${domain.kebab}).`,
    )
  }
  if (!new RegExp(`\\b${hook}\\b`).test(readFileSync(file, 'utf8'))) {
    throw new UsageError(
      `o domínio '${domain.kebab}' não tem o hook ${hook} em ${path.relative(project.root, file)}: o model da tela lê a lista por ele.`,
    )
  }
}

/**
 * Monta o plano de uma tela nova: `index`, `model`, `view` e o teste a partir dos modelos, as
 * mensagens (`title` e, com domínio, os textos de carregando e de erro) em cada idioma do projeto,
 * o namespace nos índices de mensagens e a rota `/<nome>` no `src/App.tsx`. Com `domain`, o model lê
 * a lista do domínio e a view mostra o carregando, o erro e a lista. Nada vai para o disco: o
 * chamador mostra o `summary()` ou faz o `commit()`. Valida os nomes e confere o projeto antes de
 * montar qualquer coisa, e todo erro de uso é um `UsageError` (saída 2).
 */
export function generatePage(project: Project, { name, domain, route }: PageRequest): PageResult {
  const names = usableNames(name, 'o nome da tela')
  let domainNames: Names | undefined
  if (domain !== undefined) {
    assertValidName(domain, 'o nome do domínio')
    domainNames = deriveNames(domain)
  }
  if (existsSync(path.join(project.pages, names.kebab))) {
    throw new UsageError(
      `a tela '${names.kebab}' já existe: a pasta src/pages/${names.kebab} está no projeto.`,
    )
  }
  if (domainNames) assertDomain(project, domainNames)

  const pagePath = route ?? `/${names.kebab}`
  const routePath = parseRoutePath(pagePath)
  const detail =
    domainNames && routePath.param ? detailHookOf(project, domainNames) : undefined
  const shape = domainNames ? shapeOf(project, domainNames, detail !== undefined) : undefined
  const vars = {
    ...nameVars('page', names),
    ...(domainNames ? nameVars('domain', domainNames) : {}),
    ...(shape
      ? {
          'field.name': shape.field,
          'field.sample': literal(shape.sample ?? `${detail?.fixture ?? 'registro'}-1`),
        }
      : {}),
    'route.path': pagePath,
    ...(routePath.param
      ? {
          'param.name': routePath.param,
          'param.example': 'exemplo',
          'route.example': routePath.example(detail ? `${detail.fixture}-1` : 'exemplo'),
          ...(detail ? { 'detail.hook': detail.hook } : {}),
        }
      : {}),
  }
  const files = detail
    ? PAGE_DETAIL_FILES
    : routePath.param
      ? PAGE_PARAM_FILES
      : domainNames
        ? PAGE_DOMAIN_FILES
        : PAGE_FILES
  const plan = new ChangePlan(project)
  for (const { template, to } of files) {
    plan.createSource(
      path.join(project.root, renderTemplate(to, vars)),
      renderTemplateFile(template, vars),
    )
  }
  for (const language of messageLanguages(project)) {
    const template = messagesTemplate(messagesLanguageOf(language), domainNames !== undefined)
    plan.createText(
      path.join(project.messages, language, `${names.kebab}.json`),
      renderTemplateFile(template, vars),
    )
  }

  registerMessageNamespace(plan, names.kebab, names.camel)
  addRouteSnippet(plan, {
    component: `${names.pascal}Page`,
    importPath: `@/pages/${names.kebab}`,
    path: pagePath,
    element: routeElement(names, pagePath),
  })
  return {
    plan,
    names,
    route: pagePath,
    warnings: shape?.warning ? [shape.warning] : [],
    ...(domainNames ? { domain: domainNames } : {}),
  }
}
