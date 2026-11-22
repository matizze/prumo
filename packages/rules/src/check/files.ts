import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Subpastas de uma pasta, em ordem alfabética. Pasta que não existe não tem subpastas. */
export function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/** Todos os arquivos de uma pasta, em qualquer profundidade, em ordem alfabética. */
export function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name)
      return entry.isDirectory() ? walk(full) : [full]
    })
}

/** Arquivo de código: `.ts` ou `.tsx`. */
export const isCode = (file: string): boolean => /\.(ts|tsx)$/.test(file)

/** Arquivo de teste, que não conta como uso de um módulo. */
export const isAux = (file: string): boolean => /\.test\.(ts|tsx)$/.test(file)

/** Tira a extensão `.ts` ou `.tsx` do caminho. */
export const stripExtension = (file: string): string => file.replace(/\.(ts|tsx)$/, '')

/**
 * Especificadores de import e export de um arquivo, estáticos e dinâmicos, lidos por expressão
 * regular (`import x from 'a'`, `export * from 'a'`, `import('a')`).
 */
export function specifiersOf(file: string): string[] {
  const code = readFileSync(file, 'utf8')
  const found = code.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)
  return [...found].map((match) => match[1]!)
}
