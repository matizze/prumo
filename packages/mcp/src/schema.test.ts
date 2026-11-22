import type { CommandInfo, OptionInfo } from '@matizze/prumo-cli/api'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { inputSchemaOf } from './schema.ts'

const option = (value: Partial<OptionInfo> & Pick<OptionInfo, 'name' | 'kind'>): OptionInfo => ({
  required: false,
  variadic: false,
  description: `A opção ${value.name}.`,
  aliases: [],
  ...value,
})

const command = (...options: OptionInfo[]): CommandInfo => ({
  name: 'teste',
  path: ['teste'],
  toolName: 'teste',
  summary: 'Um comando.',
  description: 'Um comando.',
  options,
})

const accepts = (schema: ReturnType<typeof inputSchemaOf>, input: unknown) =>
  schema.safeParse(input).success

const messageOf = (schema: ReturnType<typeof inputSchemaOf>, input: unknown) => {
  const result = schema.safeParse(input)
  return result.success ? '' : result.error.issues.map((issue) => issue.message).join('; ')
}

describe('inputSchemaOf', () => {
  it('posicional de texto: obrigatório sem optional, e sem começar por "-"', () => {
    const schema = inputSchemaOf(
      command(option({ name: 'nome', kind: 'positional', required: true })),
    )

    expect(accepts(schema, { nome: 'pedidos' })).toBe(true)
    expect(accepts(schema, {})).toBe(false)
    expect(messageOf(schema, { nome: '-pedidos' })).toContain("não pode começar com '-'")
    expect(messageOf(schema, { nome: '--root' })).toContain("não pode começar com '-'")
    expect(accepts(schema, { nome: '' })).toBe(false)
    expect(accepts(schema, { nome: 3 })).toBe(false)
  })

  it('posicional opcional pode faltar', () => {
    const schema = inputSchemaOf(command(option({ name: 'busca', kind: 'positional' })))
    expect(accepts(schema, {})).toBe(true)
    expect(accepts(schema, { busca: 'lista' })).toBe(true)
    expect(accepts(schema, { busca: '-x' })).toBe(false)
  })

  it('posicional variádico é uma lista com ao menos um item, e cada item sem "-" na frente', () => {
    const schema = inputSchemaOf(
      command(option({ name: 'item', kind: 'positional', required: true, variadic: true })),
    )

    expect(accepts(schema, { item: ['a'] })).toBe(true)
    expect(accepts(schema, { item: ['a', 'b'] })).toBe(true)
    expect(messageOf(schema, { item: [] })).toContain('ao menos um')
    expect(accepts(schema, { item: ['a', '-b'] })).toBe(false)
    expect(accepts(schema, { item: 'a' })).toBe(false)
    expect(accepts(schema, {})).toBe(false)
  })

  it('opção de texto: opcional, texto não vazio', () => {
    const schema = inputSchemaOf(command(option({ name: 'like', kind: 'string' })))
    expect(accepts(schema, {})).toBe(true)
    expect(accepts(schema, { like: 'lista' })).toBe(true)
    // Um valor que começa com '-' é de opção de texto, não de posicional: o toArgv usa --nome=valor
    expect(accepts(schema, { like: '-x' })).toBe(true)
    expect(accepts(schema, { like: '' })).toBe(false)
    expect(accepts(schema, { like: true })).toBe(false)
  })

  it('opção de texto obrigatória não é opcional', () => {
    const schema = inputSchemaOf(command(option({ name: 'from', kind: 'string', required: true })))
    expect(accepts(schema, {})).toBe(false)
    expect(accepts(schema, { from: 'orders' })).toBe(true)
  })

  it('liga e desliga: booleano opcional', () => {
    const schema = inputSchemaOf(command(option({ name: 'dry-run', kind: 'boolean' })))
    expect(accepts(schema, {})).toBe(true)
    expect(accepts(schema, { 'dry-run': true })).toBe(true)
    expect(accepts(schema, { 'dry-run': false })).toBe(true)
    expect(accepts(schema, { 'dry-run': 'true' })).toBe(false)
  })

  it('enum: só os valores da lista', () => {
    const schema = inputSchemaOf(
      command(option({ name: 'kind', kind: 'enum', choices: ['block', 'page'] })),
    )
    expect(accepts(schema, { kind: 'block' })).toBe(true)
    expect(accepts(schema, {})).toBe(true)
    expect(accepts(schema, { kind: 'domain' })).toBe(false)
  })

  it('campo desconhecido é recusado', () => {
    const schema = inputSchemaOf(command(option({ name: 'like', kind: 'string' })))
    expect(messageOf(schema, { like: 'a', outro: 'b' })).toContain('Unrecognized key')
  })

  it('o nome do campo é o da CLI, sem tradução', () => {
    const schema = inputSchemaOf(
      command(
        option({ name: 'dry-run', kind: 'boolean' }),
        option({ name: 'nome', kind: 'positional', required: true }),
      ),
    )
    expect(Object.keys(schema.shape)).toEqual(['dry-run', 'nome'])
  })

  it('a descrição do campo é a da opção e, quando há, o padrão', () => {
    const schema = inputSchemaOf(
      command(
        option({ name: 'install', kind: 'boolean', description: 'Instala.', default: true }),
        option({ name: 'idioma', kind: 'string', description: 'O idioma.', default: 'pt-BR' }),
        option({ name: 'from', kind: 'string', description: 'A origem.' }),
      ),
    )
    const json = z.toJSONSchema(schema) as { properties: Record<string, { description?: string }> }
    expect(json.properties.install?.description).toBe('Instala. (padrão: ligada)')
    expect(json.properties.idioma?.description).toBe('O idioma. (padrão: pt-BR)')
    expect(json.properties.from?.description).toBe('A origem.')
  })

  it('o esquema em JSON lista o que é obrigatório e fecha o objeto', () => {
    const schema = inputSchemaOf(
      command(
        option({ name: 'nome', kind: 'positional', required: true }),
        option({ name: 'like', kind: 'string' }),
      ),
    )
    const json = z.toJSONSchema(schema) as { required?: string[]; additionalProperties?: boolean }
    expect(json.required).toEqual(['nome'])
    expect(json.additionalProperties).toBe(false)
  })
})
