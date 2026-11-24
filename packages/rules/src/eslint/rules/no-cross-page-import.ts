import path from 'node:path'
import type { Rule } from 'eslint'
import { pageOf } from '../../page-structure.ts'
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
  /** Pasta das telas, relativa ao projeto. Tela é a pasta com `index.tsx`, em qualquer profundidade. Padrão: `'src/pages'`. */
  pagesDir?: string
}

const DEFAULTS = { alias: '@/', aliasRoot: 'src', pagesDir: 'src/pages' }

/**
 * Telas isoladas: um arquivo de uma tela (`src/pages/livros/` ou `src/pages/auth/login/`) não
 * importa de outra (`src/pages/auth/register/`), nem pelo alias nem por caminho relativo. A tela é
 * a primeira pasta, a partir de `src/pages`, que tem `index.tsx`; a pasta sem ele só agrupa telas.
 * O que duas telas usam em comum vai para a pasta de componentes compartilhados.
 *
 * O arquivo solto em `src/pages/` ou numa pasta de grupo (`auth/shared.ts`) não é de tela, e a
 * regra não o olha; importá-lo de uma tela também é recusado, e ele vai para os componentes
 * compartilhados. A pasta sem `index.tsx` e sem tela dentro (`rascunho`) conta como tela, como no
 * `prumo check`.
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
      looseFile:
        "A tela '{{page}}' não importa o arquivo solto '{{target}}' de uma pasta de telas ('{{specifier}}'): o que é de mais de uma tela vai para a pasta de componentes compartilhados.",
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
    if (!placement) return {}

    const { root } = placement
    const pagesPath = path.posix.join(root, pagesDir)
    // Só vale para arquivo dentro de uma tela, não para o que está solto em pages/ ou num grupo
    const page = pageOf(pagesPath, placement.inner)
    if (!page) return {}

    const alias = normalizeAlias(options.alias)

    return importListener((node, specifier) => {
      const resolved = resolveSpecifier(specifier, {
        filename: context.filename,
        root,
        alias,
        aliasRoot: options.aliasRoot,
      })
      if (!resolved?.target.startsWith(`${pagesPath}/`)) return

      const target = resolved.target.slice(pagesPath.length + 1)
      const other = pageOf(pagesPath, target)
      if (!other) {
        context.report({ node, messageId: 'looseFile', data: { page, target, specifier } })
      } else if (other !== page) {
        context.report({ node, messageId: 'crossPage', data: { page, other, specifier } })
      }
    })
  },
}
