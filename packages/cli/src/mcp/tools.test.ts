import { Command } from 'commander'
import { describe, expect, it } from 'vitest'
import { commands } from '../commands/index.ts'
import { createProgram, run } from '../program.ts'
import { describeTools, fieldName, toArgv } from './tools.ts'

const noop = (): void => undefined
const program = createProgram({ cwd: '.', out: noop, err: noop })
const tools = describeTools(program)
const tool = (name: string) => {
  const found = tools.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`sem ferramenta ${name}`)
  return found
}

describe('fieldName', () => {
  it('tira o acento e vira snake_case', () => {
    expect(fieldName('domínio')).toBe('dominio')
    expect(fieldName('data-source')).toBe('data_source')
    expect(fieldName('dry-run')).toBe('dry_run')
  })
})

describe('paridade das ferramentas com os comandos', () => {
  it('todo comando, menos new e mcp, tem a sua ferramenta, e toda ferramenta tem o seu comando', () => {
    const names = program.commands.map((command) => command.name())
    expect(names).toContain('new')
    expect(names).toContain('mcp')
    expect(tools.map((candidate) => candidate.command)).toEqual(
      names.filter((name) => name !== 'new' && name !== 'mcp'),
    )
    expect(tools.map((candidate) => candidate.name)).toEqual([
      'make_schema',
      'make_repository',
      'make_query',
      'make_page',
      'check',
      'list',
    ])
    expect(commands.length).toBe(names.length)
  })

  it('um comando novo vira ferramenta sem mudar nada no servidor', () => {
    const extra = new Command('make:widget')
      .summary('Gera um widget.')
      .description('Gera um widget.\n\nCom mais detalhes.')
      .argument('<nome>', 'O nome.')
      .option('--tamanho <t>', 'O tamanho.')
      .option('--no-teste', 'Não cria o teste.')
    const root = new Command('prumo')
    root.addCommand(extra)
    const [made] = describeTools(root)
    expect(made?.name).toBe('make_widget')
    expect(Object.keys(made?.inputSchema.properties ?? {})).toEqual(['nome', 'tamanho', 'teste'])
  })

  it('a descrição traz o resumo, o detalhe do agente e a referência, sem repetir o resumo', () => {
    for (const candidate of tools) {
      const command = program.commands.find((item) => item.name() === candidate.command)
      const summary = command?.summary() ?? ''
      expect(candidate.description.startsWith(`${summary}\n\n`), candidate.name).toBe(true)
      expect(candidate.description.split(summary)).toHaveLength(2)
      expect(candidate.description).toMatch(
        new RegExp(`\\nReferência: https://docs.prumo.matizze.com.br/reference/cli#prumo-${candidate.command.replace(':', '')}$`),
      )
    }
  })

  it('o detalhe que saiu da ajuda do terminal está na descrição da ferramenta', () => {
    expect(tool('make_repository').description).toContain('VITE_DATA_SOURCE')
    expect(tool('make_repository').description).toContain('{ items, total }')
    expect(tool('make_page').description).toContain(':param')
    expect(tool('make_page').description).toContain('auth.login')
    expect(tool('make_schema').description).toContain('createdAt')
    expect(tool('make_schema').description).toContain('AAAA-MM-DD')
    expect(tool('check').description).toContain('components/shared')
  })

  it('o detalhe do agente não aparece na ajuda do terminal', () => {
    const help = program.commands.find((item) => item.name() === 'make:repository')?.helpInformation()
    expect(help).not.toContain('VITE_DATA_SOURCE')
  })
})

describe('o esquema de cada ferramenta', () => {
  it('make_schema: posicional e opções, sem root', () => {
    expect(tool('make_schema').inputSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['dominio'],
      properties: {
        dominio: { type: 'string', minLength: 1, pattern: '^[^-]' },
        entity: { type: 'string' },
        fields: { type: 'string' },
        dry_run: { type: 'boolean' },
      },
    })
    expect(Object.keys(tool('make_schema').inputSchema.properties)).toEqual([
      'dominio',
      'entity',
      'fields',
      'dry_run',
    ])
  })

  it('make_repository: o data_source é um enum', () => {
    expect(tool('make_repository').inputSchema.properties.data_source).toMatchObject({
      type: 'string',
      enum: ['mock', 'http', 'storage'],
    })
  })

  it('make_query e make_page', () => {
    expect(Object.keys(tool('make_query').inputSchema.properties)).toEqual(['dominio', 'entity', 'dry_run'])
    expect(Object.keys(tool('make_page').inputSchema.properties)).toEqual(['nome', 'query', 'path', 'dry_run'])
    expect(tool('make_page').inputSchema.required).toEqual(['nome'])
  })

  it('check e list: sem campos (o --json do list é fixo)', () => {
    expect(tool('check').inputSchema.properties).toEqual({})
    expect(tool('list').inputSchema.properties).toEqual({})
    expect(tool('check').inputSchema.required).toBeUndefined()
  })

  it('--no-<x> vira <x>: boolean com padrão true', () => {
    const newCommand = program.commands.find((command) => command.name() === 'new')
    const root = new Command('prumo')
    root.addCommand(newCommand as Command)
    // o new fica fora da lista; o esquema do --no-install vem de um comando de teste
    const extra = new Command('x').option('--no-install', 'Não instala as dependências.')
    const fake = new Command('prumo')
    fake.addCommand(extra)
    expect(describeTools(fake)[0]?.inputSchema.properties.install).toMatchObject({
      type: 'boolean',
      default: true,
    })
  })
})

describe('toArgv', () => {
  it('vira a linha de comando, com as opções antes do -- e dos posicionais', () => {
    expect(
      toArgv(tool('make_schema'), { dominio: 'livros', fields: 'title:string', dry_run: true }),
    ).toEqual(['make:schema', '--fields=title:string', '--dry-run', '--', 'livros'])
  })

  it('dry_run falso não passa a flag; o list sempre passa --json', () => {
    expect(toArgv(tool('make_query'), { dominio: 'livros', dry_run: false })).toEqual([
      'make:query',
      '--',
      'livros',
    ])
    expect(toArgv(tool('list'), {})).toEqual(['list', '--json'])
  })

  it('--no-<x> falso passa a flag', () => {
    const extra = new Command('x').option('--no-install', 'Não instala.')
    const fake = new Command('prumo')
    fake.addCommand(extra)
    const [made] = describeTools(fake)
    expect(toArgv(made!, { install: false })).toEqual(['x', '--no-install'])
    expect(toArgv(made!, { install: true })).toEqual(['x'])
  })

  it('recusa campo desconhecido, inclusive root', () => {
    expect(() => toArgv(tool('check'), { root: '/' })).toThrow("campo desconhecido: 'root'")
  })
})

describe('toArgv com valor que parece opção', () => {
  const values = ['--version', '-v', '-vqualquer', '--help', '-h']
  const cases: [string, string, Record<string, unknown>][] = [
    ['make_schema', 'entity', { dominio: 'livros', fields: 'a:string' }],
    ['make_schema', 'fields', { dominio: 'livros' }],
    ['make_page', 'query', { nome: 'livros' }],
    ['make_page', 'path', { nome: 'livros' }],
  ]

  it.each(cases.flatMap(([name, field, rest]) => values.map((value) => [name, field, rest, value] as const)))(
    '%s: %s = %s chega ao comando como valor',
    async (name, field, rest, value) => {
      const argv = toArgv(tool(name), { ...rest, [field]: value })
      expect(argv).toContain(`--${field}=${value}`)
      // O programa raiz não pode agir sobre o valor: nem versão, nem ajuda
      let out = ''
      const result = await run(argv, { cwd: '/nao-existe', out: (t) => void (out += t), err: (t) => void (out += t) })
      // O resultado é o do comando: não há projeto a partir da pasta, uso errado (2)
      expect(result).toBe(2)
      expect(out.startsWith("prumo: nenhum projeto Prumo achado a partir de '/nao-existe'")).toBe(true)
    },
  )
})
