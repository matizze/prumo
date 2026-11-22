import type { ArgDef, ArgsDef } from 'citty'
import { UsageError } from './errors.ts'
import {
  aliasesOf,
  isRequired,
  isVariadic,
  resolveValue,
  summary,
  type AnyCommand,
} from './help.ts'

/** Como o argumento se escreve na linha de comando. */
export type OptionKind = 'positional' | 'string' | 'boolean' | 'enum'

/** Um argumento de um comando (posicional ou opção), como dado. */
export interface OptionInfo {
  /** O nome do argumento na CLI, sem tradução: `dry-run`, `nome`, e `item` para o posicional `item...`. */
  name: string
  kind: OptionKind
  required: boolean
  /** O posicional que aceita vários valores (`item...`). */
  variadic: boolean
  description: string
  /** A dica do valor na ajuda (`pasta`), se o comando a dá. */
  valueHint?: string
  /** Os valores aceitos de uma opção `enum`. */
  choices?: string[]
  /** O valor de partida, se o comando tem um (a opção `install` do `new` parte ligada). */
  default?: string | boolean
  /** Os apelidos da opção (`h` de `--help`), sem os traços. */
  aliases: string[]
}

/** Um comando folha da árvore do `prumo`, como dado. */
export interface CommandInfo {
  /** O nome como se digita: `make:page`. Num grupo de comandos, os nomes do caminho separados por espaço. */
  name: string
  /** O caminho até o comando, a partir da raiz: `['make:page']`. */
  path: string[]
  /** O nome da ferramenta MCP do comando: `make_page` (veja `toolNameOf`). */
  toolName: string
  /** A primeira linha da descrição, o que a lista de comandos mostra. */
  summary: string
  /** A descrição inteira, a mesma da ajuda. */
  description: string
  /** Os argumentos, na ordem em que o comando os declara. */
  options: OptionInfo[]
}

/**
 * O nome da ferramenta MCP de um comando: o nome com `:` (e o espaço de um grupo de comandos)
 * trocado por `_`, `make:page` vira `make_page`. É a única função que dá nome a ferramenta.
 */
export function toolNameOf(commandName: string): string {
  return commandName.replace(/[: ]+/g, '_')
}

function kindOf(def: ArgDef): OptionKind {
  return def.type === 'positional' || def.type === 'boolean' || def.type === 'enum'
    ? def.type
    : 'string'
}

function describeOption(name: string, def: ArgDef): OptionInfo {
  const variadic = def.type === 'positional' && isVariadic(name)
  return {
    name: variadic ? name.slice(0, -3) : name,
    kind: kindOf(def),
    required: isRequired(def),
    variadic,
    description: def.description ?? '',
    ...(def.valueHint === undefined ? {} : { valueHint: def.valueHint }),
    ...(def.type === 'enum' && def.options?.length ? { choices: [...def.options] } : {}),
    ...(def.default === undefined ? {} : { default: def.default }),
    aliases: aliasesOf(def),
  }
}

async function collect(
  command: AnyCommand,
  commandPath: string[],
  rootName: string,
  into: CommandInfo[],
): Promise<void> {
  const entries = Object.entries(await resolveValue(command.subCommands ?? {}))
  if (entries.length > 0) {
    for (const [name, sub] of entries) {
      const resolved = await resolveValue(sub)
      if ((await resolveValue(resolved.meta ?? {})).hidden) continue
      await collect(resolved, [...commandPath, name], rootName, into)
    }
    return
  }
  const meta = await resolveValue(command.meta ?? {})
  const name = commandPath.length === 0 ? rootName : commandPath.join(' ')
  const args = Object.entries(await resolveValue<ArgsDef>(command.args ?? {}))
  into.push({
    name,
    path: commandPath,
    toolName: toolNameOf(name),
    summary: summary(meta.description),
    description: meta.description ?? '',
    options: args.map(([argName, def]) => describeOption(argName, def)),
  })
}

/**
 * A árvore de comandos como dado, das mesmas definições do citty que a ajuda lê (o texto não é
 * duplicado). Só os comandos folha, sem os `hidden`, na ordem de declaração. Recebe a raiz (o
 * resultado de `createRoot`) em vez de importá-la, e assim não cria um import circular.
 */
export async function describeCommands(root: AnyCommand): Promise<CommandInfo[]> {
  const rootName = (await resolveValue(root.meta ?? {})).name ?? 'prumo'
  const commands: CommandInfo[] = []
  await collect(root, [], rootName, commands)
  return commands
}

function textOf(value: unknown, field: string, what: string): string {
  if (typeof value !== 'string') throw new UsageError(`'${field}' precisa ser ${what}.`)
  return value
}

/**
 * Os argumentos de uma chamada (um campo por argumento, com o nome que ele tem na CLI) como linha de
 * comando, para o `runCli`. É o mapa de campo para argv, e o único: o servidor MCP não traduz nada.
 * Não leva o nome do comando: a linha inteira é `[...command.path, ...toArgv(command, input)]`.
 *
 * - posicional: o valor, na ordem do comando (o variádico recebe uma lista e vira um valor por item);
 *   um valor que começa com `-` é recusado, porque o parser o leria como opção;
 * - opção de texto e `enum`: `--nome=valor`, uma forma só, que dispensa a separação por espaço e não
 *   deixa um valor que começa com `-` virar opção;
 * - liga e desliga: `--nome` se verdadeira; se falsa, `--no-nome` quando o padrão dela é ligado (a
 *   `install` do `new`) e nada quando é desligado.
 *
 * Campo que o comando não tem, valor de outro tipo e posicional pulado são `UsageError`. O que falta
 * de obrigatório e o valor fora da lista de um `enum` a conferência do `runCli` (`validateArgs`) acusa.
 */
export function toArgv(command: CommandInfo, input: Readonly<Record<string, unknown>>): string[] {
  const known = new Set(command.options.map((option) => option.name))
  for (const field of Object.keys(input)) {
    if (!known.has(field)) {
      throw new UsageError(
        `o comando '${command.name}' não tem o campo '${field}' (campos: ${[...known].join(', ') || 'nenhum'}).`,
      )
    }
  }

  const positionals: string[] = []
  const flags: string[] = []
  let skipped: string | undefined
  for (const option of command.options) {
    const value = input[option.name]
    if (option.kind === 'positional') {
      if (value === undefined) {
        skipped ??= option.name
        continue
      }
      if (skipped !== undefined) {
        throw new UsageError(`'${option.name}' foi dado sem '${skipped}', que vem antes dele.`)
      }
      let values: string[]
      if (option.variadic) {
        if (!Array.isArray(value)) {
          throw new UsageError(`'${option.name}' precisa ser uma lista de textos.`)
        }
        values = value.map((item) => textOf(item, option.name, 'uma lista de textos'))
      } else values = [textOf(value, option.name, 'um texto')]
      for (const item of values) {
        if (item.startsWith('-')) {
          throw new UsageError(
            `'${option.name}' não pode começar com '-' ('${item}'): o comando o leria como opção.`,
          )
        }
        positionals.push(item)
      }
      continue
    }
    if (value === undefined) continue
    if (option.kind === 'boolean') {
      if (typeof value !== 'boolean')
        throw new UsageError(`'${option.name}' precisa ser verdadeiro ou falso.`)
      if (value) flags.push(`--${option.name}`)
      else if (option.default === true) flags.push(`--no-${option.name}`)
      continue
    }
    flags.push(`--${option.name}=${textOf(value, option.name, 'um texto')}`)
  }
  return [...positionals, ...flags]
}
