import { existsSync, readdirSync, readFileSync, type Dirent } from 'node:fs'
import path from 'node:path'
import { listPages as pagesIn } from '@matizze/prumo-rules/check'
import { Node, SyntaxKind, type SourceFile } from 'ts-morph'
import {
  isRouteElement,
  isWildcardPath,
  pathLiteral,
  usesIdentifier,
  type RouteElement,
} from './route-elements.ts'
import { contractEntity } from './contract.ts'
import { readEntityFields, type FieldType } from './fields/index.ts'
import { deriveNames, pascalCase, type DomainNames } from './names.ts'
import { ChangePlan } from './plan.ts'
import { displayPath } from './paths.ts'
import type { Project } from './project.ts'

/** Um campo de um schema, como o leitor do Prumo o reconhece. */
export interface ListedField {
  name: string
  type: FieldType
  /** Os valores do `enum`, só no tipo `enum`. */
  values?: string[]
  optional: boolean
}

/** Um schema de `src/schemas/entities/`. */
export interface ListedSchema {
  /** A entidade, em PascalCase: `Livro`. */
  entity: string
  /** O arquivo, relativo à raiz: `src/schemas/entities/livro.ts`. */
  file: string
  /** Os campos que o leitor reconhece (fora `id` e `createdAt`); `null` se o schema foi editado à mão e o leitor o recusa. */
  fields: ListedField[] | null
  /** Por que o leitor recusou o schema (curto); `null` quando ele foi lido. */
  problem: string | null
}

export type ListedSource = 'mock' | 'http' | 'storage'

/** Um repositório de `src/repositories/`. */
export interface ListedRepository {
  /** O domínio: o nome da pasta, `livros`. */
  domain: string
  /** A entidade do contrato, em PascalCase; `null` se não há contrato ou ele não diz. */
  entity: string | null
  /** As fontes que existem (o arquivo e a linha na fábrica), na ordem `mock`, `http`, `storage`. */
  sources: ListedSource[]
}

/** As queries de um domínio, de `src/queries/`. */
export interface ListedQuery {
  domain: string
  /** O arquivo, relativo à raiz. */
  file: string
  /** A entidade (do contrato do repositório ou do hook de detalhe); `null` se nenhum diz. */
  entity: string | null
  /** Os hooks (`use...`) que o arquivo exporta, na ordem do arquivo. */
  hooks: string[]
}

export type RouteKind = 'literal' | 'catchAll' | 'expression'

export type PageVariation = 'title' | 'list' | 'param' | 'detail'

/** Uma tela de `src/pages/`. */
export interface ListedPage {
  /** O nome da tela: a pasta a partir de `src/pages`, com barra nas subpastas (`auth/login`). */
  name: string
  /**
   * A rota do `src/App.tsx` que mostra a tela: o caminho (composto com os `<Route nest>` de fora),
   * `*` para a curinga (sem `path` ou só com curinga) ou o texto da expressão de um `path={...}`
   * que não é literal. `null` só quando nenhuma `<Route>` usa a tela.
   */
  route: string | null
  /** `literal`, `catchAll` ou `expression`; `null` quando `route` é `null`. */
  routeKind: RouteKind | null
  /** O caminho de fora (`<Route nest>`) não é literal e não deu para compor: `route` é só o da `<Route>` de dentro. */
  routePartial: boolean
  /** `title` (só o título), `list` (com query), `param` (rota com parâmetro) ou `detail` (os dois). */
  variation: PageVariation
  /** O domínio da query que a tela usa; `null` se não usa. */
  query: string | null
}

/** O que o projeto tem, lido dos arquivos. É o que o `prumo list --json` escreve. */
export interface ProjectListing {
  schemas: ListedSchema[]
  repositories: ListedRepository[]
  queries: ListedQuery[]
  pages: ListedPage[]
  /** Os idiomas de `src/messages`. */
  languages: string[]
}

function entries(dir: string): Dirent[] {
  if (!existsSync(dir)) return []
  // Comparação fixa: a ordem não depende do locale da máquina
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )
}

function readIfExists(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

/** O motivo da recusa do leitor, curto: a primeira linha, sem o `arquivo:linha`, no máximo 160 caracteres. */
function shortReason(message: string, file: string): string {
  let reason = (message.split('\n')[0] ?? message).trim()
  if (reason.startsWith(`${file}:`)) reason = reason.slice(file.length + 1).replace(/^(\d+): /, 'linha $1: ')
  else if (reason.startsWith(`${file} `)) reason = reason.slice(file.length + 1)
  return reason.length > 160 ? `${reason.slice(0, 157)}...` : reason
}

function listSchemas(project: Project): ListedSchema[] {
  const dir = path.join(project.src, 'schemas', 'entities')
  const plan = new ChangePlan(project)
  const result: ListedSchema[] = []
  for (const entry of entries(dir)) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue
    const kebab = entry.name.slice(0, -3)
    const file = `src/schemas/entities/${entry.name}`
    const text = readFileSync(path.join(dir, entry.name), 'utf8')
    const declared = /\bexport\s+const\s+([a-z][A-Za-z0-9]*?)Schema\b(?<!InputSchema)/.exec(text)?.[1]
    const entity = declared ? declared.charAt(0).toUpperCase() + declared.slice(1) : pascalCase(kebab)
    try {
      const names = deriveNames(kebab)
      const domain: DomainNames = { plural: names, singular: names }
      const fields = readEntityFields(plan, domain).map(
        ({ name, type, values, optional }): ListedField => ({
          name,
          type,
          ...(values ? { values } : {}),
          optional,
        }),
      )
      result.push({ entity, file, fields, problem: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.push({ entity, file, fields: null, problem: shortReason(message, file) })
    }
  }
  return result
}

const SOURCES: ListedSource[] = ['mock', 'http', 'storage']

function listRepositories(project: Project): ListedRepository[] {
  const base = path.join(project.src, 'repositories')
  const result: ListedRepository[] = []
  for (const entry of entries(base)) {
    if (!entry.isDirectory()) continue
    const dir = path.join(base, entry.name)
    const contract = readIfExists(path.join(dir, 'repository.contract.ts'))
    const factory = readIfExists(path.join(dir, 'index.ts')) ?? ''
    const sources = SOURCES.filter(
      (source) =>
        existsSync(path.join(dir, `repository.${source}.ts`)) &&
        (source === 'mock' || new RegExp(`dataSource\\s*===\\s*['"]${source}['"]`).test(factory)),
    )
    result.push({
      domain: entry.name,
      entity: (contract ? contractEntity(contract) : undefined) ?? null,
      sources,
    })
  }
  return result
}

/** O arquivo de código de uma query: `<domínio>.ts(x)` ou `<domínio>/index.ts(x)`. */
function queryFiles(project: Project): { domain: string; file: string }[] {
  const base = path.join(project.src, 'queries')
  const result: { domain: string; file: string }[] = []
  for (const entry of entries(base)) {
    if (entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      const domain = entry.name.replace(/\.tsx?$/, '')
      if (domain !== 'index') result.push({ domain, file: path.join(base, entry.name) })
    } else if (entry.isDirectory()) {
      const index = ['index.ts', 'index.tsx']
        .map((name) => path.join(base, entry.name, name))
        .find((file) => existsSync(file))
      if (index) result.push({ domain: entry.name, file: index })
    }
  }
  return result
}

const HOOK = /\bexport\s+(?:async\s+)?function\s+(use[A-Z]\w*)|\bexport\s+const\s+(use[A-Z]\w*)/g

function listQueries(project: Project): ListedQuery[] {
  return queryFiles(project).map(({ domain, file }) => {
    const text = readFileSync(file, 'utf8')
    const hooks = [...text.matchAll(HOOK)].map((match) => (match[1] ?? match[2])!)
    const contract = readIfExists(
      path.join(project.src, 'repositories', domain, 'repository.contract.ts'),
    )
    const entity =
      (contract ? contractEntity(contract) : undefined) ??
      /\buse([A-Z][A-Za-z0-9]*)Detail\b/.exec(text)?.[1] ??
      null
    return { domain, file: displayPath(project.root, file), entity, hooks }
  })
}

/** Se o módulo é `src/pages/<nome>`, com o nome em subpastas se for o caso (`@/pages/x`, `./pages/x`, com ou sem `/index`). */
function isPageSpecifier(specifier: string, page: string): boolean {
  const module = specifier.replace(/\/index$/, '')
  return module === `pages/${page}` || module.endsWith(`/pages/${page}`)
}

/** Os nomes com que o `App.tsx` traz a tela `src/pages/<nome>`: o import padrão ou um `const X = lazy(() => import('...'))`. */
function componentsOf(app: SourceFile, page: string): string[] {
  const names: string[] = []
  for (const declaration of app.getImportDeclarations()) {
    const local = declaration.getDefaultImport()?.getText()
    if (local && isPageSpecifier(declaration.getModuleSpecifierValue(), page)) names.push(local)
  }
  for (const declaration of app.getVariableDeclarations()) {
    const lazy = declaration
      .getInitializer()
      ?.asKind(SyntaxKind.CallExpression)
      ?.getExpression()
      .getText()
    if (lazy !== 'lazy' && lazy !== 'React.lazy') continue
    const imports = declaration
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => call.getExpression().getKind() === SyntaxKind.ImportKeyword)
    const [argument] = imports[0]?.getArguments() ?? []
    if (
      argument &&
      Node.isStringLiteral(argument) &&
      isPageSpecifier(argument.getLiteralText(), page)
    ) {
      names.push(declaration.getName())
    }
  }
  return names
}

function attributesOf(route: RouteElement) {
  return Node.isJsxElement(route) ? route.getOpeningElement().getAttributes() : route.getAttributes()
}

/** O `path` de um `<Route>`: literal, curinga (sem `path` ou só curinga) ou a expressão que não é literal. */
function pathOf(route: RouteElement): { kind: RouteKind; text: string } {
  const literal = pathLiteral(route)
  if (literal) {
    const text = literal.getLiteralText()
    return isWildcardPath(text) ? { kind: 'catchAll', text: '*' } : { kind: 'literal', text }
  }
  for (const attribute of attributesOf(route)) {
    if (!Node.isJsxAttribute(attribute) || attribute.getNameNode().getText() !== 'path') continue
    const initializer = attribute.getInitializer()
    return { kind: 'expression', text: initializer ? initializer.getText() : '' }
  }
  return { kind: 'catchAll', text: '*' }
}

/** Se o `<Route>` é `nest` (`<Route nest>` ou `nest={true}`): os `path` de dentro são relativos ao dele. */
function isNest(route: RouteElement): boolean {
  return attributesOf(route).some((attribute) => {
    if (!Node.isJsxAttribute(attribute) || attribute.getNameNode().getText() !== 'nest') return false
    const initializer = attribute.getInitializer()
    return !initializer || initializer.getText().replace(/\s+/g, '') === '{true}'
  })
}

function joinPaths(outer: string, inner: string): string {
  const base = outer.replace(/\/+$/, '')
  return inner === '/' || inner === '' ? base || '/' : `${base}${inner.startsWith('/') ? '' : '/'}${inner}`
}

/**
 * A rota de uma tela: a `<Route>` mais interna que a usa, com o caminho composto com os `<Route nest>`
 * de fora (`/admin` + `/usuarios`). Se um `nest` de fora não tem `path` literal, devolve só o da de dentro,
 * marcado como parcial.
 */
function routeOf(
  routes: RouteElement[],
  components: string[],
): { route: string; kind: RouteKind; partial: boolean } | undefined {
  const used = routes
    .filter((route) => components.some((name) => usesIdentifier(route, name)))
    .map((route) => ({ route, depth: route.getAncestors().filter(isRouteElement).length }))
    .sort((a, b) => b.depth - a.depth)[0]?.route
  if (!used) return undefined
  const own = pathOf(used)
  if (own.kind !== 'literal') return { route: own.text, kind: own.kind, partial: false }
  let route = own.text
  let partial = false
  for (const outer of used.getAncestors().filter(isRouteElement)) {
    if (!isNest(outer)) continue
    const prefix = pathOf(outer)
    if (prefix.kind !== 'literal') {
      partial = true
      break
    }
    route = joinPaths(prefix.text, route)
  }
  return { route, kind: 'literal', partial }
}

/** O texto do model da tela, se ele existe. */
function modelOf(dir: string): string | undefined {
  for (const file of ['model.ts', 'model.tsx', 'model/index.ts', 'model/index.tsx']) {
    const text = readIfExists(path.join(dir, file))
    if (text !== undefined) return text
  }
  return undefined
}

/** O domínio da query que o model importa de `@/queries`, se importa. */
function queryOfModel(model: string, queries: ListedQuery[]): string | null {
  for (const match of model.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]@\/queries(?:\/([\w-]+))?['"]/g,
  )) {
    if (match[2]) return match[2]
    const names = (match[1] ?? '').split(',').map((name) => name.trim().replace(/^type\s+/, ''))
    const found = queries.find((query) => query.hooks.some((hook) => names.includes(hook)))
    if (found) return found.domain
  }
  return null
}

function listPages(project: Project, queries: ListedQuery[]): ListedPage[] {
  const app = existsSync(project.app) ? new ChangePlan(project).source(project.app) : undefined
  const routes = app ? app.getDescendants().filter(isRouteElement) : []
  const result: ListedPage[] = []
  for (const name of pagesIn(project.pages)) {
    const found = app ? routeOf(routes, componentsOf(app, name)) : undefined
    const model = modelOf(path.join(project.pages, name)) ?? ''
    const query = queryOfModel(model, queries)
    const param =
      /\buseParams\b/.test(model) || (found?.kind === 'literal' && found.route.includes('/:'))
    const variation: PageVariation = query
      ? param
        ? 'detail'
        : 'list'
      : param
        ? 'param'
        : 'title'
    result.push({
      name,
      route: found?.route ?? null,
      routeKind: found?.kind ?? null,
      routePartial: found?.partial ?? false,
      variation,
      query,
    })
  }
  return result
}

function listLanguages(project: Project): string[] {
  return entries(project.messages)
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

/**
 * O que o projeto tem hoje: os schemas (com os campos que o leitor reconhece), os repositórios (com
 * as fontes), as queries, as telas (com rota, variação e query) e os idiomas. Só lê os arquivos,
 * nunca escreve, e não falha com um arquivo editado à mão: o que o leitor não entende vira um
 * `problem` no schema, ou um `null`. Quem chama confere antes que a pasta é um projeto.
 */
export function listProject(project: Project): ProjectListing {
  const queries = listQueries(project)
  return {
    schemas: listSchemas(project),
    repositories: listRepositories(project),
    queries,
    pages: listPages(project, queries),
    languages: listLanguages(project),
  }
}
