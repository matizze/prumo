import path from 'node:path'
import { check, type Violation } from '@matizze/prumo-rules/check'
import { ExitError, UsageError } from '../errors.ts'
import { findProject } from '../lib/project.ts'
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
  program
    .command('check')
    .summary('Analisa o projeto e lista as violações da arquitetura.')
    .description(
      `Analisa o projeto e lista as violações da arquitetura.

Confere as pastas de src/components, o uso de components/shared pelas telas, a estrutura de cada tela e os textos completos nos idiomas. Escreve uma violação por linha (arquivo, regra e mensagem).

Sai com 0 sem violação, com 1 quando há violação e com 2 quando a pasta não é um projeto (sem package.json e src).`,
    )
    .option('--root <pasta>', 'A pasta do projeto, a que tem o src.', '.')
    .action((options: { root: string }) => {
      if (options.root === '') throw new UsageError("a opção '--root' precisa de um valor.")
      const project = findProject(path.resolve(io.cwd, options.root))
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
}
