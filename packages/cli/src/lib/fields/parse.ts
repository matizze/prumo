import { UsageError } from '../../errors.ts'
import { ENUM_VALUE, FIELD_NAME, FIELD_TYPES, RESERVED_FIELDS, type Field } from './types.ts'

/** O formato aceito, para as mensagens de erro. */
const SYNTAX = `nome:tipo separados por vírgula, por exemplo "titulo:string,ano:int,status:enum(ativo|inativo),apelido?:string" (tipos: ${FIELD_TYPES.filter((type) => type !== 'enum').join(', ')} e enum(a|b|c); ? depois do nome torna o campo opcional)`

/** O `enum(a|b|c)`: o que vem entre os parênteses. */
const ENUM_TYPE = /^enum\((.*)\)$/s

/**
 * Lê o texto do `--fields` (`titulo:string,ano:number,apelido?:string`) e confere cada campo: nome em
 * camelCase (começa com letra minúscula, só letras e números), tipo conhecido, sem repetir e sem os
 * nomes que o repositório reserva (`id`, `createdAt`). Todo erro é um `UsageError` (saída 2).
 */
export function parseFields(text: string): Field[] {
  const bad = (reason: string): never => {
    throw new UsageError(`--fields '${text}' é inválido: ${reason}. Formato: ${SYNTAX}.`)
  }
  if (text.trim() === '') bad('a lista de campos está vazia')
  const fields: Field[] = []
  for (const raw of text.split(',')) {
    const item = raw.trim()
    if (item === '') bad('há uma vírgula sobrando (campo vazio)')
    const parts = item.split(':')
    if (parts.length !== 2) bad(`'${item}' não está no formato nome:tipo`)
    const [head = '', typeText = ''] = parts.map((part) => part.trim())
    const optional = head.endsWith('?')
    const name = optional ? head.slice(0, -1) : head
    if (!FIELD_NAME.test(name)) {
      bad(`'${name}' não é um nome em camelCase (letra minúscula primeiro; só letras e números)`)
    }
    if (RESERVED_FIELDS.has(name)) {
      bad(`'${name}' é reservado: o repositório já dá ${[...RESERVED_FIELDS].join(' e ')} a todo registro`)
    }
    if (fields.some((field) => field.name === name)) bad(`o campo '${name}' aparece mais de uma vez`)
    const enumMatch = ENUM_TYPE.exec(typeText)
    if (enumMatch) {
      const values = enumMatch[1]!.split('|').map((value) => value.trim())
      const invalid = values.find((value) => !ENUM_VALUE.test(value))
      if (invalid !== undefined) {
        bad(`'${invalid}' não é um valor válido de '${name}' (letras, números e _, começando por letra)`)
      }
      if (values.length < 2) bad(`o enum '${name}' precisa de pelo menos dois valores (enum(a|b))`)
      const repeated = values.find((value, index) => values.indexOf(value) !== index)
      if (repeated !== undefined) bad(`o valor '${repeated}' aparece mais de uma vez em '${name}'`)
      fields.push({ name, type: 'enum', values, optional })
      continue
    }
    const type = FIELD_TYPES.find((candidate) => candidate === typeText && candidate !== 'enum')
    if (!type) {
      const hint = typeText === 'enum' ? ' (o enum leva os valores: enum(a|b|c))' : ''
      bad(`'${typeText}' não é um tipo de '${name}' (use ${FIELD_TYPES.filter((candidate) => candidate !== 'enum').join(', ')} ou enum(a|b|c))${hint}`)
    }
    fields.push({ name, type: type!, optional })
  }
  return fields
}

/** O texto do campo na lista de uma saída: `titulo (string)`, `apelido (string, opcional)`. */
export function describeField(field: Field): string {
  const type = field.type === 'enum' ? `enum(${(field.values ?? []).join('|')})` : field.type
  return `${field.name} (${type}${field.optional ? ', opcional' : ''})`
}
