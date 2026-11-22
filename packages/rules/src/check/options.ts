import path from 'node:path'
import { normalizeAlias, toPosix, trimSlashes } from '../eslint/paths.ts'
import type { CheckOptions, ResolvedOptions } from './types.ts'

const DEFAULTS = {
  alias: '@/',
  aliasRoot: 'src',
  pagesDir: 'src/pages',
  requiredPageFiles: ['index.tsx', 'model.ts', 'view.tsx'],
  componentsDir: 'src/components',
  allowedComponentDirs: ['layout', 'shared', 'ui'],
  sharedDir: 'src/components/shared',
  layoutDir: 'src/components/layout',
  messagesDir: 'src/messages',
  locales: ['pt-BR', 'en'],
  referenceFiles: ['AGENTS.md', 'docs/patterns.md'],
}

/** Aplica os padrões e normaliza os caminhos: a raiz fica absoluta e as pastas, sem barras nas pontas. */
export function resolveOptions(options: CheckOptions): ResolvedOptions {
  const merged = { ...DEFAULTS, ...options }
  return {
    ...merged,
    root: toPosix(path.resolve(options.root)),
    alias: normalizeAlias(merged.alias),
    aliasRoot: trimSlashes(merged.aliasRoot),
    pagesDir: trimSlashes(merged.pagesDir),
    componentsDir: trimSlashes(merged.componentsDir),
    sharedDir: trimSlashes(merged.sharedDir),
    layoutDir: trimSlashes(merged.layoutDir),
    messagesDir: trimSlashes(merged.messagesDir),
  }
}
