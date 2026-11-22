import type { CommandInfo, OptionInfo } from '@matizze/prumo-cli/api'
import { z } from 'zod'

/** O que o campo de texto aceita: algo que não começa com `-`, que o parser da CLI leria como opção. */
const POSITIONAL_TEXT = z
  .string()
  .min(1, 'não pode ser vazio')
  .regex(/^(?!-)/, "não pode começar com '-': o comando o leria como opção")

/** A descrição do campo: a da opção na CLI e, quando ela tem um, o valor de partida. */
function describeField(option: OptionInfo): string {
  const text = option.description.trim()
  if (option.default === undefined) return text
  const standard =
    typeof option.default === 'boolean' ? (option.default ? 'ligada' : 'desligada') : option.default
  return `${text} (padrão: ${standard})`.trim()
}

/** O esquema de um campo, do tipo do argumento na CLI. O `optional` fica a cargo de quem chama. */
function fieldOf(option: OptionInfo): z.ZodType {
  switch (option.kind) {
    case 'positional':
      return option.variadic
        ? z.array(POSITIONAL_TEXT).min(1, 'precisa de ao menos um')
        : POSITIONAL_TEXT
    case 'boolean':
      return z.boolean()
    case 'enum':
      return option.choices?.length
        ? z.enum(option.choices as [string, ...string[]])
        : z.string().min(1, 'não pode ser vazio')
    case 'string':
      return z.string().min(1, 'não pode ser vazio')
  }
}

/**
 * O esquema de entrada da ferramenta de um comando, derivado dos argumentos dele (nada à mão): um
 * campo por argumento, com o nome que ele tem na CLI. Posicional de texto e opção de texto são
 * `string` (o posicional, sem começar por `-`), o posicional variádico é uma lista com ao menos um
 * item, liga e desliga é `boolean`, `enum` é a lista de valores aceitos, e o que o comando exige
 * não é opcional. Um campo que o comando não tem é recusado.
 */
export function inputSchemaOf(command: CommandInfo) {
  const shape: Record<string, z.ZodType> = {}
  for (const option of command.options) {
    const field = fieldOf(option).describe(describeField(option))
    shape[option.name] = option.required ? field : field.optional()
  }
  return z.strictObject(shape)
}
