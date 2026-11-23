import { Node, type SourceFile } from 'ts-morph'

/** Troca do trecho `[pos, end)` do texto por `text`. */
export interface TextEdit {
  pos: number
  end: number
  text: string
}

/** Aplica as edições a um texto, de trás para a frente, para as posições não se deslocarem. */
export function spliceText(source: string, edits: TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.pos - a.pos)
  let result = source
  let limit = source.length
  for (const edit of sorted) {
    if (edit.end > limit) throw new Error('edições do codemod se sobrepõem.')
    result = result.slice(0, edit.pos) + edit.text + result.slice(edit.end)
    limit = edit.pos
  }
  return result
}

/**
 * Aplica as edições ao arquivo de uma vez, a partir das posições da árvore atual. Editar por
 * posição, em vez de manipular nó a nó, preserva as aspas, os espaços e os comentários do arquivo
 * (o ts-morph reescreveria o trecho) e evita nós esquecidos entre uma edição e outra.
 */
export function applyEdits(file: SourceFile, edits: TextEdit[]): void {
  if (edits.length === 0) return
  file.replaceWithText(spliceText(file.getFullText(), edits))
}

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

/**
 * A edição que troca o conteúdo do literal e mantém as aspas. Os valores que o codemod escreve
 * (nomes, namespaces, rotas) não têm aspas, barra invertida nem quebra de linha: se tiverem, é
 * erro do chamador, e escrever assim quebraria o arquivo.
 */
export function replaceInner(literal: TextLiteral, value: string): TextEdit {
  if (/['"`\\\n$]/.test(value)) throw new Error(`valor inválido para um literal: ${value}`)
  return { pos: literal.getStart() + 1, end: literal.getEnd() - 1, text: value }
}

/** O recuo da linha onde está a posição `pos`: os espaços do começo da linha. */
export function indentOf(text: string, pos: number): string {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1
  return /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? ''
}

/** Até onde vai a vírgula que vem logo depois de `end` (só espaços no meio), ou o próprio `end`. */
export function afterComma(text: string, end: number): { end: number; hasComma: boolean } {
  const match = /^\s*,/.exec(text.slice(end))
  return match ? { end: end + match[0].length, hasComma: true } : { end, hasComma: false }
}
