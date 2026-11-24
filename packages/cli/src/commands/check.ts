import { check, type Violation } from '@matizze/prumo-rules/check'
import { ExitError } from '../errors.ts'
import { locateProject } from '../lib/project.ts'
import { documentCommand } from './help-text.ts'
import { ROOT_OPTION } from './shared.ts'
import type { RegisterCommand } from './index.ts'

/** Uma linha por violação: o arquivo, a regra e o que está errado. */
export function formatViolation({ file, rule, message }: Violation): string {
  return `${file}  [${rule}]  ${message}`
}

/**
 * `prumo check`: analisa o projeto e escreve cada violação com o arquivo e a regra. Sai com 0 sem
 * violação, com 1 com violação e com 2 se não acha um projeto (o `locateProject` confere): sem
 * essa conferência, a análise de uma pasta errada não acharia nada e sairia verde.
 */
export const registerCheck: RegisterCommand = (program, io) => {
  const command = program
    .command('check')
    .summary('Analisa o projeto e lista as violações da arquitetura.')
    .description(
      'Analisa o projeto e lista as violações da arquitetura.\n\nSai com 0 sem violação e com 1 quando há violação.',
    )
    .option(...ROOT_OPTION)
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
  documentCommand(command, {
    examples: [
      'prumo check',
      'prumo check --root ../meu-app',
    ],
    anchor: 'prumo-check',
    agentDetail:
      "Confere as pastas de src/components (só as permitidas), o uso de components/shared pelas telas, a estrutura de cada tela (index, model e view) e os textos completos nos idiomas (as mesmas chaves em todos, e os placeholders ICU iguais). Escreve uma violação por linha: o arquivo, a regra entre colchetes e a mensagem. Só lê; nunca escreve.\n\nCom violação, o código de saída é 1, mas o resultado da ferramenta não é erro: as violações vêm no texto, para você corrigir e rodar de novo. Sem violação, diz que não há nenhuma.",
  })
}
