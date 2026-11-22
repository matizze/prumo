import { defineCommand, parseArgs, type ArgsDef } from 'citty'
import { describe, expect, it } from 'vitest'
import { validateArgs } from './args.ts'
import {
  describeCommands,
  toArgv,
  toolNameOf,
  type CommandInfo,
  type OptionInfo,
} from './describe.ts'
import { UsageError } from './errors.ts'
import { resolveValue } from './help.ts'
import { createRoot } from './root.ts'
import { runCli } from './run.ts'
import { captureRuntime } from './test-support.ts'

/** A árvore real: o `createRoot` não usa o Runtime ao montar os comandos, só ao rodá-los. */
const realTree = () => describeCommands(createRoot(captureRuntime()))

describe('toolNameOf', () => {
  it('troca : por _, e deixa o resto como está', () => {
    expect(toolNameOf('make:page')).toBe('make_page')
    expect(toolNameOf('check')).toBe('check')
    expect(toolNameOf('make:page:extra')).toBe('make_page_extra')
  })

  it('troca também o espaço do caminho de um grupo de comandos', () => {
    expect(toolNameOf('git status')).toBe('git_status')
  })
})

describe('describeCommands: a árvore real do prumo', () => {
  it('tem um comando por subcomando da raiz, folhas, na ordem de declaração', async () => {
    const commands = await realTree()

    expect(commands.map((command) => command.name)).toEqual([
      'check',
      'doctor',
      'make:component',
      'make:domain',
      'make:page',
    ])
    expect(commands.map((command) => command.toolName)).toEqual([
      'check',
      'doctor',
      'make_component',
      'make_domain',
      'make_page',
    ])
    for (const command of commands) expect(command.path).toEqual([command.name])
  })

  it('o resumo é a primeira linha da descrição, e a descrição é a inteira', async () => {
    const commands = await realTree()
    const check = commands.find((command) => command.name === 'check')

    expect(check?.summary).toBe('Analisa o projeto e lista as violações da arquitetura.')
    expect(check?.description).toContain('Sai com código 1 quando há violação')
    for (const command of commands) {
      expect(command.summary, command.name).not.toBe('')
      expect(command.description.startsWith(command.summary), command.name).toBe(true)
      expect(command.summary).not.toContain('\n')
    }
  })

  it('descreve a opção --root do check e do doctor, sem posicionais', async () => {
    const commands = await realTree()

    for (const name of ['check', 'doctor']) {
      const command = commands.find((candidate) => candidate.name === name)
      expect(
        command?.options.map((option) => option.name),
        name,
      ).toEqual(['root'])
      expect(command?.options[0], name).toMatchObject({
        name: 'root',
        kind: 'string',
        required: false,
        variadic: false,
        valueHint: 'pasta',
        aliases: [],
      })
    }
  })

  it('descreve o make:domain: o nome posicional obrigatório e as três opções', async () => {
    const command = (await realTree()).find((candidate) => candidate.name === 'make:domain')

    expect(command?.options.map((option) => [option.name, option.kind, option.required])).toEqual([
      ['nome', 'positional', true],
      ['entity', 'string', false],
      ['root', 'string', false],
      ['dry-run', 'boolean', false],
    ])
  })

  /**
   * O oráculo é a ajuda, que o `runCli` escreve a partir das mesmas definições, mas por outro
   * caminho (o texto): se a descrição errasse um argumento, a ajuda dele não bateria.
   */
  it('bate com a ajuda de cada comando: os mesmos argumentos e opções', async () => {
    for (const command of await realTree()) {
      const runtime = captureRuntime()
      expect(await runCli(createRoot(runtime), [...command.path, '--help'], runtime)).toBe(0)
      const help = runtime.stdout

      const section = (title: string) =>
        help
          .split(/\n\n/)
          .find((block) => block.startsWith(`${title}:`))
          ?.split('\n')
          .slice(1)
          .map((line) => line.trim().split(/\s{2,}/)[0] ?? '') ?? []

      const optionsInHelp = section('Opções')
        .map((label) => /--(?:no-)?([a-z0-9-]+)/.exec(label)?.[1])
        .filter((name): name is string => name !== undefined && name !== 'help')
      const positionalsInHelp = section('Argumentos').map((label) => label.replace(/\.\.\.$/, ''))

      expect(
        command.options.filter((option) => option.kind !== 'positional').map((o) => o.name),
        command.name,
      ).toEqual(optionsInHelp)
      expect(
        command.options.filter((option) => option.kind === 'positional').map((o) => o.name),
        command.name,
      ).toEqual(positionalsInHelp)
    }
  })

  it('a descrição de cada opção é o texto que a ajuda mostra, sem cópia', async () => {
    for (const command of await realTree()) {
      const runtime = captureRuntime()
      await runCli(createRoot(runtime), [...command.path, '--help'], runtime)
      for (const option of command.options) {
        expect(option.description, `${command.name} ${option.name}`).not.toBe('')
        const first = option.description.split(' ')[0] ?? ''
        expect(runtime.stdout, `${command.name} ${option.name}`).toContain(first)
      }
    }
  })
})

describe('describeCommands: uma árvore de mentira', () => {
  const leaf = defineCommand({
    meta: { name: 'leaf', description: 'Resumo da folha.\n\nMais detalhe aqui.' },
    args: {
      'item...': { type: 'positional', required: true, description: 'Os itens.' },
      mode: {
        type: 'enum',
        options: ['a', 'b'],
        default: 'a',
        alias: 'm',
        description: 'O modo.',
      },
      install: { type: 'boolean', default: true, description: 'Instala.' },
      force: { type: 'boolean', description: 'Força.' },
      name: { type: 'string', required: true, valueHint: 'texto', description: 'O nome.' },
    },
  })
  const hidden = defineCommand({
    meta: { name: 'hidden', description: 'Escondido.', hidden: true },
  })
  const inner = defineCommand({ meta: { name: 'inner', description: 'Dentro do grupo.' } })
  const root = defineCommand({
    meta: { name: 'fake', description: 'Raiz.' },
    subCommands: {
      'do:leaf': leaf,
      hidden,
      group: defineCommand({
        meta: { name: 'group', description: 'Um grupo.' },
        subCommands: { inner },
      }),
      // Resolvidos por função e por promessa, como o citty aceita
      lazy: () => Promise.resolve(inner),
    },
  })

  it('só as folhas, sem as escondidas, com o caminho dos grupos', async () => {
    const commands = await describeCommands(root)

    expect(commands.map((command) => [command.name, command.path, command.toolName])).toEqual([
      ['do:leaf', ['do:leaf'], 'do_leaf'],
      ['group inner', ['group', 'inner'], 'group_inner'],
      ['lazy', ['lazy'], 'lazy'],
    ])
  })

  it('descreve cada forma de argumento: variádico, enum, booleano ligado, obrigatório e apelido', async () => {
    const [command] = await describeCommands(root)
    const byName = (name: string): OptionInfo | undefined =>
      command?.options.find((option) => option.name === name)

    expect(command?.summary).toBe('Resumo da folha.')
    expect(command?.description).toBe('Resumo da folha.\n\nMais detalhe aqui.')
    expect(command?.options.map((option) => option.name)).toEqual([
      'item',
      'mode',
      'install',
      'force',
      'name',
    ])
    expect(byName('item')).toEqual({
      name: 'item',
      kind: 'positional',
      required: true,
      variadic: true,
      description: 'Os itens.',
      aliases: [],
    })
    expect(byName('mode')).toEqual({
      name: 'mode',
      kind: 'enum',
      required: false,
      variadic: false,
      description: 'O modo.',
      choices: ['a', 'b'],
      default: 'a',
      aliases: ['m'],
    })
    expect(byName('install')).toMatchObject({ kind: 'boolean', default: true, required: false })
    expect(byName('force')).toMatchObject({ kind: 'boolean', required: false })
    expect(byName('force')).not.toHaveProperty('default')
    expect(byName('name')).toMatchObject({ kind: 'string', required: true, valueHint: 'texto' })
  })

  it('a raiz sem subcomandos é ela mesma o comando', async () => {
    const commands = await describeCommands(leaf)
    expect(commands.map((command) => [command.name, command.path])).toEqual([['leaf', []]])
  })
})

/** Uma descrição com um argumento de cada forma, e a definição citty que a gera. */
const SHAPES: ArgsDef = {
  nome: { type: 'positional', required: true, description: 'O nome.' },
  'item...': { type: 'positional', required: false, description: 'Os itens.' },
  root: { type: 'string', description: 'A pasta.' },
  mode: { type: 'enum', options: ['a', 'b'], description: 'O modo.' },
  force: { type: 'boolean', description: 'Força.' },
  install: { type: 'boolean', default: true, description: 'Instala.' },
}

async function shapesInfo(): Promise<CommandInfo> {
  const [info] = await describeCommands(
    defineCommand({ meta: { name: 'shapes', description: 'Formas.' }, args: SHAPES }),
  )
  if (!info) throw new Error('sem comando')
  return info
}

describe('toArgv', () => {
  it('põe os posicionais na ordem do comando, e depois as opções', async () => {
    const info = await shapesInfo()

    expect(
      toArgv(info, { mode: 'b', item: ['x', 'y'], nome: 'loja', root: 'pasta', force: true }),
    ).toEqual(['loja', 'x', 'y', '--root=pasta', '--mode=b', '--force'])
  })

  it('opção de texto sempre vira --nome=valor, também com espaço, igual e traço no valor', async () => {
    const info = await shapesInfo()

    expect(toArgv(info, { nome: 'a', root: 'pasta com espaço' })).toEqual([
      'a',
      '--root=pasta com espaço',
    ])
    expect(toArgv(info, { nome: 'a', root: '--overwrite' })).toEqual(['a', '--root=--overwrite'])
    expect(toArgv(info, { nome: 'a', root: 'a=b' })).toEqual(['a', '--root=a=b'])
  })

  it('o booleano é --nome quando verdadeiro; falso some, e vira --no-nome se parte ligado', async () => {
    const info = await shapesInfo()

    expect(toArgv(info, { nome: 'a', force: true })).toEqual(['a', '--force'])
    expect(toArgv(info, { nome: 'a', force: false })).toEqual(['a'])
    expect(toArgv(info, { nome: 'a', install: false })).toEqual(['a', '--no-install'])
    expect(toArgv(info, { nome: 'a', install: true })).toEqual(['a', '--install'])
    expect(toArgv(info, { nome: 'a' })).toEqual(['a'])
  })

  it('recusa campo que o comando não tem, dizendo quais tem', async () => {
    const info = await shapesInfo()

    expect(() => toArgv(info, { nome: 'a', dryRun: true })).toThrow(UsageError)
    expect(() => toArgv(info, { nome: 'a', dryRun: true })).toThrow(
      "não tem o campo 'dryRun' (campos: nome, item, root, mode, force, install)",
    )
  })

  it('recusa o posicional que começa com -, porque o parser o leria como opção', async () => {
    const info = await shapesInfo()

    expect(() => toArgv(info, { nome: '--root=/' })).toThrow("'nome' não pode começar com '-'")
    expect(() => toArgv(info, { nome: 'a', item: ['ok', '-x'] })).toThrow(
      "'item' não pode começar com '-'",
    )
  })

  it('recusa valor de outro tipo e posicional dado sem o que vem antes', async () => {
    const info = await shapesInfo()

    expect(() => toArgv(info, { nome: 1 })).toThrow("'nome' precisa ser um texto")
    expect(() => toArgv(info, { nome: 'a', root: true })).toThrow("'root' precisa ser um texto")
    expect(() => toArgv(info, { nome: 'a', force: 'sim' })).toThrow('verdadeiro ou falso')
    expect(() => toArgv(info, { nome: 'a', item: 'x' })).toThrow("'item' precisa ser uma lista")
    expect(() => toArgv(info, { nome: 'a', item: [1] })).toThrow('lista de textos')
    expect(() => toArgv(info, { item: ['x'] })).toThrow("'item' foi dado sem 'nome'")
  })

  it('deixa para o validateArgs o que falta e o valor fora da lista', async () => {
    const info = await shapesInfo()

    // Sem `nome` e com `mode` inválido: o toArgv monta a linha, e a conferência da CLI acusa
    expect(() => validateArgs(SHAPES, toArgv(info, {}))).toThrow('falta o argumento <nome>')
    expect(() => validateArgs(SHAPES, toArgv(info, { nome: 'a', mode: 'c' }))).toThrow(
      "valor inválido para --mode: 'c'",
    )
  })

  describe('ida e volta: o que sai do toArgv passa pelo validateArgs e o citty devolve o de partida', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['só o obrigatório', { nome: 'loja' }],
      ['o variádico', { nome: 'loja', item: ['a', 'b', 'c'] }],
      ['um item só', { nome: 'loja', item: ['a'] }],
      ['texto com espaço', { nome: 'loja', root: 'minha pasta/sub' }],
      ['texto com igual', { nome: 'loja', root: 'a=b=c' }],
      ['texto que começa com traço', { nome: 'loja', root: '-x' }],
      ['texto que parece opção', { nome: 'loja', root: '--force' }],
      ['texto com acento', { nome: 'loja', root: 'configurações/ação' }],
      ['enum', { nome: 'loja', mode: 'b' }],
      ['booleano ligado', { nome: 'loja', force: true }],
      ['booleano que parte ligado, desligado', { nome: 'loja', install: false }],
      [
        'tudo junto',
        { nome: 'loja', item: ['a', 'b'], root: 'p', mode: 'a', force: true, install: false },
      ],
    ]

    it.each(cases)('%s', async (_, input) => {
      const info = await shapesInfo()
      const argv = toArgv(info, input)

      expect(() => validateArgs(SHAPES, argv)).not.toThrow()
      const parsed = parseArgs(argv, SHAPES)
      expect(parsed._).toEqual([input.nome, ...((input.item as string[] | undefined) ?? [])])
      expect(parsed.root).toBe(input.root)
      expect(parsed.mode).toBe(input.mode)
      expect(Boolean(parsed.force)).toBe(input.force === true)
      expect(parsed.install).toBe(input.install ?? true)
    })
  })

  it('serve a todo comando real: com um valor em cada campo, a CLI aceita a linha e devolve os valores', async () => {
    const root = createRoot(captureRuntime())
    const subCommands = await resolveValue(root.subCommands ?? {})

    for (const info of await realTree()) {
      const input: Record<string, unknown> = {}
      for (const option of info.options) {
        if (option.kind === 'boolean') input[option.name] = true
        else if (option.kind === 'enum') input[option.name] = option.choices?.[0]
        else input[option.name] = option.variadic ? ['um', 'dois'] : `valor ${option.name}`
      }
      const argsDef = (await resolveValue(
        (await resolveValue(subCommands[info.name]!)).args ?? {},
      )) as ArgsDef
      const argv = toArgv(info, input)

      expect(() => validateArgs(argsDef, argv), info.name).not.toThrow()
      const parsed = parseArgs(argv, argsDef)
      for (const option of info.options) {
        if (option.kind === 'positional') continue
        expect(parsed[option.name], `${info.name} --${option.name}`).toEqual(input[option.name])
      }
      const positionals = info.options
        .filter((option) => option.kind === 'positional')
        .flatMap((option) => input[option.name] as string | string[])
      expect(parsed._, info.name).toEqual(positionals)
    }
  })
})
