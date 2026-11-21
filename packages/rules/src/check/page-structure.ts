import path from 'node:path'
import { missingPageFiles } from '../page-structure.ts'
import { listDirs } from './files.ts'
import type { ResolvedOptions, Violation } from './types.ts'

/**
 * Toda pasta de `src/pages` é uma tela e tem os arquivos obrigatórios (por padrão `index.tsx`,
 * `model.ts` e `view.tsx`). É a mesma regra do `prumo/page-structure` do ESLint, que só vê a
 * tela que já tem `index.tsx`; aqui a falta do próprio `index.tsx` também acusa. O
 * `skeleton.tsx` não é cobrado.
 */
export function checkPageStructure(options: ResolvedOptions): Violation[] {
  const pagesPath = path.join(options.root, options.pagesDir)
  return listDirs(pagesPath).flatMap((page) =>
    missingPageFiles(path.join(pagesPath, page), options.requiredPageFiles).map(
      (file): Violation => ({
        rule: 'page-structure',
        file: `${options.pagesDir}/${page}/${file}`,
        message: `A tela '${page}' precisa do arquivo '${file}' na própria pasta.`,
      }),
    ),
  )
}
