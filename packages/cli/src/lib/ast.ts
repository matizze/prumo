import { Node } from 'ts-morph'

/** Um literal de texto: `'abc'`, `"abc"` ou um template sem substituição. */
export type TextLiteral = Node & { getLiteralText(): string }

export function isTextLiteral(node: Node | undefined): node is TextLiteral {
  return (
    node !== undefined && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
  )
}

/** O conteúdo do literal como está escrito no arquivo, sem as aspas. */
export function innerText(literal: TextLiteral): string {
  return literal.getText().slice(1, -1)
}
