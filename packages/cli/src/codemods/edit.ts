import {
  Node,
  type ExportDeclaration,
  type ImportDeclaration,
  type ObjectLiteralExpression,
  type SourceFile,
} from 'ts-morph'
import { UsageError } from '../errors.ts'

/** Troca do trecho `[pos, end)` do texto por `text`. */
export interface TextEdit {
  pos: number
  end: number
  text: string
}

/** Aplica as edições a um texto, de trás para a frente, para as posições não se deslocarem. */
function spliceText(source: string, edits: TextEdit[]): string {
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

/** O nome do módulo de um import ou export, ou `''` se não tiver (`export { x }` sem `from`). */
export function specifierOf(declaration: ImportDeclaration | ExportDeclaration): string {
  return declaration.getModuleSpecifierValue() ?? ''
}

/**
 * A edição que acrescenta `line` como uma declaração do topo do arquivo, na posição alfabética:
 * antes da primeira declaração que vem depois da nova (pelo módulo), ou depois da última, se
 * nenhuma vem. Sem nenhuma declaração do grupo, vai depois de `fallback`.
 */
export function insertSorted<T extends ImportDeclaration | ExportDeclaration>(
  group: T[],
  specifier: string,
  line: string,
  fallback: Node | undefined,
  where: string,
): TextEdit {
  const next = group.find((declaration) => specifierOf(declaration) > specifier)
  if (next) return { pos: next.getStart(), end: next.getStart(), text: `${line}\n` }
  const last = group[group.length - 1] ?? fallback
  if (!last) throw new UsageError(`não achei onde acrescentar '${specifier}' em ${where}.`)
  return { pos: last.getEnd(), end: last.getEnd(), text: `\n${line}` }
}

/** As aspas e o ponto e vírgula do estilo do arquivo, copiados de uma declaração com módulo. */
export function styleOf(declaration: ImportDeclaration | ExportDeclaration | undefined): {
  quote: string
  semicolon: string
} {
  const specifier = declaration?.getModuleSpecifier()
  return {
    quote: specifier ? specifier.getText().charAt(0) : "'",
    semicolon: declaration?.getText().endsWith(';') ? ';' : '',
  }
}

/**
 * A edição que acrescenta `line` na linha de baixo do último export: depois do fim da linha e dos
 * comentários que começam nela (`// nota`, `/* nota *\/`, até um de bloco que passa para as
 * linhas seguintes), para o export novo nunca cair dentro de um comentário e o comentário ficar
 * com o export dele.
 */
export function afterLine(file: SourceFile, last: ExportDeclaration, line: string): TextEdit {
  const text = file.getFullText()
  const comments = last.getTrailingCommentRanges()
  const from = comments.length > 0 ? Math.max(last.getEnd(), comments[comments.length - 1]!.getEnd()) : last.getEnd()
  const newline = text.indexOf('\n', from)
  if (newline === -1) return { pos: text.length, end: text.length, text: `\n${line}\n` }
  return { pos: newline, end: newline, text: `\n${line}` }
}

/**
 * Junta as inserções que caem na mesma posição numa só, na ordem em que vieram: o `applyEdits`
 * poria a segunda antes da primeira.
 */
export function mergeInsertions(edits: TextEdit[]): TextEdit[] {
  const merged: TextEdit[] = []
  for (const edit of edits) {
    const same =
      edit.pos === edit.end ? merged.find((e) => e.pos === edit.pos && e.end === edit.pos) : undefined
    if (same) same.text += edit.text
    else merged.push({ ...edit })
  }
  return merged
}

/** O nome de um membro de um objeto: a chave de `a: 1` e `a`, ou a expressão de `...a`; `undefined` para o resto. */
export function memberName(member: Node): string | undefined {
  if (Node.isPropertyAssignment(member) || Node.isShorthandPropertyAssignment(member)) {
    return member.getName()
  }
  if (Node.isSpreadAssignment(member)) return member.getExpression().getText()
  return undefined
}

/**
 * A edição que acrescenta `entry` (`chave: valor` ou `...origem`) ao objeto, na posição alfabética
 * pelo `name`: antes do primeiro membro que vem depois, ou no fim. Copia o recuo dos membros que já
 * existem (e a vírgula do último, se ele a tem); num objeto vazio, usa o recuo da linha dele mais dois.
 */
export function insertMember(
  file: SourceFile,
  object: ObjectLiteralExpression,
  name: string,
  entry: string,
): TextEdit {
  const text = file.getFullText()
  const members = object.getProperties()
  const last = members[members.length - 1]
  const lineIndent = indentOf(text, object.getStart())
  const indent = last ? indentOf(text, last.getStart()) : `${lineIndent}  `
  const next = members.find((member) => (memberName(member) ?? '') > name)
  if (next) return { pos: next.getStart(), end: next.getStart(), text: `${entry},\n${indent}` }
  if (last) {
    const { end, hasComma } = afterComma(text, last.getEnd())
    return {
      pos: end,
      end,
      text: `${hasComma ? '' : ','}\n${indent}${entry}${hasComma ? ',' : ''}`,
    }
  }
  const open = object.getStart() + 1
  return { pos: open, end: open, text: `\n${indent}${entry},\n${lineIndent}` }
}
