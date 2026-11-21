import { runCommand } from 'citty'
import { validateArgs } from './args.ts'
import { ExitError, UsageError } from './errors.ts'
import { renderHelp, resolveValue, type AnyCommand } from './help.ts'
import type { Runtime } from './runtime.ts'

const HELP_FLAGS = new Set(['--help', '-h'])

/** O comando que os argumentos escolhem, o caminho até ele e o que sobra para ele. */
interface Located {
  command: AnyCommand
  path: string[]
  rest: string[]
  /** Por que não achou o comando: nome ou opção que o grupo de comandos não conhece. */
  problem?: string
}

/**
 * Acha o comando que os argumentos escolhem, descendo pelos subcomandos. Para no primeiro
 * comando sem subcomandos, ou no grupo se ainda não há nome de comando nem pedido de ajuda.
 */
async function locate(root: AnyCommand, rawArgs: string[], name: string): Promise<Located> {
  let command = root
  let path = [name]
  let rest = rawArgs
  for (;;) {
    const subCommands = await resolveValue(command.subCommands ?? {})
    if (Object.keys(subCommands).length === 0) return { command, path, rest }

    const [first, ...others] = rest
    if (first === undefined || HELP_FLAGS.has(first)) return { command, path, rest }
    if (first.startsWith('-')) {
      return { command, path, rest, problem: `opção desconhecida: '${first}'.` }
    }
    const next = subCommands[first]
    if (!next) return { command, path, rest, problem: `comando desconhecido: '${first}'.` }
    command = await resolveValue(next)
    path = [...path, first]
    rest = others
  }
}

/**
 * Roda a árvore de comandos e devolve o código de saída, sem encerrar o processo (o bin faz isso).
 * O `runMain` do citty não serve de porta de entrada: ele sai com 1 em qualquer erro e escreve a
 * ajuda e os erros em inglês, e o `prumo` precisa de 2 para uso errado. Por isso a rota é esta:
 * acha o comando, mostra a ajuda se pediram, confere os argumentos e entrega ao `runCommand`.
 *
 * Códigos: 0 sem erro, o código do `ExitError` que o comando lançar (1 para o `check` com
 * violação), 2 para uso errado (comando ou opção desconhecidos, argumento errado) e 1 para um erro
 * inesperado.
 */
export async function runCli(
  root: AnyCommand,
  rawArgs: string[],
  io: Pick<Runtime, 'out' | 'err'>,
): Promise<number> {
  const rootMeta = await resolveValue(root.meta ?? {})
  const { command, path, rest, problem } = await locate(root, rawArgs, rootMeta.name ?? 'prumo')
  const help = () => renderHelp(command, path)
  const isGroup = Object.keys(await resolveValue(command.subCommands ?? {})).length > 0

  if (problem) {
    io.err(`${path.join(' ')}: ${problem}\n\n${await help()}\n`)
    return 2
  }
  const upToDash = rest.slice(0, rest.indexOf('--') === -1 ? undefined : rest.indexOf('--'))
  if (isGroup || upToDash.some((arg) => HELP_FLAGS.has(arg))) {
    io.out(`${await help()}\n`)
    return 0
  }

  try {
    validateArgs(await resolveValue(command.args ?? {}), rest)
    await runCommand(root, { rawArgs })
    return 0
  } catch (error) {
    if (error instanceof ExitError) {
      if (error.message) {
        const usage = error instanceof UsageError ? `\n${await help()}\n` : ''
        io.err(`${path.join(' ')}: ${error.message}\n${usage}`)
      }
      return error.code
    }
    io.err(
      `${path.join(' ')}: erro inesperado.\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    )
    return 1
  }
}
