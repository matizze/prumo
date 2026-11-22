import type { ArgDef, ArgsDef, CommandDef, Resolvable } from 'citty'

/** Um comando de qualquer forma: os comandos têm argumentos de tipos diferentes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCommand = CommandDef<any>

/** Resolve o que o citty aceita como valor, função ou promessa. */
export async function resolveValue<T>(value: Resolvable<T>): Promise<T> {
  return typeof value === 'function' ? await (value as () => T | Promise<T>)() : await value
}

/** A primeira linha da descrição, que é o resumo mostrado na lista de comandos. */
export function summary(description: string | undefined): string {
  return (description ?? '').split('\n')[0] ?? ''
}

/**
 * A ajuda de um comando, em português: a sintaxe, a descrição, os argumentos, as opções e, para um
 * comando com subcomandos, a lista deles. O citty tem uma ajuda própria, mas ela é em inglês e
 * não permite trocar os títulos. `path` é o caminho do comando, como `['prumo', 'check']`.
 */
export async function renderHelp(command: AnyCommand, path: string[]): Promise<string> {
  const meta = await resolveValue(command.meta ?? {})
  const args = Object.entries(await resolveValue<ArgsDef>(command.args ?? {}))
  const subCommands = Object.entries(await resolveValue(command.subCommands ?? {}))
  const positionals = args.filter(([, def]) => def.type === 'positional')
  const options = args.filter(([, def]) => def.type !== 'positional')

  const syntax = [path.join(' ')]
  if (subCommands.length > 0) syntax.push('<comando> [opções]')
  for (const [name, def] of positionals) syntax.push(positionalText(name, def))
  for (const [name, def] of options) {
    const text = `${flagOf(name, def)}${valueOf(name, def)}`
    syntax.push(isRequired(def) ? text : `[${text}]`)
  }

  const sections = [`Uso: ${syntax.join(' ')}`]
  if (meta.description) sections.push(meta.description)

  if (positionals.length > 0) {
    sections.push(
      `Argumentos:\n${columns(positionals.map(([name, def]) => [name, def.description ?? '']))}`,
    )
  }

  const optionRows = options.map(([name, def]) => [optionLabel(name, def), def.description ?? ''])
  if (subCommands.length === 0) optionRows.push(['-h, --help', 'Mostra esta ajuda.'])
  if (optionRows.length > 0) sections.push(`Opções:\n${columns(optionRows)}`)

  if (subCommands.length > 0) {
    const rows: string[][] = []
    for (const [name, sub] of subCommands) {
      const subMeta = await resolveValue((await resolveValue(sub)).meta ?? {})
      if (!subMeta.hidden) rows.push([name, summary(subMeta.description)])
    }
    sections.push(`Comandos:\n${columns(rows)}`)
    sections.push(`Rode "${path.join(' ')} <comando> --help" para ver as opções de um comando.`)
  }
  return sections.join('\n\n')
}

/** O argumento posicional que aceita vários valores: o nome termina em `...` (`item...`). */
export function isVariadic(name: string | undefined): boolean {
  return name?.endsWith('...') ?? false
}

/** O argumento posicional na sintaxe: `<nome>`, `[nome]` se opcional, e `<item>...` se aceita vários. */
function positionalText(name: string, def: ArgDef): string {
  const text = isVariadic(name) ? `${name.slice(0, -3)}` : name
  const wrapped = isRequired(def) ? `<${text}>` : `[${text}]`
  return isVariadic(name) ? `${wrapped}...` : wrapped
}

/** Os apelidos da opção (`-h` de `--help`). O argumento posicional não tem. */
export function aliasesOf(def: ArgDef): string[] {
  return 'alias' in def ? [def.alias ?? []].flat() : []
}

/** Se o argumento é obrigatório: o posicional é, a não ser que diga o contrário; a opção só se disser. */
export function isRequired(def: ArgDef): boolean {
  return (
    def.default === undefined &&
    (def.type === 'positional' ? def.required !== false : !!def.required)
  )
}

/** O valor da opção na sintaxe: ` <pasta>`, ou nada para a opção que é só liga e desliga. */
function valueOf(name: string, def: ArgDef): string {
  if (def.type === 'boolean') return ''
  if (def.type === 'enum' && def.options?.length) return ` <${def.options.join('|')}>`
  return ` <${def.valueHint ?? name}>`
}

function optionLabel(name: string, def: ArgDef): string {
  const aliases = aliasesOf(def).map((alias) => `-${alias}`)
  return [...aliases, flagOf(name, def)].join(', ') + valueOf(name, def)
}

/**
 * A opção como se escreve na linha de comando. A opção liga e desliga que já vem ligada
 * (`default: true`) só se desliga, e o citty entende `--no-<nome>` como `<nome>: false`: é esse o
 * nome que a ajuda mostra (`--no-install`, para a opção `install`).
 */
function flagOf(name: string, def: ArgDef): string {
  return def.type === 'boolean' && def.default === true ? `--no-${name}` : `--${name}`
}

/** Duas colunas alinhadas, recuadas em dois espaços. */
function columns(rows: string[][]): string {
  const width = Math.max(...rows.map(([label]) => label?.length ?? 0))
  return rows
    .map(([label = '', text = '']) => `  ${label.padEnd(width)}  ${text}`.trimEnd())
    .join('\n')
}
