import path from 'node:path'
import { listPages, missingPageFiles } from '../page-structure.ts'
import type { ResolvedOptions, Violation } from './types.ts'

/**
 * Toda tela de `src/pages`, em qualquer profundidade (`auth/login`), tem os arquivos obrigatórios
 * (por padrão `index.tsx`, `model.ts` e `view.tsx`); a pasta que só agrupa telas não conta. É a
 * mesma regra do `prumo/page-structure` do ESLint, que só vê a
 * tela que já tem `index.tsx`; aqui a falta do próprio `index.tsx` também acusa.
 */
export function checkPageStructure(options: ResolvedOptions): Violation[] {
  const pagesPath = path.join(options.root, options.pagesDir)
  return listPages(pagesPath).flatMap((page) =>
    missingPageFiles(path.join(pagesPath, page), options.requiredPageFiles).map(
      (file): Violation => ({
        rule: 'page-structure',
        file: `${options.pagesDir}/${page}/${file}`,
        message: `A tela '${page}' precisa do arquivo '${file}' na própria pasta.`,
      }),
    ),
  )
}
