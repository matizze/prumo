import path from 'node:path'
import type { Rule } from 'eslint'
import { importListener, locateInside, normalizeAlias, resolveSpecifier, trimSlashes } from '../paths.ts'

export interface NoHttpInPageOptions {
  /** Alias de import que aponta para `aliasRoot`. Padrão: `'@/'`. */
  alias?: string
  /** Pasta para onde o alias aponta, relativa ao projeto. Padrão: `'src'`. */
  aliasRoot?: string
  /** Pasta das telas, relativa ao projeto. Padrão: `'src/pages'`. */
  pagesDir?: string
  /** Pasta da infra de rede, relativa ao projeto. Padrão: `'src/http'`. */
  httpDir?: string
}

const DEFAULTS = { alias: '@/', aliasRoot: 'src', pagesDir: 'src/pages', httpDir: 'src/http' }

/**
 * A tela não fala com a rede: um arquivo de `src/pages` não importa de `src/http`, pelo alias nem
 * por caminho relativo. Quem usa o `http` é o use case, e a tela chama o use case.
 */
export const noHttpInPage: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Uma tela não importa de src/http: ela chama um use case.' },
    schema: [
      {
        type: 'object',
        properties: {
          alias: { type: 'string' },
          aliasRoot: { type: 'string' },
          pagesDir: { type: 'string' },
          httpDir: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      httpInPage:
        "A tela não importa de '{{httpDir}}' ('{{specifier}}'): ela chama um use case, e é o use case que usa o http.",
    },
  },
  create(context) {
    const options = { ...DEFAULTS, ...(context.options[0] as NoHttpInPageOptions | undefined) }
    const httpDir = trimSlashes(options.httpDir)
    const placement = locateInside(context.filename, trimSlashes(options.pagesDir))
    if (!placement) return {}

    const { root } = placement
    const httpPath = path.posix.join(root, httpDir)
    const alias = normalizeAlias(options.alias)

    return importListener((node, specifier) => {
      const resolved = resolveSpecifier(specifier, {
        filename: context.filename,
        root,
        alias,
        aliasRoot: options.aliasRoot,
      })
      if (resolved && (resolved.target === httpPath || resolved.target.startsWith(`${httpPath}/`))) {
        context.report({ node, messageId: 'httpInPage', data: { httpDir, specifier } })
      }
    })
  },
}
