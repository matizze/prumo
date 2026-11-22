import { defineCommand } from 'citty'
import path from 'node:path'
import { checkProject, type ProjectViolation } from '../agents/check.ts'
import { ExitError } from '../errors.ts'
import type { CommandTree } from '../help.ts'
import { findProject } from '../project.ts'
import type { Runtime } from '../runtime.ts'

/** Uma linha por violação: o arquivo, a regra e o que está errado. */
export function formatViolation({ file, rule, message }: ProjectViolation): string {
  return `${file}  [${rule}]  ${message}`
}

/**
 * `prumo check`: analisa o projeto e escreve cada violação com o arquivo e a regra. Sai com 0 sem
 * violação, com 1 com violação e com 2 se a raiz não é um projeto (o `findProject` confere): sem
 * essa conferência, a análise de uma pasta errada não acharia nada e sairia verde.
 */
export function createCheckCommand(runtime: Runtime, tree: CommandTree) {
  return defineCommand({
    meta: {
      name: 'check',
      description: `Analisa o projeto e lista as violações da arquitetura.

Confere as pastas de src/components, o uso de components/shared pelas telas, a estrutura de cada
tela, os textos completos nos idiomas, o que o AGENTS.md (e o docs/patterns.md) cita entre crases
(caminho, rota, story e item do registry que não existe) e as seções geradas do AGENTS.md (regra
agents: uma seção velha pede pnpm exec prumo agents).

Sai com código 1 quando há violação, e com 2 quando o uso está errado ou a pasta do projeto não
existe ou não tem package.json e src.`,
    },
    args: {
      root: {
        type: 'string',
        valueHint: 'pasta',
        description: 'Pasta do projeto, a que tem o src. Padrão: a pasta atual.',
      },
    },
    async run({ args }) {
      const project = findProject(path.resolve(runtime.cwd, args.root ?? '.'))
      const violations = await checkProject(project.root, tree)
      if (violations.length === 0) {
        runtime.out('prumo check: nenhuma violação.\n')
        return
      }
      const lines = violations.map(formatViolation).join('\n')
      const total = violations.length === 1 ? '1 violação' : `${violations.length} violações`
      runtime.err(`${lines}\n\nprumo check: ${total}.\n`)
      throw new ExitError(1)
    },
  })
}
