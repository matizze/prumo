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

/** Todos os `<Route>` de um arquivo, em qualquer lugar da árvore, na ordem do arquivo. */
export function routeElements(root: Node): RouteElement[] {
  return root.getDescendants().filter(isRouteElement)
}

/** Se o `<Route>` tem o atributo `nest`: as rotas de dentro dele são relativas ao `path` dele. */
export function isNestRoute(element: RouteElement): boolean {
  const attributes = Node.isJsxElement(element)
    ? element.getOpeningElement().getAttributes()
    : element.getAttributes()
  return attributes.some(
    (attribute) => Node.isJsxAttribute(attribute) && attribute.getNameNode().getText() === 'nest',
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
