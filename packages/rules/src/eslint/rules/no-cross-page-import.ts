import path from 'node:path'
import type { Rule } from 'eslint'
import {
  importListener,
  locateInside,
  normalizeAlias,
  resolveSpecifier,
  trimSlashes,
} from '../paths.ts'

export interface NoCrossPageImportOptions {
  /** Alias de import que aponta para `aliasRoot`. Padrão: `'@/'`. */
  alias?: string
  /** Pasta para onde o alias aponta, relativa ao projeto. Padrão: `'src'`. */
  aliasRoot?: string
  /** Pasta das telas, relativa ao projeto. Cada subpasta é uma tela. Padrão: `'src/pages'`. */
  pagesDir?: string
}

const DEFAULTS = { alias: '@/', aliasRoot: 'src', pagesDir: 'src/pages' }

/**
 * Telas isoladas: um arquivo de `src/pages/<tela>/` não importa de `src/pages/<outra>/`, nem
 * pelo alias nem por caminho relativo. O que duas telas usam em comum vai para a pasta de
 * componentes compartilhados. A regra só precisa do caminho do arquivo e do caminho do import.
 */
export const noCrossPageImport: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Uma tela não importa da pasta de outra tela.' },
    schema: [
      {
        type: 'object',
        properties: {
          alias: { type: 'string' },
          aliasRoot: { type: 'string' },
          pagesDir: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      crossPage:
        "A tela '{{page}}' não importa da pasta da tela '{{other}}' ('{{specifier}}'): o que as duas usam vai para a pasta de componentes compartilhados.",
    },
  },
  create(context) {
    const options = {
      ...DEFAULTS,
      ...(context.options[0] as NoCrossPageImportOptions | undefined),
    }
    const pagesDir = trimSlashes(options.pagesDir)
    const placement = locateInside(context.filename, pagesDir)
    // Só vale para arquivo dentro da pasta de uma tela, não para o que está solto em pages/
    if (!placement || !placement.inner.includes('/')) return {}

    const { root } = placement
    const page = placement.inner.split('/')[0]
    const alias = normalizeAlias(options.alias)
    const pagesPath = path.posix.join(root, pagesDir)

    return importListener((node, specifier) => {
      const resolved = resolveSpecifier(specifier, {
        filename: context.filename,
        root,
        alias,
        aliasRoot: options.aliasRoot,
      })
      if (!resolved?.target.startsWith(`${pagesPath}/`)) return

      const other = resolved.target.slice(pagesPath.length + 1).split('/')[0]
      if (other !== page) {
        context.report({ node, messageId: 'crossPage', data: { page, other, specifier } })
      }
    })
  },
}
