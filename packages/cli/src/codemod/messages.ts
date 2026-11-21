import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { UsageError } from '../errors.ts'
import type { Project } from '../project.ts'
import type { ChangePlan } from './plan.ts'

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

/** Os caminhos de um objeto de mensagens, folhas e grupos, em notação de ponto: `a`, `a.b`. */
function keyPaths(value: unknown, prefix: string, into: Set<string>): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return
  for (const [key, child] of Object.entries(value)) {
    const full = `${prefix}.${key}`
    into.add(full)
    keyPaths(child, full, into)
  }
}

/**
 * As chaves completas das mensagens de uma tela (`fileManager.renameDialog.required`), do JSON de
 * `src/messages/<idioma>/<arquivo>.json` em todos os idiomas do projeto: a união das chaves de
 * cada um, com o namespace (`camel`) na frente. Conta o grupo (`fileManager.renameDialog`) e a
 * mensagem. Idioma sem o arquivo não conta; JSON inválido: `UsageError`.
 */
export function messageKeys(plan: ChangePlan, file: string, camel: string): Set<string> {
  const keys = new Set<string>()
  for (const language of messageLanguages(plan.project)) {
    const json = path.join(plan.project.messages, language, `${file}.json`)
    if (!plan.hasFile(json)) continue
    try {
      keyPaths(JSON.parse(plan.readText(json)), camel, keys)
    } catch {
      throw new UsageError(`src/messages/${language}/${file}.json não é um JSON válido.`)
    }
  }
  return keys
}
