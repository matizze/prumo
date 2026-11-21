import path from 'node:path'
import type { Rule } from 'eslint'
import { DEFAULT_PAGE_FILES, missingPageFiles } from '../../page-structure.ts'
import { locateInside, trimSlashes } from '../paths.ts'

export interface PageStructureOptions {
  /** Pasta das telas, relativa ao projeto. Cada subpasta é uma tela. Padrão: `'src/pages'`. */
  pagesDir?: string
  /** Arquivos que a tela tem ao lado do `index.tsx`. Padrão: `['model.ts', 'view.tsx']`. */
  requiredFiles?: string[]
}

const DEFAULTS = { pagesDir: 'src/pages', requiredFiles: DEFAULT_PAGE_FILES }

/**
 * Estrutura da página: o `index.tsx` de `src/pages/<tela>/` tem ao lado o `model.ts` e a
 * `view.tsx`, a separação entre dados e visual. A regra olha a pasta pelo sistema de arquivos,
 * então avisa no editor quando a tela fica sem um deles. O `skeleton.tsx` não é cobrado.
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
    // Só o index.tsx da própria tela: subpastas da tela e arquivos soltos em pages/ ficam de fora
    if (!placement || placement.inner.split('/').length !== 2) return {}
    if (placement.inner.split('/')[1] !== 'index.tsx') return {}

    const page = placement.inner.split('/')[0]!
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
