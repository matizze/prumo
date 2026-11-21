import { parseArgs, type ArgDef, type ArgsDef } from 'citty'
import { UsageError } from './errors.ts'
import { aliasesOf, isRequired } from './help.ts'

const toKebab = (text: string) => text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const toCamel = (text: string) =>
  text.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())

/**
 * Confere os argumentos de um comando antes de rodá-lo e lança um `UsageError` (saída 2) em
 * português quando algo está errado: opção que o comando não tem, opção sem valor, valor fora da
 * lista, argumento ou opção obrigatória que falta, argumento a mais.
 *
 * O citty não faz isso sozinho: o parser dele aceita qualquer opção (uma opção com erro de
 * digitação passaria calada) e as mensagens dele são em inglês. Então ele só separa os argumentos,
 * com as obrigações desligadas, e as conferências são daqui.
 */
export function validateArgs(argsDef: ArgsDef, rawArgs: string[]): void {
  const entries = Object.entries(argsDef)
  const loose: ArgsDef = Object.fromEntries(entries.map(([name, def]) => [name, loosen(def)]))
  const parsed: Record<string, unknown> & { _: string[] } = parseArgs(rawArgs, loose)

  const known = new Set<string>(['_'])
  for (const [name, def] of entries) {
    for (const key of [name, toCamel(name), toKebab(name), ...aliasesOf(def)]) known.add(key)
  }
  for (const key of Object.keys(parsed)) {
    if (!known.has(key)) throw new UsageError(`opção desconhecida: '${flagOf(key)}'.`)
  }

  for (const [name, def] of entries) {
    const value = parsed[name]
    if (def.type === 'positional') {
      if (value === undefined && isRequired(def))
        throw new UsageError(`falta o argumento <${name}>.`)
      continue
    }
    if (value === undefined) {
      if (isRequired(def)) throw new UsageError(`a opção --${name} é obrigatória.`)
      continue
    }
    if (def.type === 'boolean') continue
    if (value === '') throw new UsageError(`a opção --${name} precisa de um valor.`)
    if (def.type === 'enum' && def.options?.length && !def.options.includes(String(value))) {
      throw new UsageError(
        `valor inválido para --${name}: '${String(value)}'. Valores aceitos: ${def.options.join(', ')}.`,
      )
    }
  }

  const positionals = entries.filter(([, def]) => def.type === 'positional').length
  const extra = parsed._[positionals]
  if (extra !== undefined) throw new UsageError(`argumento inesperado: '${extra}'.`)
}

/** A mesma definição sem obrigação e sem lista de valores, para o citty só separar os argumentos. */
function loosen(def: ArgDef): ArgDef {
  return (
    def.type === 'enum' ? { ...def, type: 'string', required: false } : { ...def, required: false }
  ) as ArgDef
}

function flagOf(key: string): string {
  return key.length === 1 ? `-${key}` : `--${key}`
}
