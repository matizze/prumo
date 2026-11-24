import { Command, CommanderError, Help, type Option } from 'commander'
import { commands as builtinCommands, type RegisterCommand } from './commands/index.ts'
import { ExitError, UsageError } from './errors.ts'
import type { Io } from './io.ts'
import { readVersion } from './lib/version.ts'

const NAME = 'prumo'
const DESCRIPTION =
  'Prumo, a ferramenta da Matizze que cria e confere a arquitetura de apps React.'

const TITLES: Record<string, string> = {
  'Usage:': 'Uso:',
  'Arguments:': 'Argumentos:',
  'Options:': 'Opções:',
  'Global Options:': 'Opções globais:',
  'Commands:': 'Comandos:',
}

/** O uso padrão do commander traz `[options]` e `[command]`: vira `[opções]` e `[comando]`. */
function portugueseUsage(text: string): string {
  return text.replaceAll('[options]', '[opções]').replaceAll('[command]', '[comando]')
}

/** A ajuda do commander com os títulos e as notas de opção (padrão, valores) em português. */
class PortugueseHelp extends Help {
  override styleTitle(title: string): string {
    return TITLES[title] ?? title
  }

  override commandUsage(cmd: Command): string {
    return portugueseUsage(super.commandUsage(cmd))
  }

  override subcommandTerm(cmd: Command): string {
    return portugueseUsage(super.subcommandTerm(cmd))
  }

  override optionDescription(option: Option): string {
    const notes: string[] = []
    if (option.argChoices) {
      notes.push(`valores: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(', ')}`)
    }
    if (option.defaultValue !== undefined) {
      const shown =
        option.required ||
        option.optional ||
        (option.isBoolean() && typeof option.defaultValue === 'boolean')
      if (shown) {
        notes.push(`padrão: ${option.defaultValueDescription ?? JSON.stringify(option.defaultValue)}`)
      }
    }
    return notes.length === 0
      ? option.description
      : `${option.description} (${notes.join(', ')})`.trim()
  }

  override argumentDescription(argument: Parameters<Help['argumentDescription']>[0]): string {
    const notes: string[] = []
    if (argument.argChoices) {
      notes.push(`valores: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(', ')}`)
    }
    if (argument.defaultValue !== undefined) {
      notes.push(`padrão: ${argument.defaultValueDescription ?? JSON.stringify(argument.defaultValue)}`)
    }
    return notes.length === 0
      ? argument.description
      : `${argument.description} (${notes.join(', ')})`.trim()
  }
}

/** Erro de uso achado pelo commander: leva o comando, para mostrar a ajuda dele. */
class ParseUsageError extends UsageError {
  readonly command: Command

  constructor(message: string, command: Command) {
    super(message)
    this.name = 'ParseUsageError'
    this.command = command
  }
}

/** A sugestão do commander (`\n(Did you mean x?)`) em português. */
function portugueseSuggestion(suggestion: string): string {
  const one = /^\n\(Did you mean (?:one of )?(.+)\?\)$/.exec(suggestion)
  return one ? ` Você quis dizer ${one[1]}?` : ''
}

/** Traduz a mensagem de erro do commander (em inglês, estável por `code`) para o português. */
function translate(message: string, code: string | undefined, command: Command): string {
  const text = message.replace(/^error: /, '')
  const [first = '', ...rest] = text.split('\n')
  const suggestion = portugueseSuggestion(rest.length > 0 ? `\n${rest.join('\n')}` : '')
  let match: RegExpExecArray | null
  switch (code) {
    case 'commander.unknownOption':
      match = /^unknown option '(.*)'$/.exec(first)
      return `opção desconhecida: '${match?.[1] ?? first}'.${suggestion}`
    case 'commander.unknownCommand':
      match = /^unknown command '(.*)'$/.exec(first)
      return `comando desconhecido: '${match?.[1] ?? first}'.${suggestion}`
    case 'commander.missingArgument':
      match = /^missing required argument '(.*)'$/.exec(first)
      return `falta o argumento <${match?.[1] ?? first}>.`
    case 'commander.optionMissingArgument':
      match = /^option '(.*)' argument missing$/.exec(first)
      return `a opção '${match?.[1] ?? first}' precisa de um valor.`
    case 'commander.missingMandatoryOptionValue':
      match = /^required option '(.*)' not specified$/.exec(first)
      return `a opção '${match?.[1] ?? first}' é obrigatória.`
    case 'commander.conflictingOption':
      match = /^(.*) cannot be used with (.*)$/.exec(first)
      return match
        ? `${inPortuguese(match[1] ?? '')} não pode ser usada com ${inPortuguese(match[2] ?? '')}.`
        : first
    case 'commander.excessArguments': {
      const extra = command.args.slice(command.registeredArguments.length)
      if (!command.parent && command.commands.length === 0) {
        // Sem nenhum subcomando registrado, o que sobra na raiz é um comando que não existe
        return `comando desconhecido: '${extra[0] ?? ''}'.`
      }
      const quoted = extra.map((value) => `'${value}'`).join(', ')
      return `${extra.length === 1 ? 'argumento a mais' : 'argumentos a mais'}: ${quoted}.`
    }
    case 'commander.invalidArgument': {
      const option = /^option '(.*)' argument '(.*)' is invalid\.(?: (.*))?$/s.exec(text)
      if (option) {
        return `valor inválido para a opção '${option[1]}': '${option[2]}'.${detail(option[3])}`
      }
      const argument =
        /^command-argument value '(.*)' is invalid for argument '(.*)'\.(?: (.*))?$/s.exec(text)
      if (argument) {
        return `valor inválido para o argumento <${argument[2]}>: '${argument[1]}'.${detail(argument[3])}`
      }
      return text
    }
    default:
      return text
  }
}

/** O motivo que a opção ou o argumento deu (o `choices` do commander escreve em inglês). */
function detail(reason: string | undefined): string {
  if (!reason) return ''
  const choices = /^Allowed choices are (.*)\.$/.exec(reason)
  return choices ? ` Valores aceitos: ${choices[1]}.` : ` ${reason}`
}

function inPortuguese(subject: string): string {
  return subject
    .replace(/^option '(.*)'$/, "a opção '$1'")
    .replace(/^environment variable '(.*)'$/, "a variável de ambiente '$1'")
}

/** O comando do programa: tudo o que se cria com `.command()` herda a ajuda em português e a tradução dos erros. */
class PrumoCommand extends Command {
  constructor(name?: string) {
    super(name)
    // O commander não herda isto nos subcomandos: sem o `help`, só o -h e o --help
    this.helpCommand(false)
  }

  override createCommand(name?: string): Command {
    return new PrumoCommand(name)
  }

  override createHelp(): Help {
    return Object.assign(new PortugueseHelp(), this.configureHelp())
  }

  /** O commander chama este método em todo erro de uso: vira um `UsageError` em português, sem sair do processo. */
  override error(message: string, errorOptions?: { code?: string; exitCode?: number }): never {
    throw new ParseUsageError(translate(message, errorOptions?.code, this), this)
  }
}

/** Monta o programa `prumo` com os comandos. Os testes passam comandos de mentira em `commands`. */
export function createProgram(io: Io, commands: readonly RegisterCommand[] = builtinCommands): Command {
  const program = new PrumoCommand(NAME)
  program
    .description(DESCRIPTION)
    .version(readVersion(), '-v, --version', 'Mostra a versão.')
    .helpOption('-h, --help', 'Mostra esta ajuda.')
    .showSuggestionAfterError(true)
    .exitOverride()
    .configureOutput({
      writeOut: io.out,
      writeErr: io.err,
      getOutHelpWidth: () => io.columns ?? 80,
      getErrHelpWidth: () => io.columns ?? 80,
      getOutHasColors: () => false,
      getErrHasColors: () => false,
    })
  for (const register of commands) register(program, io)
  return program
}

/**
 * Roda o prumo com os argumentos (sem o `node` e o script) e devolve o código de saída; nunca encerra o
 * processo. 0: sem erro (inclusive `--help`, `--version` e nenhum argumento, que mostra a ajuda); 2: uso
 * errado; 1: erro inesperado; ou o código de um `ExitError`.
 */
export async function run(
  argv: readonly string[],
  io: Io,
  commands: readonly RegisterCommand[] = builtinCommands,
): Promise<number> {
  // O comando que está rodando, para mostrar a ajuda dele num UsageError (inclusive o lançado pelo
  // parser de uma opção ou argumento, que roda antes da ação)
  let current: Command | undefined
  const usage = (message: string, command: Command): number => {
    io.err(`${NAME}: ${message}\n\n${command.helpInformation({ error: true })}`)
    return 2
  }

  try {
    const program = createProgram(io, commands)
    current = program
    if (argv.length === 0) {
      io.out(program.helpInformation())
      return 0
    }
    // O preSubcommand roda antes do parse das opções do subcomando; vale para cada nível da árvore
    const track = (command: Command): void => {
      command.hook('preSubcommand', (_command, subcommand) => {
        current = subcommand
      })
      command.commands.forEach(track)
    }
    track(program)
    program.hook('preAction', (_command, action) => {
      current = action
    })
    await program.parseAsync([...argv], { from: 'user' })
    return 0
  } catch (error) {
    if (error instanceof ParseUsageError) return usage(error.message, error.command)
    if (error instanceof UsageError && current) return usage(error.message, current)
    if (error instanceof ExitError) {
      if (error.message) io.err(`${error.message}\n`)
      return error.code
    }
    if (error instanceof CommanderError) {
      // --help e --version: o commander já escreveu e pede saída 0
      if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
        return error.exitCode
      }
      // Comando com subcomandos chamado sem nenhum: o commander já mostrou a ajuda no stderr
      if (error.code === 'commander.help') return 2
    }
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
    io.err(`${NAME}: erro inesperado.\n${detail}\n`)
    return 1
  }
}
