import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { UsageError } from '../errors.ts'
import type { Project } from '../project.ts'

/** Os idiomas do projeto: as pastas de `src/messages` que têm `index.ts`, em ordem. */
export function messageLanguages(project: Project): string[] {
  if (!existsSync(project.messages)) throw new UsageError('o projeto não tem src/messages.')
  const languages = readdirSync(project.messages, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(path.join(project.messages, entry.name, 'index.ts')),
    )
    .map((entry) => entry.name)
    .sort()
  if (languages.length === 0) throw new UsageError('o projeto não tem idioma em src/messages.')
  return languages
}
