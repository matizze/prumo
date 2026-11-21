import { defineCommand } from 'citty'
import { createCheckCommand } from './commands/check.ts'
import type { Runtime } from './runtime.ts'

/** A árvore de comandos do `prumo`. Cada comando novo entra em `subCommands`. */
export function createRoot(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'prumo',
      description:
        'Prumo, o framework React da Matizze: gera e confere projetos na arquitetura do Prumo.',
    },
    subCommands: {
      check: createCheckCommand(runtime),
    },
  })
}
