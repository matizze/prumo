import path from 'node:path'
import type { Rule } from 'eslint'
import { DEFAULT_PAGE_FILES, missingPageFiles, pageOf } from '../../page-structure.ts'
import { locateInside, trimSlashes } from '../paths.ts'

export interface PageStructureOptions {
  /** Pasta das telas, relativa ao projeto. Tela é a pasta com `index.tsx`, em qualquer profundidade. Padrão: `'src/pages'`. */
  pagesDir?: string
  /** Arquivos que a tela tem ao lado do `index.tsx`. Padrão: `['model.ts', 'view.tsx']`. */
  requiredFiles?: string[]
}

const DEFAULTS = { pagesDir: 'src/pages', requiredFiles: DEFAULT_PAGE_FILES }

/**
 * Estrutura da página: o `index.tsx` de uma tela (`src/pages/livros/` ou `src/pages/auth/login/`) tem ao lado o `model.ts` e a
 * `view.tsx`, a separação entre dados e visual. A regra olha a pasta pelo sistema de arquivos,
 * então avisa no editor quando a tela fica sem um deles.
 */
export const pageStructure: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Toda tela tem index.tsx, model.ts e view.tsx na mesma pasta.' },
    schema: [
      {
        type: 'object',
        properties: {
          pagesDir: { type: 'string' },
          requiredFiles: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingFile:
        "A tela '{{page}}' precisa do arquivo '{{file}}' ao lado do index.tsx ({{pagesDir}}/{{page}}/{{file}}).",
    },
  },
  create(context) {
    const options = { ...DEFAULTS, ...(context.options[0] as PageStructureOptions | undefined) }
    const pagesDir = trimSlashes(options.pagesDir)
    const placement = locateInside(context.filename, pagesDir)
    if (!placement || path.posix.basename(placement.inner) !== 'index.tsx') return {}
    // Só o index.tsx da própria tela: o de uma subpasta da tela (`components/index.tsx`) e o solto
    // em pages/ ficam de fora
    const page = path.posix.dirname(placement.inner)
    if (pageOf(path.join(placement.root, pagesDir), page) !== page) return {}

    return {
      Program(node) {
        for (const file of missingPageFiles(
          path.dirname(context.filename),
          options.requiredFiles,
        )) {
          context.report({ node, messageId: 'missingFile', data: { page, file, pagesDir } })
        }
      },
    }
  },
}
