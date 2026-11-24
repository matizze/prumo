import type { Argument, Command, Option } from 'commander'

/** Os comandos que não viram ferramenta: o `new` cria a pasta do app (o agente não escreve fora do projeto) e o `mcp` é o próprio servidor. */
const EXCLUDED_COMMANDS: readonly string[] = ['new', 'mcp']

/** As opções que nenhuma ferramenta tem: o projeto é o da pasta onde o servidor abriu. */
const EXCLUDED_OPTIONS: readonly string[] = ['root', 'help', 'version']

/** O que a ferramenta de um comando fixa: argumentos que ela sempre passa e opções que, por isso, não são campo. */
const FIXED: Readonly<Record<string, { args: readonly string[]; options: readonly string[] }>> = {
  list: { args: ['--json'], options: ['json'] },
}

/** Um campo da entrada da ferramenta e como ele vira a linha de comando. */
export type ToolField =
  | { name: string; kind: 'positional'; variadic: boolean }
  | { name: string; kind: 'value'; flag: string }
  | { name: string; kind: 'switch'; flag: string }
  | { name: string; kind: 'negated'; flag: string }

/** O esquema de entrada (JSON Schema) de uma ferramenta. */
export type ToolInputSchema = {
  type: 'object'
  properties: Record<string, Record<string, unknown>>
  required?: string[]
  additionalProperties: false
}

/** Uma ferramenta MCP: a projeção de um comando do commander, sem depender do SDK. */
export type ToolSpec = {
  /** O nome: o do comando com `:` trocado por `_` (`make_schema`). */
  name: string
  /** O comando que ela roda, com os `:` (`make:schema`). */
  command: string
  description: string
  inputSchema: ToolInputSchema
  fields: readonly ToolField[]
  /** Argumentos que a ferramenta sempre passa (`--json` no `list`). */
  fixedArgs: readonly string[]
}

/** O nome do campo: snake_case sem acento (`domínio` vira `dominio`, `data-source` vira `data_source`). */
export function fieldName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** A descrição de um campo: a do commander e, quando há, o padrão e os valores. */
function describe(text: string, defaultValue: unknown, defaultDescription?: string): string {
  const base = text.trim()
  if (defaultValue === undefined) return base
  return `${base} (padrão: ${defaultDescription ?? JSON.stringify(defaultValue)})`.trim()
}

function positionalSchema(argument: Argument): Record<string, unknown> {
  const item: Record<string, unknown> = { type: 'string', minLength: 1, pattern: '^[^-]' }
  if (argument.argChoices) {
    delete item.pattern
    item.enum = [...argument.argChoices]
  }
  const description = describe(argument.description, argument.defaultValue, argument.defaultValueDescription)
  const schema: Record<string, unknown> = argument.variadic
    ? { type: 'array', items: item, minItems: 1 }
    : item
  if (description !== '') schema.description = description
  return schema
}

function optionSchema(option: Option): Record<string, unknown> {
  const hasValue = option.required || option.optional
  const schema: Record<string, unknown> = { type: hasValue ? 'string' : 'boolean' }
  if (hasValue) {
    schema.minLength = 1
    if (option.argChoices) schema.enum = [...option.argChoices]
  }
  if (option.negate) {
    schema.default = true
    schema.description = `Falso: ${option.description.replace(/\.$/, '').toLowerCase()} (padrão: verdadeiro).`
    return schema
  }
  const description = describe(option.description, option.defaultValue, option.defaultValueDescription)
  if (description !== '') schema.description = description
  return schema
}

function descriptionOf(command: Command): string {
  const summary = command.summary()
  const description = command.description()
  if (summary === '' || description.startsWith(summary)) return description || summary
  return `${summary}\n\n${description}`
}

function toolOf(command: Command): ToolSpec {
  const commandName = command.name()
  const fixed = FIXED[commandName]
  const properties: Record<string, Record<string, unknown>> = {}
  const required: string[] = []
  const fields: ToolField[] = []

  for (const argument of command.registeredArguments) {
    const name = fieldName(argument.name())
    properties[name] = positionalSchema(argument)
    if (argument.required) required.push(name)
    fields.push({ name, kind: 'positional', variadic: argument.variadic })
  }
  for (const option of command.options) {
    const long = option.long
    if (!long || option.hidden) continue
    const bare = long.replace(/^--/, '')
    const key = option.negate ? bare.replace(/^no-/, '') : bare
    if (EXCLUDED_OPTIONS.includes(bare) || fixed?.options.includes(bare)) continue
    const name = fieldName(key)
    properties[name] = optionSchema(option)
    if (option.mandatory) required.push(name)
    const kind = option.negate ? 'negated' : option.required || option.optional ? 'value' : 'switch'
    fields.push({ name, kind, flag: long })
  }

  return {
    name: commandName.replaceAll(':', '_'),
    command: commandName,
    description: descriptionOf(command),
    inputSchema: {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
      additionalProperties: false,
    },
    fields,
    fixedArgs: fixed?.args ?? [],
  }
}

/** Uma ferramenta por comando do programa, menos o `new` e o `mcp`: um comando novo vira ferramenta sem outra lista para manter. */
export function describeTools(program: Command): ToolSpec[] {
  return program.commands
    .filter((command) => !EXCLUDED_COMMANDS.includes(command.name()))
    .map(toolOf)
}

/** A linha de comando de uma chamada (`['make:schema', 'livros', '--fields', '...']`). Campo que a ferramenta não tem é erro. */
export function toArgv(tool: ToolSpec, input: Readonly<Record<string, unknown>>): string[] {
  const known = new Set(tool.fields.map((field) => field.name))
  const unknown = Object.keys(input).filter((key) => !known.has(key))
  if (unknown.length > 0) {
    throw new Error(`campo desconhecido: ${unknown.map((key) => `'${key}'`).join(', ')}.`)
  }
  const positionals: string[] = []
  const options: string[] = []
  for (const field of tool.fields) {
    const value = input[field.name]
    if (value === undefined) continue
    switch (field.kind) {
      case 'positional':
        positionals.push(...(Array.isArray(value) ? value.map(String) : [String(value)]))
        break
      case 'value':
        // `--flag=valor`: o valor nunca é lido como opção (`--version`, `-v`, `--help`), que o programa raiz acharia antes do `--`
        options.push(`${field.flag}=${String(value)}`)
        break
      case 'switch':
        if (value === true) options.push(field.flag)
        break
      case 'negated':
        if (value === false) options.push(field.flag)
        break
    }
  }
  // As opções de valor vão como `--flag=valor`, e o `--` antes dos posicionais impede que um posicional seja lido como opção
  return [tool.command, ...tool.fixedArgs, ...options, ...(positionals.length > 0 ? ['--', ...positionals] : [])]
}
