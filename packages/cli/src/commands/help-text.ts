import type { Command } from 'commander'

/** O endereço do site da documentação. */
export const DOCS_URL = 'https://docs.prumo.matizze.com.br'

/** O que cada comando escreve a mais na ajuda, e o que o agente (a ferramenta MCP) lê. */
export type CommandDocs = {
  /** Os usos reais, uma linha cada, para a seção `Exemplos:`. */
  examples: readonly string[]
  /** O id do título do comando em `docs/reference/cli.md`, para a linha `Referência:`. */
  anchor: string
  /** Um texto entre os exemplos e a referência, sem quebra de linha (o commander só quebra a descrição, não o `addHelpText`). */
  notes?: string
  /** O detalhe que só a ferramenta MCP mostra: o agente não tem o terminal nem a documentação à mão. */
  agentDetail?: string
}

const documented = new WeakMap<Command, CommandDocs>()

function referenceOf(anchor: string): string {
  return `Referência: ${DOCS_URL}/reference/cli#${anchor}`
}

/** Acrescenta os `Exemplos:` e a `Referência:` ao fim da ajuda do comando e guarda o detalhe do agente. */
export function documentCommand(command: Command, docs: CommandDocs): Command {
  documented.set(command, docs)
  const lines = docs.examples.map((example) => `  ${example}`).join('\n')
  const notes = docs.notes === undefined ? '' : `\n${docs.notes}\n`
  // O commander termina o texto com a quebra de linha
  return command.addHelpText('after', `\nExemplos:\n${lines}\n${notes}\n${referenceOf(docs.anchor)}`)
}

/** A descrição da ferramenta MCP do comando: o resumo, o detalhe e a referência; `undefined` se o comando não tem detalhe. */
export function agentDescription(command: Command): string | undefined {
  const docs = documented.get(command)
  if (docs?.agentDetail === undefined) return undefined
  return `${command.summary()}\n\n${docs.agentDetail}\n\n${referenceOf(docs.anchor)}`
}
