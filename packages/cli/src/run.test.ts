import { defineCommand } from 'citty'
import { describe, expect, it } from 'vitest'
import { ExitError } from './errors.ts'
import { runCli } from './run.ts'
import { captureRuntime } from './test-support.ts'

/** Uma árvore de mentira que usa todos os tipos de argumento, para testar a rota e a conferência. */
function createTree(calls: unknown[][]) {
  const greet = defineCommand({
    meta: { name: 'greet', description: 'Cumprimenta alguém.\n\nSegunda linha da descrição.' },
    args: {
      name: { type: 'positional', description: 'Quem recebe o cumprimento.' },
      tone: { type: 'enum', options: ['formal', 'casual'], description: 'O tom.' },
      times: { type: 'string', required: true, valueHint: 'vezes', description: 'Quantas vezes.' },
      loud: { type: 'boolean', alias: 'l', description: 'Em voz alta.' },
      dryRun: { type: 'boolean', description: 'Não escreve nada.' },
      nickname: { type: 'positional', required: false, description: 'Apelido.' },
    },
    run({ args }) {
      calls.push([args.name, args.nickname, args.tone, args.times, args.loud, args.dryRun])
    },
  })
  return defineCommand({
    meta: { name: 'demo', description: 'Comandos de teste.' },
    subCommands: {
      greet,
      fail: defineCommand({
        meta: { description: 'Sai com o código 7.' },
        run() {
          throw new ExitError(7, 'deu errado')
        },
      }),
      silent: defineCommand({
        meta: { description: 'Sai com 3 sem mensagem.' },
        run() {
          throw new ExitError(3)
        },
      }),
      crash: defineCommand({
        meta: { description: 'Quebra.' },
        run() {
          throw new Error('estourou')
        },
      }),
      secret: defineCommand({ meta: { description: 'Escondido.', hidden: true }, run() {} }),
      many: defineCommand({
        meta: { description: 'Aceita vários valores.' },
        args: {
          'item...': { type: 'positional', required: true, description: 'Os itens.' },
          flag: { type: 'boolean', description: 'Uma opção.' },
        },
        run({ args }) {
          calls.push(['many', args._, args.flag])
        },
      }),
      group: defineCommand({
        meta: { description: 'Um grupo.' },
        subCommands: {
          inner: defineCommand({
            meta: { description: 'Dentro do grupo.' },
            args: { flag: { type: 'boolean', description: 'Uma opção.' } },
            run({ args }) {
              calls.push(['inner', args.flag])
            },
          }),
        },
      }),
    },
  })
}

async function run(args: string[]) {
  const calls: unknown[][] = []
  const runtime = captureRuntime()
  const code = await runCli(createTree(calls), args, runtime)
  return { code, stdout: runtime.stdout, stderr: runtime.stderr, calls }
}

describe('runCli', () => {
  describe('ajuda', () => {
    it('lista os comandos sem argumentos, sem os escondidos', async () => {
      const result = await run([])
      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toBe(`Uso: demo <comando> [opções]

Comandos de teste.

Comandos:
  greet   Cumprimenta alguém.
  fail    Sai com o código 7.
  silent  Sai com 3 sem mensagem.
  crash   Quebra.
  many    Aceita vários valores.
  group   Um grupo.

Rode "demo <comando> --help" para ver as opções de um comando.
`)
    })

    it('mostra a mesma lista com --help ou -h', async () => {
      const bare = await run([])
      expect(await run(['--help'])).toEqual(bare)
      expect(await run(['-h'])).toEqual(bare)
    })

    it('mostra a sintaxe, a descrição, os argumentos e as opções do comando', async () => {
      const result = await run(['greet', '--help'])
      expect(result.code).toBe(0)
      expect(result.calls).toEqual([])
      expect(result.stdout)
        .toBe(`Uso: demo greet <name> [nickname] [--tone <formal|casual>] --times <vezes> [--loud] [--dryRun]

Cumprimenta alguém.

Segunda linha da descrição.

Argumentos:
  name      Quem recebe o cumprimento.
  nickname  Apelido.

Opções:
  --tone <formal|casual>  O tom.
  --times <vezes>         Quantas vezes.
  -l, --loud              Em voz alta.
  --dryRun                Não escreve nada.
  -h, --help              Mostra esta ajuda.
`)
    })

    it('a ajuda vale mesmo com argumentos errados e depois de outras opções', async () => {
      const result = await run(['greet', '--nope', '-h'])
      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Uso: demo greet')
    })

    it('mostra a ajuda do grupo e a do subcomando dele', async () => {
      const group = await run(['group'])
      expect(group.code).toBe(0)
      expect(group.stdout).toContain('Uso: demo group <comando> [opções]')
      expect(group.stdout).toContain('inner  Dentro do grupo.')
      expect(group.stdout).toContain('Rode "demo group <comando> --help"')

      const inner = await run(['group', 'inner', '--help'])
      expect(inner.stdout).toContain('Uso: demo group inner [--flag]')
    })
  })

  describe('uso errado, com saída 2', () => {
    it('comando desconhecido, na raiz e no grupo', async () => {
      const root = await run(['deploy'])
      expect(root.code).toBe(2)
      expect(root.stdout).toBe('')
      expect(root.stderr).toContain("demo: comando desconhecido: 'deploy'.")
      expect(root.stderr).toContain('Comandos:')

      const group = await run(['group', 'nada'])
      expect(group.code).toBe(2)
      expect(group.stderr).toContain("demo group: comando desconhecido: 'nada'.")
    })

    it('opção antes do nome do comando', async () => {
      const result = await run(['--nope', 'greet'])
      expect(result.code).toBe(2)
      expect(result.stderr).toContain("demo: opção desconhecida: '--nope'.")
    })

    it('opção que o comando não tem, comprida ou curta', async () => {
      const long = await run(['greet', 'Ana', '--times', '1', '--nope'])
      expect(long.code).toBe(2)
      expect(long.stderr).toContain("demo greet: opção desconhecida: '--nope'.")
      expect(long.stderr).toContain('Uso: demo greet')
      expect(long.calls).toEqual([])

      const short = await run(['greet', 'Ana', '--times', '1', '-z'])
      expect(short.stderr).toContain("opção desconhecida: '-z'.")
    })

    it('argumento posicional que falta e que sobra', async () => {
      const missing = await run(['greet', '--times', '1'])
      expect(missing.code).toBe(2)
      expect(missing.stderr).toContain('demo greet: falta o argumento <name>.')

      const extra = await run(['greet', 'Ana', 'Aninha', 'Anita', '--times', '1'])
      expect(extra.code).toBe(2)
      expect(extra.stderr).toContain("argumento inesperado: 'Anita'.")
    })

    it('argumento posicional com vários valores: aceita todos, e exige pelo menos um', async () => {
      const several = await run(['many', 'a', '--flag', 'b', 'c'])
      expect(several.code).toBe(0)
      expect(several.calls).toEqual([['many', ['a', 'b', 'c'], true]])

      const none = await run(['many', '--flag'])
      expect(none.code).toBe(2)
      expect(none.stderr).toContain('demo many: falta o argumento <item>.')
      expect(none.stderr).toContain('Uso: demo many <item>... [--flag]')

      const help = await run(['many', '--help'])
      expect(help.stdout).toContain('Argumentos:\n  item...  Os itens.')
    })

    it('opção obrigatória que falta e opção sem valor', async () => {
      const missing = await run(['greet', 'Ana'])
      expect(missing.code).toBe(2)
      expect(missing.stderr).toContain('a opção --times é obrigatória.')

      const empty = await run(['greet', 'Ana', '--times'])
      expect(empty.code).toBe(2)
      expect(empty.stderr).toContain('a opção --times precisa de um valor.')
    })

    it('valor fora da lista de uma opção enum', async () => {
      const result = await run(['greet', 'Ana', '--times', '1', '--tone', 'gritado'])
      expect(result.code).toBe(2)
      expect(result.stderr).toContain(
        "valor inválido para --tone: 'gritado'. Valores aceitos: formal, casual.",
      )
    })
  })

  describe('comando que roda', () => {
    it('entrega os argumentos, com apelido e a opção em kebab-case', async () => {
      const result = await run(['greet', 'Ana', '--tone', 'formal', '--times=2', '-l', '--dry-run'])
      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.calls).toEqual([['Ana', undefined, 'formal', '2', true, true]])
    })

    it('aceita o argumento opcional, a opção em camelCase e opções antes do argumento', async () => {
      const result = await run(['greet', '--times', '3', 'Ana', 'Aninha', '--dryRun'])
      expect(result.code).toBe(0)
      expect(result.calls).toEqual([['Ana', 'Aninha', undefined, '3', undefined, true]])
    })

    it('roda o comando dentro de um grupo', async () => {
      const result = await run(['group', 'inner', '--flag'])
      expect(result.code).toBe(0)
      expect(result.calls).toEqual([['inner', true]])
    })

    it('depois de "--" a ajuda não é pedida', async () => {
      const result = await run(['greet', '--times', '1', '--', '--help'])
      expect(result.code).toBe(0)
      expect(result.stdout).toBe('')
      expect(result.calls).toEqual([['--help', undefined, undefined, '1', undefined, undefined]])
    })
  })

  describe('códigos de saída do comando', () => {
    it('devolve o código do ExitError e escreve a mensagem', async () => {
      const result = await run(['fail'])
      expect(result).toMatchObject({ code: 7, stdout: '', stderr: 'demo fail: deu errado\n' })
    })

    it('sai calado quando o ExitError não tem mensagem', async () => {
      expect(await run(['silent'])).toMatchObject({ code: 3, stdout: '', stderr: '' })
    })

    it('sai com 1 e mostra o erro quando o comando quebra', async () => {
      const result = await run(['crash'])
      expect(result.code).toBe(1)
      expect(result.stderr).toContain('demo crash: erro inesperado.')
      expect(result.stderr).toContain('estourou')
    })
  })
})
