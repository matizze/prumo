import type { Command } from 'commander'

/** O endereço do site da documentação. */
export const DOCS_URL = 'https://docs.prumo.matizze.com.br'

/**
 * A seção `Exemplos:` e a linha `Referência:` no fim da ajuda de um comando; `anchor` é o id do título
 * dele em `docs/reference/cli.md`. O texto de `notes` entra entre as duas, sem quebra de linha (o
 * commander só quebra a descrição, não o `addHelpText`).
 */
export function addExamples(
  command: Command,
  examples: readonly string[],
  anchor: string,
  notes?: string,
): Command {
  const lines = examples.map((example) => `  ${example}`).join('\n')
  const extra = notes === undefined ? '' : `\n${notes}\n`
  return command.addHelpText(
    'after',
    `\nExemplos:\n${lines}\n${extra}\nReferência: ${DOCS_URL}/reference/cli#${anchor}\n`,
  )
}
