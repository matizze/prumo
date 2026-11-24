import { check, type Violation } from '@matizze/prumo-rules/check'
import { ExitError } from '../errors.ts'
import { locateProject, ROOT_OPTION_DESCRIPTION } from '../lib/project.ts'
import { addExamples } from './help-text.ts'
import type { RegisterCommand } from './index.ts'

/** Uma linha por violação: o arquivo, a regra e o que está errado. */
export function formatViolation({ file, rule, message }: Violation): string {
  return `${file}  [${rule}]  ${message}`
}

/**
 * `prumo check`: analisa o projeto e escreve cada violação com o arquivo e a regra. Sai com 0 sem
 * violação, com 1 com violação e com 2 se a pasta não é um projeto (o `findProject` confere): sem
 * essa conferência, a análise de uma pasta errada não acharia nada e sairia verde.
 */
export const registerCheck: RegisterCommand = (program, io) => {
  const command = program
    .command('check')
    .summary('Analisa o projeto e lista as violações da arquitetura.')
    .description(
        'Analisa o projeto e lista as violações da arquitetura.\n\nSai com 0 sem violação e com 1 quando há violação.',
      )
    .option('--root <pasta>', ROOT_OPTION_DESCRIPTION)
    .action((options: { root?: string }) => {
      const project = locateProject(io.cwd, options.root)
      const violations = check({ root: project.root })
      if (violations.length === 0) {
        io.out('prumo check: nenhuma violação.\n')
        return
      }
      const lines = violations.map(formatViolation).join('\n')
      const total = violations.length === 1 ? '1 violação' : `${violations.length} violações`
      io.err(`${lines}\n\nprumo check: ${total}.\n`)
      throw new ExitError(1)
    })
  addExamples(
    command,
    [
      'prumo check',
      'prumo check --root ../meu-app',
    ],
    'prumo-check',
  )
}
