import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

/** Arquivos que toda tela tem ao lado do `index.tsx`: o modelo (dados) e a view (visual). */
export const DEFAULT_PAGE_FILES = ['model.ts', 'view.tsx']

/**
 * Arquivos obrigatórios que faltam numa pasta de tela. Só entram os da lista: qualquer outro
 * arquivo ao lado do `index.tsx` é livre.
 */
export function missingPageFiles(
  pageDir: string,
  required: readonly string[] = DEFAULT_PAGE_FILES,
): string[] {
  return required.filter((file) => !existsSync(path.join(pageDir, file)))
}

/** O arquivo que faz de uma pasta uma tela. */
const PAGE_ENTRY = 'index.tsx'

/**
 * As telas de uma pasta, pelo caminho relativo a ela (`auth/login`), em ordem alfabética. A tela
 * é a primeira pasta, a partir da raiz, que tem `index.tsx`, e a busca não desce dentro dela: as
 * subpastas (`livros/components`) são da tela. A pasta sem `index.tsx` que tem telas dentro é só
 * um grupo (`auth`); a que não tem nenhuma é uma tela incompleta, que a estrutura cobra.
 */
export function listPages(pagesPath: string, prefix = ''): string[] {
  const dir = path.join(pagesPath, prefix)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    // Comparação fixa: a ordem não depende do locale da máquina
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const page = prefix ? `${prefix}/${entry.name}` : entry.name
      if (existsSync(path.join(pagesPath, page, PAGE_ENTRY))) return [page]
      const inside = listPages(pagesPath, page)
      return inside.length > 0 ? inside : [page]
    })
}

/**
 * A tela a que um caminho pertence, ou `undefined`: o caminho (de arquivo ou de pasta) é relativo
 * à pasta das telas (`livros/components/card.tsx`), e a tela é a primeira pasta dele com
 * `index.tsx` (`livros`). Arquivo solto em `pages/` ou numa pasta de grupo não é de tela.
 */
export function pageOf(pagesPath: string, inner: string): string | undefined {
  const segments = inner.split('/')
  for (let length = 1; length <= segments.length; length++) {
    const page = segments.slice(0, length).join('/')
    if (existsSync(path.join(pagesPath, page, PAGE_ENTRY))) return page
  }
  return undefined
}
