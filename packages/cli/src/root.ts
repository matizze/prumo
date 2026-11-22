import { defineCommand } from 'citty'
import { createAddCommand } from './commands/add.ts'
import { createAgentsCommand } from './commands/agents.ts'
import { createCatalogCommand } from './commands/catalog.ts'
import { createCheckCommand } from './commands/check.ts'
import { createDoctorCommand } from './commands/doctor.ts'
import { createMakeComponentCommand } from './commands/make-component.ts'
import { createMakeDomainCommand } from './commands/make-domain.ts'
import { createMakePageCommand } from './commands/make-page.ts'
import { createNewCommand } from './commands/new.ts'
import { createPatternsCommand } from './commands/patterns.ts'
import { createPromoteCommand } from './commands/promote.ts'
import type { AnyCommand } from './help.ts'
import type { Runtime } from './runtime.ts'

/** A árvore de comandos do `prumo`. Cada comando novo entra em `subCommands`. */
export function createRoot(runtime: Runtime) {
  // O `check` e o `agents` leem a árvore (para o nome das ferramentas e das seções geradas), e ela
  // só existe depois de montada: eles a recebem por função
  const tree = (): AnyCommand => root
  const root = defineCommand({
    meta: {
      name: 'prumo',
      description:
        'Prumo, o framework React da Matizze: gera e confere projetos na arquitetura do Prumo.',
    },
    subCommands: {
      add: createAddCommand(runtime, tree),
      agents: createAgentsCommand(runtime, tree),
      catalog: createCatalogCommand(runtime),
      check: createCheckCommand(runtime, tree),
      doctor: createDoctorCommand(runtime),
      'make:component': createMakeComponentCommand(runtime, tree),
      'make:domain': createMakeDomainCommand(runtime, tree),
      'make:page': createMakePageCommand(runtime, tree),
      new: createNewCommand(runtime),
      patterns: createPatternsCommand(runtime),
      promote: createPromoteCommand(runtime, tree),
    },
  })
  return root
}
