import path from 'node:path'
import { normalizeAlias, toPosix, trimSlashes } from '../eslint/paths.ts'
import type { CheckOptions, ResolvedOptions } from './types.ts'

const DEFAULTS = {
  alias: '@/',
  aliasRoot: 'src',
  pagesDir: 'src/pages',
  requiredPageFiles: ['index.tsx', 'model.ts', 'view.tsx'],
  useCasesDir: 'src/use-cases',
  componentsDir: 'src/components',
  allowedComponentDirs: ['layout', 'shared', 'ui'],
  sharedDir: 'src/components/shared',
  layoutDir: 'src/components/layout',
  messagesDir: 'src/messages',
  locales: ['pt-BR', 'en'],
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
    useCasesDir: trimSlashes(merged.useCasesDir),
    componentsDir: trimSlashes(merged.componentsDir),
    sharedDir: trimSlashes(merged.sharedDir),
    layoutDir: trimSlashes(merged.layoutDir),
    messagesDir: trimSlashes(merged.messagesDir),
  }
}
