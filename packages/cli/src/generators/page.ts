import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { listPages, pageOf } from '@matizze/prumo-rules/check'
import { addRouteSnippet, messageLanguages, registerMessageNamespace } from '../codemods/index.ts'
import { UsageError } from '../errors.ts'
import { contractEntity } from '../lib/contract.ts'
import { domainIdSample, domainShapeOf, literal, type DomainShape } from '../lib/fields/index.ts'
import { assertValidName, deriveNames, pageNames, RESERVED_WORDS, type Names, type PageNames } from '../lib/names.ts'
import { displayPath } from '../lib/paths.ts'
import { ChangePlan } from '../lib/plan.ts'
import type { Project } from '../lib/project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../lib/templates.ts'

/** Um arquivo da tela: o modelo (em `templates/`) e onde ele cai no projeto, os dois com marcadores. */
interface PageFile {
  template: string
  to: string
}

const PAGE_DIR = 'src/pages/{{page.path}}'

/** Os arquivos de uma tela só com o título. */
export const PAGE_FILES: readonly PageFile[] = [
  { template: 'page/index.tsx.tpl', to: `${PAGE_DIR}/index.tsx` },
  { template: 'page/model.ts.tpl', to: `${PAGE_DIR}/model.ts` },
  { template: 'page/view.tsx.tpl', to: `${PAGE_DIR}/view.tsx` },
  { template: 'page/index-test.tsx.tpl', to: `${PAGE_DIR}/index.test.tsx` },
]

/** Os arquivos de uma tela com `--query`: o model lê a lista, e a view a mostra. */
export const PAGE_LIST_FILES: readonly PageFile[] = [
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

/** Os arquivos de uma tela de detalhe (`--query` e rota com parâmetro): o model busca o registro. */
export const PAGE_DETAIL_FILES: readonly PageFile[] = [
  { template: 'page/index.tsx.tpl', to: `${PAGE_DIR}/index.tsx` },
  { template: 'page/model-detail.ts.tpl', to: `${PAGE_DIR}/model.ts` },
  { template: 'page/view-detail.tsx.tpl', to: `${PAGE_DIR}/view.tsx` },
  { template: 'page/index-detail-test.tsx.tpl', to: `${PAGE_DIR}/index.test.tsx` },
]

/** Os messageLangs dos modelos de mensagens: o `pt-BR` e o `en`. */
export const MESSAGE_LANGUAGES = ['pt-BR', 'en'] as const

/** O modelo do JSON de mensagens de um idioma, com ou sem `--query` (os textos de carregando e de erro). */
export function messagesTemplate(language: (typeof MESSAGE_LANGUAGES)[number], withQuery: boolean) {
  return `page/messages${withQuery ? '-domain' : ''}.${language}.json.tpl`
}

/**
 * Qual dos dois modelos de mensagens vale para um idioma do projeto: os `pt` (`pt-BR`, `pt-PT`)
 * usam o texto em português, e qualquer outro (`en`, `es`) o texto em inglês, que a pessoa traduz.
 */
export function messagesLanguageOf(language: string): (typeof MESSAGE_LANGUAGES)[number] {
  return language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

/** Os nomes que os modelos de tela declaram ou importam: o parâmetro (uma constante do model) não pode repeti-los. */
const MODEL_NAMES = new Set(['t', 'detail', 'useParams', 'useTranslations'])

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
        bad(
          `o parâmetro '${segment}' usa um modificador do wouter (?, * ou +), que o gerador não trata: use :nome`,
        )
      }
      if (MODEL_NAMES.has(name)) {
        bad(
          `o parâmetro '${segment}' tem o nome de uma variável do model gerado (${[...MODEL_NAMES].join(', ')}): use outro, como :id`,
        )
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || RESERVED_WORDS.has(name)) {
        bad(
          `'${segment}' não é um parâmetro válido: use :nome, com letras, números e _ (por exemplo, :id)`,
        )
      }
      params.push(name)
    } else if (!/^[A-Za-z0-9._~-]+$/.test(segment)) {
      bad(
        `o segmento '${segment}' só pode ter letras, números, -, _, . e ~ (ou ser um parâmetro :nome)`,
      )
    }
  }
  if (params.length > 1) {
    bad(
      `tem ${params.length} parâmetros (${params.map((p) => `:${p}`).join(', ')}), e a tela gerada lê um só: gere com um e acrescente o outro à mão`,
    )
  }
  const param = params[0]
  return {
    path: route,
    ...(param ? { param } : {}),
    example: (value) => route.replace(/:[^/]+/, value),
  }
}

export interface PageRequest {
  /** O nome da tela, em kebab-case: `clientes`. Em subpasta, `auth.login` ou `auth/login`. */
  name: string
  /** O domínio cuja query a tela usa (o nome dele, no plural), criada por `make:query`. */
  query?: string | undefined
  /**
   * A rota da tela (`--path`). Padrão: `/<nome>`. A tela inicial de um app novo usa `/`. Com um
   * parâmetro (`/livros/:id`), a tela o lê com o `useParams`; com `query`, vira a tela de detalhe.
   */
  route?: string | undefined
}

export interface PageOptions {
  /** O plano onde acrescentar a tela. Padrão: um plano novo sobre o projeto. */
  plan?: ChangePlan
  /** Os messageLangs das mensagens. Padrão: os de `src/messages` do projeto, em disco. */
  languages?: readonly string[]
}

export interface PageResult {
  plan: ChangePlan
  names: PageNames
  /** O domínio da query, se a tela tem uma. */
  query?: Names
  /** A rota nova no `src/App.tsx`: `/clientes`. */
  route: string
  /** Avisos que o comando mostra (por exemplo, a tela mostra o `id` por falta de campo de texto). */
  warnings: string[]
}

/**
 * Recusa o nome que não pode virar tela: a pasta já é tela, está dentro de uma tela, já agrupa
 * telas, ou dá as mesmas mensagens e o mesmo componente de outra tela (`auth/login` e `auth-login`).
 */
function assertPageFree(project: Project, names: PageNames): void {
  const owner = pageOf(project.pages, names.path)
  if (owner === names.path) {
    throw new UsageError(
      `a tela '${names.path}' já existe: a pasta src/pages/${names.path} está no projeto.`,
    )
  }
  if (owner) {
    throw new UsageError(
      `'${names.path}' ficaria dentro da tela '${owner}' (src/pages/${owner} tem index.tsx): uma tela não contém outra; use outro nome ou mova a tela '${owner}' para um grupo.`,
    )
  }
  const pages = listPages(project.pages)
  const inside = pages.find((page) => page.startsWith(`${names.path}/`))
  if (inside) {
    throw new UsageError(
      `'${names.path}' já agrupa telas (como '${inside}'): a pasta src/pages/${names.path} não pode virar tela.`,
    )
  }
  const twin = pages.find((page) => page.replaceAll('/', '-') === names.kebab)
  if (twin) {
    throw new UsageError(
      `a tela '${names.path}' conflita com a tela '${twin}': as duas gerariam ${names.kebab}.json e ${names.pascal}Page. Escolha outro nome.`,
    )
  }
  if (existsSync(path.join(project.pages, names.path))) {
    throw new UsageError(
      `a tela '${names.path}' já existe: a pasta src/pages/${names.path} está no projeto.`,
    )
  }
}

/** O `<Route>` da tela, como entra no `src/App.tsx`. */
function routeElement(names: Names, route: string): string {
  return `<Route path="${route}">\n  <${names.pascal}Page />\n</Route>`
}

/** Lê o arquivo, ou `undefined` se não existe. */
function readIfExists(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

/** O `src/queries/<domínio>.ts` (ou `.tsx`, ou a pasta com `index`), se existe. */
function queryFileOf(project: Project, kebab: string): string | undefined {
  return [`${kebab}.ts`, `${kebab}.tsx`, `${kebab}/index.ts`, `${kebab}/index.tsx`]
    .map((file) => path.join(project.src, 'queries', file))
    .find((file) => existsSync(file))
}

/** `Livro` vira `livro`: o nome do schema, que é um identificador (o kebab da entidade não se refaz dele). */
function camelOf(pascal: string): string {
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/**
 * O arquivo do schema da entidade, relativo à raiz: o de `src/schemas/entities/` que exporta o
 * `<camel>Schema`. Não refaz o nome do arquivo a partir do PascalCase (`Fase2` pode ser `fase-2`).
 */
function schemaFileOf(project: Project, entity: string): string | undefined {
  const dir = path.join(project.src, 'schemas', 'entities')
  if (!existsSync(dir)) return undefined
  const declaration = new RegExp(`\\bexport\\s+const\\s+${camelOf(entity)}Schema\\b`)
  const found = readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .find((file) => declaration.test(readFileSync(path.join(dir, file), 'utf8')))
  return found ? `src/schemas/entities/${found}` : undefined
}

/**
 * A entidade do domínio (`Livro`), lida do contrato do repositório (a lista é `Page<LivroSchema>`;
 * sem ela, o primeiro `<X>Schema`) e, se o contrato não existe, do hook `use<Entidade>Detail` da
 * query. `undefined` se nenhum dos dois diz.
 */
function entityOf(project: Project, domain: Names, queryText: string): string | undefined {
  const contract = readIfExists(
    path.join(project.src, 'repositories', domain.kebab, 'repository.contract.ts'),
  )
  const fromContract = contract ? contractEntity(contract) : undefined
  return fromContract ?? /\buse([A-Z][A-Za-z0-9]*)Detail\b/.exec(queryText)?.[1]
}

/** O que a tela usa da query: a entidade e o hook de detalhe, conferidos no arquivo da query. */
function queryOf(
  project: Project,
  domain: Names,
  detail: boolean,
): { entity: string | undefined } {
  const file = queryFileOf(project, domain.kebab)
  if (!file) {
    throw new UsageError(
      `a query '${domain.kebab}' não existe: falta src/queries/${domain.kebab}.ts; rode prumo make:query ${domain.kebab}.`,
    )
  }
  const text = readFileSync(file, 'utf8')
  const list = `use${domain.pascal}List`
  if (!new RegExp(`\\b${list}\\b`).test(text)) {
    throw new UsageError(
      `a query '${domain.kebab}' não tem o hook ${list} em ${displayPath(project.root, file)}: o model da tela lê a lista por ele; rode prumo make:query ${domain.kebab}.`,
    )
  }
  const entity = entityOf(project, domain, text)
  if (detail) {
    const hook = entity ? `use${entity}Detail` : undefined
    if (!entity || !new RegExp(`\\b${hook}\\b`).test(text)) {
      throw new UsageError(
        `a query '${domain.kebab}' não tem o hook use<Entidade>Detail em ${displayPath(project.root, file)}: a tela de detalhe (--query com um caminho com parâmetro) busca o registro por ele.`,
      )
    }
  }
  return { entity }
}

/**
 * O que a tela mostra do registro: o primeiro campo de texto do schema que o projeto tem hoje
 * (lido de um jeito tolerante, veja `domainShapeOf`), ou o `id`, com um aviso. Com `needSample` (a
 * tela de detalhe, cujo teste confere o texto), um campo sem valor nas fixtures também cai no `id`.
 */
function shapeOf(
  project: Project,
  domain: Names,
  entity: string | undefined,
  needSample: boolean,
): DomainShape {
  const found = entity ? schemaFileOf(project, entity) : undefined
  const file = found ?? 'src/schemas/entities/<entidade>.ts'
  const fixturesFile = `src/repositories/${domain.kebab}/fixtures.ts`
  const fixtures = readIfExists(path.join(project.root, fixturesFile))
  const shape = domainShapeOf(
    {
      file,
      source: found ? readIfExists(path.join(project.root, found)) : undefined,
      camel: entity ? camelOf(entity) : undefined,
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

/**
 * Monta o plano de uma tela nova: `index`, `model`, `view` e o teste a partir dos modelos, as
 * mensagens (`title` e, com `--query`, os textos de carregando e de erro) em cada idioma, o
 * namespace nos índices de mensagens e a rota no `src/App.tsx`. São quatro variações: só o título;
 * com `query`, a lista; com parâmetro na rota, a tela que o lê; com os dois, o detalhe. Nada vai
 * para o disco: quem chama mostra o `summary()` ou faz o `commit()`. Valida os nomes, a query e a
 * rota antes de montar qualquer coisa; todo erro de uso é um `UsageError` (saída 2).
 */
export function generatePage(
  project: Project,
  { name, query, route }: PageRequest,
  { plan = new ChangePlan(project), languages }: PageOptions = {},
): PageResult {
  const names = pageNames(name)
  let domain: Names | undefined
  if (query !== undefined) {
    assertValidName(query, 'o nome do domínio da query')
    domain = deriveNames(query)
  }
  assertPageFree(project, names)
  const pagePath = route ?? `/${names.path}`
  const routePath = parseRoutePath(pagePath)
  const detailPage = domain !== undefined && routePath.param !== undefined
  const used = domain ? queryOf(project, domain, detailPage) : undefined
  const shape = domain ? shapeOf(project, domain, used?.entity, detailPage) : undefined
  // O id do primeiro registro das fixtures: o teste de detalhe abre a rota com ele
  const firstId = domain
    ? (domainIdSample(readIfExists(path.join(project.src, 'repositories', domain.kebab, 'fixtures.ts')))
        .sample ?? 'registro-1')
    : 'exemplo'
  if (detailPage && routePath.param === `use${used?.entity}Detail`) {
    throw new UsageError(
      `o parâmetro ':${routePath.param}' tem o nome do hook de detalhe que o model gerado chama: use outro, como :id.`,
    )
  }
  const messageLangs = languages ?? messageLanguages(project)

  const vars = {
    ...nameVars('page', names),
    'page.path': names.path,
    ...(domain ? nameVars('domain', domain) : {}),
    ...(shape
      ? {
          'field.name': shape.field,
          'field.sample': literal(shape.sample ?? firstId),
        }
      : {}),
    'route.path': pagePath,
    ...(routePath.param
      ? {
          'param.name': routePath.param,
          'param.example': 'exemplo',
          'route.example': routePath.example(detailPage ? firstId : 'exemplo'),
          ...(detailPage ? { 'detail.hook': `use${used?.entity}Detail` } : {}),
        }
      : {}),
  }
  const files = detailPage
    ? PAGE_DETAIL_FILES
    : routePath.param
      ? PAGE_PARAM_FILES
      : domain
        ? PAGE_LIST_FILES
        : PAGE_FILES
  for (const { template, to } of files) {
    plan.createSource(
      path.join(project.root, renderTemplate(to, vars)),
      renderTemplateFile(template, vars),
    )
  }
  for (const language of messageLangs) {
    plan.createText(
      path.join(project.messages, language, `${names.kebab}.json`),
      renderTemplateFile(messagesTemplate(messagesLanguageOf(language), domain !== undefined), vars),
    )
  }

  registerMessageNamespace(plan, names.kebab, names.camel, messageLangs)
  addRouteSnippet(plan, {
    component: `${names.pascal}Page`,
    importPath: `@/pages/${names.path}`,
    path: pagePath,
    element: routeElement(names, pagePath),
  })
  return {
    plan,
    names,
    route: pagePath,
    warnings: shape?.warning ? [shape.warning] : [],
    ...(domain ? { query: domain } : {}),
  }
}
