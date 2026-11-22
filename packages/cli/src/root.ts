import { defineCommand } from 'citty'
import { createAddCommand } from './commands/add.ts'
import { createCheckCommand } from './commands/check.ts'
import { createMakeComponentCommand } from './commands/make-component.ts'
import { createMakeDomainCommand } from './commands/make-domain.ts'
import { createMakePageCommand } from './commands/make-page.ts'
import { createPromoteCommand } from './commands/promote.ts'
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
      add: createAddCommand(runtime),
      check: createCheckCommand(runtime),
      'make:component': createMakeComponentCommand(runtime),
      'make:domain': createMakeDomainCommand(runtime),
      'make:page': createMakePageCommand(runtime),
      promote: createPromoteCommand(runtime),
    },
  })
}
