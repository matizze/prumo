import path from 'node:path'
import type { Rule } from 'eslint'
import { importListener, locateInside, normalizeAlias, resolveSpecifier, trimSlashes } from '../paths.ts'

export interface UseCaseImportsOptions {
  /** Alias de import que aponta para `aliasRoot`. Padrão: `'@/'`. */
  alias?: string
  /** Pasta para onde o alias aponta, relativa ao projeto. Padrão: `'src'`. */
  aliasRoot?: string
  /** Pasta das telas, relativa ao projeto. Padrão: `'src/pages'`. */
  pagesDir?: string
  /** Pasta dos use cases, relativa ao projeto. Padrão: `'src/use-cases'`. */
  useCasesDir?: string
}

const DEFAULTS = {
  alias: '@/',
  aliasRoot: 'src',
  pagesDir: 'src/pages',
  useCasesDir: 'src/use-cases',
}

/** `react` (e `react/jsx-runtime`) e os pacotes `@tanstack/*`: a camada de interface e de cache. */
function uiPackageOf(specifier: string): string | undefined {
  if (specifier === 'react' || specifier.startsWith('react/')) return 'react'
  if (specifier.startsWith('@tanstack/')) return '@tanstack'
  return undefined
}

/**
 * O use case não olha para cima: um arquivo de `src/use-cases` não importa de `src/pages`, de
 * `react` nem de `@tanstack/*`. Ele é código de domínio, que usa o `http`, o `storage` ou outros
 * use cases; quem usa React e o cache é a tela.
 */
export const useCaseImports: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Um use case não importa de src/pages, de react nem de @tanstack/*.' },
    schema: [
      {
        type: 'object',
        properties: {
          alias: { type: 'string' },
          aliasRoot: { type: 'string' },
          pagesDir: { type: 'string' },
          useCasesDir: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      page: "O use case não importa de uma tela ('{{specifier}}'): a tela chama o use case, e nada aponta para cima.",
      ui: "O use case não importa de '{{package}}' ('{{specifier}}'): ele não depende de React nem do cache; isso é da tela.",
    },
  },
  create(context) {
    const options = { ...DEFAULTS, ...(context.options[0] as UseCaseImportsOptions | undefined) }
    const placement = locateInside(context.filename, trimSlashes(options.useCasesDir))
    if (!placement) return {}

    const { root } = placement
    const pagesPath = path.posix.join(root, trimSlashes(options.pagesDir))
    const alias = normalizeAlias(options.alias)

    return importListener((node, specifier) => {
      const library = uiPackageOf(specifier)
      if (library) {
        context.report({ node, messageId: 'ui', data: { package: library, specifier } })
        return
      }
      const resolved = resolveSpecifier(specifier, {
        filename: context.filename,
        root,
        alias,
        aliasRoot: options.aliasRoot,
      })
      if (resolved && (resolved.target === pagesPath || resolved.target.startsWith(`${pagesPath}/`))) {
        context.report({ node, messageId: 'page', data: { specifier } })
      }
    })
  },
}
