import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  Node,
  SyntaxKind,
  type ImportDeclaration,
  type JsxElement,
  type SourceFile,
} from 'ts-morph'
import { UsageError } from '../errors.ts'
import { applyEdits, indentOf, innerText, spliceText, type TextEdit } from './edit.ts'
import type { ChangePlan } from './plan.ts'
import {
  isNestRoute,
  isRouteElement,
  pathLiteral,
  patternMatches,
  usesIdentifier,
  type RouteElement,
} from './route-elements.ts'

/** A rota de uma tela, como a costura a recebe: o componente, de onde importá-lo e o `path`. */
export interface RouteSpec {
  /** O componente padrão da tela: `ProductsListPage`. */
  component: string
  /** De onde o `App.tsx` o importa: `@/pages/products-list`. */
  importPath: string
  /** O `path` do `<Route>` como está no `App.tsx` da origem: `/invoices/:id`, ou `/general` num `nest`. */
  path: string
  /** O `path` do `<Route nest>` que envolve a rota, se houver: `/ai-settings`. */
  prefix?: string
  /** O layout entre o `nest` e a rota: `AiSettingsLayout`. */
  layout?: string
}

const DISPLAY = 'src/App.tsx'
const CLONE_FILE = '__clone__.tsx'

/** O texto e o `package.json` de uma origem, que `addRoute` consulta. */
interface Origin {
  /** O `src/App.tsx` da origem, já aberto no plano (só leitura). */
  app: SourceFile
}

/** Abre o `App.tsx` da origem no ts-morph do plano, sem torná-lo parte do plano (não é gravado). */
export function openOriginApp(plan: ChangePlan, file: string): Origin {
  if (!existsSync(file)) throw new UsageError(`a origem não tem ${file}.`)
  return { app: plan.morph.createSourceFile(file, readFileSync(file, 'utf8'), { overwrite: true }) }
}

/** O `<Switch>` mais externo do arquivo, o das rotas do app. */
function topSwitch(app: SourceFile): JsxElement | undefined {
  return app
    .getDescendantsOfKind(SyntaxKind.JsxElement)
    .find(
      (element) =>
        isSwitch(element) &&
        !element
          .getAncestors()
          .some((ancestor) => Node.isJsxElement(ancestor) && isSwitch(ancestor)),
    )
}

function isSwitch(element: JsxElement): boolean {
  return element.getOpeningElement().getTagNameNode().getText() === 'Switch'
}

/** O `<Route>` mais próximo que envolve o nó, ou `undefined` se ele está no primeiro nível. */
function parentRoute(node: Node): RouteElement | undefined {
  return node.getAncestors().find(isRouteElement)
}

/** Os `<Route>` que são filhos diretos do `<Switch>`. */
function childRoutes(switchElement: JsxElement): RouteElement[] {
  return switchElement.getJsxChildren().filter(isRouteElement)
}

/** Troca o recuo de uma linha de origem pelo recuo de destino nas linhas depois da primeira. */
function reindent(text: string, from: string, to: string): string {
  return text
    .split('\n')
    .map((line, index) =>
      index > 0 && line.startsWith(from) ? to + line.slice(from.length) : line,
    )
    .join('\n')
}

/**
 * A rota de uma tela da origem: o `<Route>` mais interno que usa o componente e tem o `path` da
 * costura. O mesmo componente pode ter mais de uma rota (`/invoices/:id` e `/single-invoice`), e
 * o `path` do índice diz qual é a da tela.
 */
function findSourceRoute(origin: Origin, spec: RouteSpec): RouteElement {
  const using = origin.app
    .getDescendants()
    .filter(isRouteElement)
    .filter((element) => usesIdentifier(element, spec.component))
  const found = using.find((element) => {
    const literal = pathLiteral(element)
    if (literal === undefined || innerText(literal) !== spec.path) return false
    return !using.some((other) => other !== element && other.getAncestors().includes(element))
  })
  if (!found) {
    throw new UsageError(
      `a origem não tem, no src/App.tsx dela, a rota '${spec.path}' de '${spec.component}': a especificação da rota não confere com a origem.`,
    )
  }
  return found
}

/** Os nomes que um trecho de JSX usa, fora o nome dos atributos e das propriedades. */
function usedNames(plan: ChangePlan, snippet: string): Set<string> {
  const file = plan.morph.createSourceFile(CLONE_FILE, `const clone = (\n${snippet}\n)\n`, {
    overwrite: true,
  })
  try {
    const names = new Set<string>()
    for (const id of file.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const parent = id.getParent()
      if (Node.isJsxAttribute(parent) && parent.getNameNode() === id) continue
      if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) continue
      if (Node.isVariableDeclaration(parent) && parent.getNameNode() === id) continue
      names.add(id.getText())
    }
    return names
  } finally {
    plan.morph.removeSourceFile(file)
  }
}

/** Os nomes que o arquivo declara ou importa no primeiro nível. */
function declaredNames(file: SourceFile): Set<string> {
  const names = new Set<string>()
  for (const declaration of file.getImportDeclarations()) {
    const local = [
      declaration.getDefaultImport(),
      declaration.getNamespaceImport(),
      ...declaration.getNamedImports().map((named) => named.getAliasNode() ?? named.getNameNode()),
    ]
    for (const id of local) if (id) names.add(id.getText())
  }
  for (const statement of file.getStatements()) {
    if (Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement)) {
      const name = statement.getName()
      if (name) names.add(name)
    } else if (Node.isVariableStatement(statement)) {
      for (const declaration of statement.getDeclarations()) names.add(declaration.getName())
    }
  }
  return names
}

/** O import de origem que traz o nome, ou `undefined` se o nome não é importado. */
function importOf(file: SourceFile, name: string): ImportDeclaration | undefined {
  return file.getImportDeclarations().find((declaration) => {
    const local = [
      declaration.getDefaultImport(),
      declaration.getNamespaceImport(),
      ...declaration.getNamedImports().map((named) => named.getAliasNode() ?? named.getNameNode()),
    ]
    return local.some((id) => id?.getText() === name)
  })
}

/** Se o projeto tem o pacote em alguma das listas de dependências do `package.json`. */
function hasPackage(plan: ChangePlan, name: string): boolean {
  const file = path.join(plan.project.root, 'package.json')
  if (!existsSync(file)) return false
  try {
    const json = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, string>>
    return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].some(
      (key) => json[key]?.[name] !== undefined,
    )
  } catch {
    return false
  }
}

/** Se o módulo de um import da origem também existe no projeto (alias `@/` ou pacote). */
function canImport(plan: ChangePlan, specifier: string): boolean {
  if (specifier.startsWith('@/')) {
    const base = path.join(plan.project.src, specifier.slice(2))
    return ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'].some((ext) =>
      plan.hasFile(base + ext),
    )
  }
  if (specifier.startsWith('.')) return false
  const name = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]!
  return hasPackage(plan, name)
}

/**
 * As edições que garantem os nomes que o trecho clonado usa no `App.tsx` do projeto. O nome que
 * o projeto já declara ou importa fica como está. O que falta e a origem importa, de um módulo que
 * o projeto também tem (um layout em `@/components/layout`, o `Redirect` do `wouter`), ganha o
 * import. O que a origem declara no próprio arquivo (o `Private`) não dá para trazer: `UsageError`.
 */
function importEdits(
  plan: ChangePlan,
  app: SourceFile,
  origin: Origin,
  used: Set<string>,
  skip: string,
): TextEdit[] {
  const declared = declaredNames(app)
  const inOrigin = declaredNames(origin.app)
  const missing = [...used].filter(
    (name) => name !== skip && inOrigin.has(name) && !declared.has(name),
  )

  const edits: TextEdit[] = []
  const cannot: string[] = []
  const lines: string[] = []
  const imports = app.getImportDeclarations()
  for (const name of missing.sort()) {
    const declaration = importOf(origin.app, name)
    const specifier = declaration?.getModuleSpecifierValue()
    if (!declaration || specifier === undefined || !canImport(plan, specifier)) {
      cannot.push(name)
      continue
    }
    const named = declaration
      .getNamedImports()
      .find((item) => (item.getAliasNode() ?? item.getNameNode()).getText() === name)
    const existing = imports.find(
      (item) =>
        item.getModuleSpecifierValue() === specifier &&
        item.getNamedImports().length > 0 &&
        !item.isTypeOnly(),
    )
    if (named && existing) {
      const last = existing.getNamedImports().at(-1)!
      edits.push({ pos: last.getEnd(), end: last.getEnd(), text: `, ${named.getText()}` })
    } else if (named) {
      lines.push(`import { ${named.getText()} } from '${specifier}'`)
    } else {
      lines.push(
        declaration.getDefaultImport()?.getText() === name
          ? `import ${name} from '${specifier}'`
          : `import * as ${name} from '${specifier}'`,
      )
    }
  }
  if (cannot.length > 0) {
    throw new UsageError(
      `${DISPLAY} não declara nem importa ${cannot.map((name) => `'${name}'`).join(', ')}, que a rota usa: ${cannot.length === 1 ? 'traga-o' : 'traga-os'} para o ${DISPLAY} do projeto (a casca do app) e rode o comando de novo.`,
    )
  }
  const last = imports.at(-1)
  if (lines.length > 0) {
    if (!last) throw new UsageError(`${DISPLAY} não tem imports: não sei onde acrescentar.`)
    edits.push({ pos: last.getEnd(), end: last.getEnd(), text: `\n${lines.join('\n')}` })
  }
  return edits
}

/** O import da tela: o da origem, na posição alfabética entre os imports de `@/pages`. */
function componentImportEdit(app: SourceFile, origin: Origin, spec: RouteSpec): TextEdit {
  const source = importOf(origin.app, spec.component)
  const line =
    source?.getModuleSpecifierValue() === spec.importPath
      ? source.getText()
      : `import ${spec.component} from '${spec.importPath}'`
  const imports = app.getImportDeclarations()
  const pages = imports.filter((declaration) =>
    declaration.getModuleSpecifierValue().startsWith('@/pages/'),
  )
  const next = pages.find((declaration) => declaration.getModuleSpecifierValue() > spec.importPath)
  if (next) return { pos: next.getStart(), end: next.getStart(), text: `${line}\n` }
  const last = pages.at(-1) ?? imports.at(-1)
  if (!last) throw new UsageError(`${DISPLAY} não tem imports: não sei onde acrescentar.`)
  return { pos: last.getEnd(), end: last.getEnd(), text: `\n${line}` }
}

/** A edição que põe o clone entre as rotas do `<Switch>`: depois da última com `path`, ou antes da curinga. */
function insertionEdit(
  app: SourceFile,
  switchElement: JsxElement,
  clone: string,
  from: string,
): TextEdit {
  const text = app.getFullText()
  const routes = childRoutes(switchElement)
  const withPath = routes.filter((route) => pathLiteral(route) !== undefined)
  const anchor = withPath.at(-1)
  if (anchor) {
    const indent = indentOf(text, anchor.getStart())
    const separator = /^[ \t]*\n[ \t]*\n/.test(text.slice(anchor.getEnd())) ? '\n\n' : '\n'
    return {
      pos: anchor.getEnd(),
      end: anchor.getEnd(),
      text: `${separator}${indent}${reindent(clone, from, indent)}`,
    }
  }
  const catchAll = routes[0]
  if (!catchAll) {
    throw new UsageError(
      `o <Switch> do ${DISPLAY} não tem nenhum <Route>: não sei onde acrescentar.`,
    )
  }
  const indent = indentOf(text, catchAll.getStart())
  return {
    pos: catchAll.getStart(),
    end: catchAll.getStart(),
    text: `${reindent(clone, from, indent)}\n\n${indent}`,
  }
}

/** Recusa o `path` que repete ou conflita com o de uma irmã (as que estão no mesmo `<Switch>`). */
function assertFree(switchElement: JsxElement, routePath: string, display = routePath): void {
  const siblings = childRoutes(switchElement).flatMap((route) => {
    const literal = pathLiteral(route)
    return literal ? [innerText(literal)] : []
  })
  if (siblings.includes(routePath)) {
    throw new UsageError(
      `${DISPLAY} já tem uma rota '${routePath}', que não é a da tela: escolha outro caminho ou tire a rota antes.`,
    )
  }
  const covering = siblings.find((sibling) => patternMatches(sibling, display))
  if (covering !== undefined) {
    throw new UsageError(
      `a rota '${routePath}' conflita com a rota '${covering}' que ${DISPLAY} já tem: o wouter escolhe a primeira que casa, e uma das duas ficaria inalcançável.`,
    )
  }
}

/**
 * A rota inteira de uma tela de `nest` quando o projeto ainda não tem o `<Route nest>`: o `<Route>`
 * de primeiro nível da origem (com a casca, o `nest` e o layout), só com a rota da tela dentro do
 * `<Switch>` das seções. Sem as irmãs da origem (que não existem no projeto) e sem a rota
 * curinga que redireciona para uma delas.
 */
function wrapperClone(element: RouteElement): { text: string; outer: RouteElement } {
  const outer = element.getAncestors().filter(isRouteElement).at(-1)
  const inner = element
    .getAncestors()
    .find((ancestor): ancestor is JsxElement => Node.isJsxElement(ancestor) && isSwitch(ancestor))
  if (!outer || !inner) {
    throw new UsageError(
      'a rota da origem está num <Route nest> sem <Switch>: a especificação da rota não confere com a origem.',
    )
  }
  const base = outer.getStart()
  const sourceText = outer.getSourceFile().getFullText()
  const edits: TextEdit[] = childRoutes(inner)
    .filter((route) => route !== element)
    .map((route) => {
      let start = route.getStart()
      while (start > 0 && /\s/.test(sourceText.charAt(start - 1))) start--
      return { pos: start - base, end: route.getEnd() - base, text: '' }
    })
  return { text: spliceText(outer.getText(), edits), outer }
}

/**
 * Faz no `src/App.tsx` do projeto a costura da rota de uma tela, clonando o `<Route>`
 * do `src/App.tsx` da origem:
 *
 * - tela de primeiro nível: o `<Route>` da origem (com a casca e o layout dele) entra depois da
 *   última rota com `path` do `<Switch>` mais externo;
 * - tela de um `<Route nest>` (`prefix`): se o projeto já tem o `nest`, a rota da tela entra no
 *   `<Switch>` dele; se não tem, entra o `<Route>` de primeiro nível da origem, só com ela.
 *
 * O import do componente entra na posição alfabética dos de `@/pages`, e os nomes que o clone usa
 * (layouts, `Redirect`) ganham import se o projeto tem o módulo. Tela que o `App.tsx` já usa fica
 * como está (devolve `false`). Rota repetida ou conflitante, `App.tsx` ou `<Switch>` que falta,
 * nome que o `App.tsx` não tem e não dá para importar: `UsageError`, sem escrever nada.
 */
export function addRoute(plan: ChangePlan, origin: Origin, spec: RouteSpec): boolean {
  let app: SourceFile
  try {
    app = plan.source(plan.project.app)
  } catch {
    throw new UsageError(`o projeto não tem ${DISPLAY}.`)
  }
  const routes = app.getDescendants().filter(isRouteElement)
  if (routes.some((route) => usesIdentifier(route, spec.component))) return false
  if (declaredNames(app).has(spec.component)) {
    throw new UsageError(
      `${DISPLAY} já declara '${spec.component}' sem uma rota para ele: a tela é '${spec.importPath}'.`,
    )
  }

  const element = findSourceRoute(origin, spec)
  const sourceIndent = indentOf(origin.app.getFullText(), element.getStart())

  let target: JsxElement | undefined
  let clone: string
  let from = sourceIndent
  let freePath = spec.path
  let freeDisplay = spec.path
  if (spec.prefix === undefined) {
    if (parentRoute(element)) {
      throw new UsageError(
        `a rota '${spec.path}' de '${spec.component}' está dentro de outro <Route> na origem, e a especificação não diz o prefixo: ela não confere com a origem.`,
      )
    }
    target = topSwitch(app)
    clone = element.getText()
  } else {
    const nest = routes.find((route) => {
      const literal = pathLiteral(route)
      return isNestRoute(route) && literal !== undefined && innerText(literal) === spec.prefix
    })
    if (nest) {
      target = nest.getDescendantsOfKind(SyntaxKind.JsxElement).find(isSwitch)
      clone = element.getText()
    } else {
      const wrapper = wrapperClone(element)
      from = indentOf(origin.app.getFullText(), wrapper.outer.getStart())
      clone = wrapper.text
      target = topSwitch(app)
      const literal = pathLiteral(wrapper.outer)
      freePath = literal ? innerText(literal) : spec.prefix
      freeDisplay = spec.prefix
    }
  }
  if (!target) throw new UsageError(`${DISPLAY} não tem o <Switch> das rotas.`)
  assertFree(target, freePath, freeDisplay)

  const used = usedNames(plan, clone)
  const edits = [
    insertionEdit(app, target, clone, from),
    componentImportEdit(app, origin, spec),
    ...importEdits(plan, app, origin, used, spec.component),
  ]
  applyEdits(app, edits)
  return true
}
