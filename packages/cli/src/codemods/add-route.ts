import { Node, SyntaxKind, type JsxElement, type SourceFile } from 'ts-morph'
import { UsageError } from '../errors.ts'
import type { ChangePlan } from '../lib/plan.ts'
import { innerText } from '../lib/ast.ts'
import { applyEdits, indentOf, type TextEdit } from './edit.ts'
import {
  isCatchAllRoute,
  isRouteElement,
  pathLiteral,
  patternMatches,
  usesIdentifier,
  type RouteElement,
} from '../lib/route-elements.ts'

const DISPLAY = 'src/App.tsx'
const CLONE_FILE = '__clone__.tsx'

/** O `src/App.tsx` do projeto, aberto no plano (uma costura). */
function openApp(plan: ChangePlan): SourceFile {
  try {
    return plan.source(plan.project.app)
  } catch {
    throw new UsageError(`o projeto não tem ${DISPLAY}.`)
  }
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

/** Abre o trecho de JSX num arquivo temporário do plano, para lê-lo, e o remove ao terminar. */
function withClone<T>(plan: ChangePlan, snippet: string, read: (file: SourceFile) => T): T {
  const file = plan.morph.createSourceFile(CLONE_FILE, `const clone = (\n${snippet}\n)\n`, {
    overwrite: true,
  })
  try {
    return read(file)
  } finally {
    plan.morph.removeSourceFile(file)
  }
}

/** Os nomes que um trecho de JSX usa, fora o nome dos atributos e das propriedades. */
function usedNames(plan: ChangePlan, snippet: string): Set<string> {
  return withClone(plan, snippet, (file) => {
    const names = new Set<string>()
    for (const id of file.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const parent = id.getParent()
      if (Node.isJsxAttribute(parent) && parent.getNameNode() === id) continue
      if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) continue
      if (Node.isVariableDeclaration(parent) && parent.getNameNode() === id) continue
      names.add(id.getText())
    }
    return names
  })
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

/** O import da tela, na posição alfabética entre os imports de `@/pages`. */
function componentImportEdit(app: SourceFile, line: string, importPath: string): TextEdit {
  const imports = app.getImportDeclarations()
  const pages = imports.filter((declaration) =>
    declaration.getModuleSpecifierValue().startsWith('@/pages/'),
  )
  const next = pages.find((declaration) => declaration.getModuleSpecifierValue() > importPath)
  if (next) return { pos: next.getStart(), end: next.getStart(), text: `${line}\n` }
  const last = pages.at(-1) ?? imports.at(-1)
  if (!last) throw new UsageError(`${DISPLAY} não tem imports: não sei onde acrescentar.`)
  return { pos: last.getEnd(), end: last.getEnd(), text: `\n${line}` }
}

/** A edição que põe o clone entre as rotas do `<Switch>`: depois da última com `path`, ou antes da curinga. */
function insertionEdit(app: SourceFile, switchElement: JsxElement, clone: string, from: string): TextEdit {
  const text = app.getFullText()
  const routes = childRoutes(switchElement)
  const withPath = routes.filter((route) => !isCatchAllRoute(route))
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
  const catchAll = routes.find(isCatchAllRoute)
  if (!catchAll) {
    // Um <Switch> sem nenhuma rota (o de um app novo): a rota entra sozinha, entre as tags
    const opening = switchElement.getOpeningElement().getEnd()
    const closing = switchElement.getClosingElement().getStart()
    const outer = indentOf(text, switchElement.getStart())
    const inner = `${outer}  `
    return {
      pos: opening,
      end: closing,
      text: `\n${inner}${reindent(clone, from, inner)}\n${outer}`,
    }
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
  // A curinga (sem `path` ou só com `*`) fica por último e não disputa endereço: a rota nova entra antes dela
  const siblings = childRoutes(switchElement).flatMap((route) => {
    const literal = pathLiteral(route)
    return literal && !isCatchAllRoute(route) ? [innerText(literal)] : []
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

/** A rota de uma tela como um trecho de JSX pronto, para a costura que não tem um `App.tsx` de origem. */
export interface RouteSnippet {
  /** O componente padrão da tela: `ClientesPage`. */
  component: string
  /** De onde o `App.tsx` o importa: `@/pages/clientes`. */
  importPath: string
  /** O `path` do `<Route>` do trecho: `/clientes`. */
  path: string
  /**
   * O `<Route>` como entra no `App.tsx`, em JSX: `<Route path="/clientes">...</Route>`. As linhas
   * depois da primeira são recuadas em relação à primeira, e a costura soma o recuo do destino.
   */
  element: string
}

/** Confere que o trecho é um único `<Route>` com o `path` e o componente da costura. */
function assertSnippet(plan: ChangePlan, spec: RouteSnippet): void {
  const problem = withClone(plan, spec.element, (file) => {
    const initializer = file.getVariableDeclarations()[0]?.getInitializer()
    const root = Node.isParenthesizedExpression(initializer)
      ? initializer.getExpression()
      : initializer
    if (!root || !isRouteElement(root)) return 'não é um único <Route>'
    const literal = pathLiteral(root)
    if (literal === undefined || innerText(literal) !== spec.path) {
      return `não tem o path '${spec.path}' (literal) no <Route> de fora`
    }
    if (!usesIdentifier(root, spec.component)) return `não usa '${spec.component}'`
    return undefined
  })
  if (problem) throw new Error(`o trecho da rota ${problem}.`)
}

/**
 * Faz no `src/App.tsx` do projeto a costura da rota de uma tela a partir de um trecho de JSX
 * pronto (o `<Route>` que o gerador montou), sem um `App.tsx` de origem para clonar:
 *
 * - o trecho entra no `<Switch>` mais externo, depois da última rota com `path` (ou antes da rota
 *   curinga, ou sozinho num `<Switch>` vazio), com o recuo do destino;
 * - o import do componente entra na posição alfabética dos de `@/pages`.
 *
 * Tela que o `App.tsx` já usa fica como está (devolve `false`). Rota repetida ou conflitante,
 * `App.tsx` ou `<Switch>` que falta, componente já declarado sem rota e nome do trecho (um layout,
 * um guarda) que o `App.tsx` não declara nem importa: `UsageError`, sem escrever nada. Trecho que
 * não é um `<Route>` com o `path` e o componente da costura é erro de quem chama (`Error`).
 */
export function addRouteSnippet(plan: ChangePlan, spec: RouteSnippet): boolean {
  const app = openApp(plan)
  if (
    app
      .getDescendants()
      .filter(isRouteElement)
      .some((route) => usesIdentifier(route, spec.component))
  ) {
    return false
  }
  const declared = declaredNames(app)
  if (declared.has(spec.component)) {
    throw new UsageError(
      `${DISPLAY} já declara '${spec.component}' sem uma rota para ele: a tela é '${spec.importPath}'.`,
    )
  }
  assertSnippet(plan, spec)

  const target = topSwitch(app)
  if (!target) throw new UsageError(`${DISPLAY} não tem o <Switch> das rotas.`)
  assertFree(target, spec.path)

  const missing = [...usedNames(plan, spec.element)].filter(
    (name) => /^[A-Z]/.test(name) && name !== spec.component && !declared.has(name),
  )
  if (missing.length > 0) {
    throw new UsageError(
      `${DISPLAY} não declara nem importa ${missing.map((name) => `'${name}'`).join(', ')}, que a rota usa: ${missing.length === 1 ? 'traga-o' : 'traga-os'} para o ${DISPLAY} e rode o comando de novo.`,
    )
  }

  applyEdits(app, [
    insertionEdit(app, target, spec.element, ''),
    componentImportEdit(app, `import ${spec.component} from '${spec.importPath}'`, spec.importPath),
  ])
  return true
}
