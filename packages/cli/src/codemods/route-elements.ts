import { Node, SyntaxKind, type JsxElement, type JsxSelfClosingElement } from 'ts-morph'
import { isTextLiteral, type TextLiteral } from './edit.ts'

/** Um `<Route>` do `App.tsx`: com filhos ou autofechado. */
export type RouteElement = JsxElement | JsxSelfClosingElement

/** O nome da tag de um elemento JSX. */
export function tagNameOf(element: RouteElement): string {
  return Node.isJsxElement(element)
    ? element.getOpeningElement().getTagNameNode().getText()
    : element.getTagNameNode().getText()
}

/** Se o nó é um elemento `<Route>`. */
export function isRouteElement(node: Node): node is RouteElement {
  return (
    (Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node)) && tagNameOf(node) === 'Route'
  )
}

/** O literal do atributo `path` de um `<Route>`: `path="/x"` ou `path={'/x'}`. */
export function pathLiteral(element: RouteElement): TextLiteral | undefined {
  const attributes = Node.isJsxElement(element)
    ? element.getOpeningElement().getAttributes()
    : element.getAttributes()
  for (const attribute of attributes) {
    if (!Node.isJsxAttribute(attribute) || attribute.getNameNode().getText() !== 'path') continue
    const initializer = attribute.getInitializer()
    const value = Node.isJsxExpression(initializer) ? initializer.getExpression() : initializer
    if (isTextLiteral(value)) return value
  }
  return undefined
}

/** Se o `<Route>` usa o identificador (o componente da tela) em algum ponto de dentro dele. */
export function usesIdentifier(element: RouteElement, name: string): boolean {
  return element.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === name)
}

/** Escapa o texto de um segmento fixo para entrar numa expressão regular. */
function escapeSegment(segment: string): string {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Se o `path` de um `<Route>` (o padrão do wouter) casa com o endereço dado. O padrão pode ter
 * segmentos com parâmetro (`:id`, `:id?`, `:resto*`, `:resto+`) e curinga (`*`, `*?`). A curinga
 * vale por tudo o que vier depois, inclusive nada: `/inbox/*?` casa com `/inbox`, `/inbox/x` e
 * `/inbox/x/y`, e `/inbox/*` também casa com `/inbox` (o wouter exige algo depois da barra, mas a
 * rota nova no mesmo trecho ficaria confusa do mesmo jeito, então a checagem é a do lado seguro).
 * O `address` é lido como texto: o `:id` de uma rota nova com parâmetro conta como um segmento.
 */
export function patternMatches(pattern: string, address: string): boolean {
  let source = ''
  for (const segment of pattern.split('/').filter((part) => part !== '')) {
    if (segment === '*' || segment === '*?') source += '(?:/.*)?'
    else if (/^:[^/]+\*$/.test(segment)) source += '(?:/.*)?'
    else if (/^:[^/]+\+$/.test(segment)) source += '/.+'
    else if (/^:[^/]+\?$/.test(segment)) source += '(?:/[^/]+)?'
    else if (segment.startsWith(':')) source += '/[^/]+'
    else source += `/${escapeSegment(segment)}`
  }
  return new RegExp(`^${source}/?$`).test(address === '' ? '/' : address)
}

/** Se o `path` só tem curinga (`*`, `/*`, `*?`, `/*?`): a rota de "página não encontrada", como a sem `path`. */
export function isWildcardPath(pathText: string): boolean {
  return /^\/?\*\??$/.test(pathText)
}

/** Se o `<Route>` é a curinga: sem `path` literal ou com um `path` só de curinga. */
export function isCatchAllRoute(route: RouteElement): boolean {
  const literal = pathLiteral(route)
  return literal === undefined || isWildcardPath(literal.getLiteralText())
}
