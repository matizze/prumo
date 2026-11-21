/**
 * Argumentos ICU de uma mensagem: nome e, para formatos com contrato fixo, o formato.
 * "{n}" e "{n, plural, ...}" contam como `n` (cada idioma escolhe se precisa de plural);
 * "{s, select, on {..} other {..}}" conta como `s:select[on|other]`, porque o código passa
 * esses valores; "{d, date}" conta como `d:date`. Argumentos dentro dos ramos entram também.
 * Lança um erro se uma chave não fecha.
 */
export function icuPlaceholders(message: string): string[] {
  const found = new Set<string>()
  let i = 0
  while (i < message.length) {
    if (message[i] !== '{') {
      i++
      continue
    }
    const close = matchBrace(message, i)
    const [name = '', type, options = ''] = splitTop(message.slice(i + 1, close))
    const argument = name.trim()
    const kind = type?.trim()
    if (kind === 'select') {
      const branches = splitBranches(options)
      found.add(
        `${argument}:select[${branches
          .map(([key]) => key)
          .sort()
          .join('|')}]`,
      )
      branches.forEach(([, text]) => icuPlaceholders(text).forEach((p) => found.add(p)))
    } else if (kind === 'plural' || kind === 'selectordinal') {
      found.add(argument)
      splitBranches(options).forEach(([, text]) =>
        icuPlaceholders(text).forEach((p) => found.add(p)),
      )
    } else {
      found.add(kind ? `${argument}:${kind}` : argument)
    }
    i = close + 1
  }
  return [...found].sort()
}

/** "one {# item} other {# itens}" -> [['one', '# item'], ['other', '# itens']]. */
function splitBranches(options: string): [string, string][] {
  const branches: [string, string][] = []
  let i = 0
  while (i < options.length) {
    const open = options.indexOf('{', i)
    if (open === -1) break
    const close = matchBrace(options, open)
    branches.push([options.slice(i, open).trim(), options.slice(open + 1, close)])
    i = close + 1
  }
  return branches
}

function matchBrace(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    if (text[i] === '}' && --depth === 0) return i
  }
  throw new Error(`Chave não fechada em: ${text}`)
}

/** Separa nome, formato e o resto (ramos) pelas duas primeiras vírgulas. */
function splitTop(body: string): string[] {
  const first = body.indexOf(',')
  if (first === -1) return [body]
  const second = body.indexOf(',', first + 1)
  if (second === -1) return [body.slice(0, first), body.slice(first + 1)]
  return [body.slice(0, first), body.slice(first + 1, second), body.slice(second + 1)]
}
