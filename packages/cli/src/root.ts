import { defineCommand } from 'citty'
import { createCheckCommand } from './commands/check.ts'
import { createDoctorCommand } from './commands/doctor.ts'
import { createMakeDomainCommand } from './commands/make-domain.ts'
import type { Runtime } from './runtime.ts'

/** A árvore de comandos do `prumo`. Cada comando novo entra em `subCommands`. */
export function createRoot(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'prumo',
      description: 'Prumo, a ferramenta da Matizze que cria e confere a arquitetura de apps React.',
    },
    subCommands: {
      check: createCheckCommand(runtime),
      doctor: createDoctorCommand(runtime),
      'make:domain': createMakeDomainCommand(runtime),
    },
  })
}
