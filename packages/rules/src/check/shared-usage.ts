import path from 'node:path'
import { toPosix } from '../eslint/paths.ts'
import { isAux, isCode, specifiersOf, stripExtension, walk } from './files.ts'
import type { ResolvedOptions, Violation } from './types.ts'

/** Quem usa um módulo: uma tela (`page:<nome>`), a casca do layout ou outro módulo compartilhado. */
const LAYOUT = 'layout'
const PAGE = 'page:'

/**
 * O que está em `components/shared` é usado por 2 ou mais telas. O uso conta pelo grafo de
 * imports: um módulo usado só por outro módulo compartilhado vale pelas telas que usam esse
 * outro. A casca do layout aparece em todas as telas, então conta como duas. Testes
 * não contam como uso. Os imports são lidos por expressão regular, nos mesmos casos do
 * `import`, do `export ... from` e do `import()` com texto fixo.
 */
export function checkSharedUsage(options: ResolvedOptions): Violation[] {
  const rel = (file: string) => path.posix.relative(options.root, toPosix(file))
  const inCode = (dir: string) =>
    walk(path.join(options.root, dir)).filter((file) => isCode(file) && !isAux(file))

  // Cada módulo de shared, pelo caminho sem extensão (a raiz do projeto como base)
  const files = new Map<string, string>()
  for (const file of inCode(options.sharedDir)) files.set(stripExtension(rel(file)), rel(file))

  /** Resolve o import para o caminho sem extensão, ou null se for pacote npm. */
  const resolve = (from: string, specifier: string): string | null => {
    if (specifier.startsWith(options.alias)) {
      return path.posix.join(options.aliasRoot, specifier.slice(options.alias.length))
    }
    if (specifier.startsWith('.')) return path.posix.join(path.posix.dirname(from), specifier)
    return null
  }

  const ownerOf = (file: string): string => {
    if (file.startsWith(`${options.pagesDir}/`)) {
      return `${PAGE}${file.slice(options.pagesDir.length + 1).split('/')[0]}`
    }
    if (file.startsWith(`${options.layoutDir}/`)) return LAYOUT
    return stripExtension(file)
  }

  // Quem importa cada módulo de shared
  const importers = new Map<string, Set<string>>([...files.keys()].map((id) => [id, new Set()]))
  const sources = [options.pagesDir, options.layoutDir, options.sharedDir].flatMap(inCode)
  for (const source of sources) {
    const file = rel(source)
    const owner = ownerOf(file)
    for (const specifier of specifiersOf(source)) {
      const target = resolve(file, specifier)
      const hit = target && (importers.get(target) ?? importers.get(`${target}/index`))
      if (hit && owner !== target) hit.add(owner)
    }
  }

  // Telas que usam um módulo, direta ou indiretamente; a casca do layout conta como duas
  const screens = (id: string, seen = new Set<string>()): Set<string> => {
    const used = new Set<string>()
    if (seen.has(id)) return used
    seen.add(id)
    for (const owner of importers.get(id) ?? []) {
      if (owner === LAYOUT) return new Set([`${LAYOUT}:1`, `${LAYOUT}:2`])
      if (owner.startsWith(PAGE)) used.add(owner)
      else screens(owner, seen).forEach((screen) => used.add(screen))
    }
    return used
  }

  return [...files]
    .map(([id, file]) => ({ file, used: [...screens(id)] }))
    .filter(({ used }) => used.length < 2)
    .map(({ file, used }): Violation => {
      // Zero, uma ou várias telas (várias não chega aqui, mas a frase cobre os três casos)
      const by =
        used.length === 0
          ? 'não é usado por nenhuma tela'
          : used.length === 1
            ? `é usado só pela tela '${used[0]!.slice(PAGE.length)}'`
            : `é usado pelas telas ${used.map((screen) => `'${screen.slice(PAGE.length)}'`).join(', ')}`
      return {
        rule: 'shared-usage',
        file,
        message: `O módulo ${by}, e o que está em ${options.sharedDir} precisa de 2 ou mais telas: mova-o para a tela que o usa.`,
      }
    })
}
