import { existsSync } from 'node:fs'
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
