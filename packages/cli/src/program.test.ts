import { readFileSync } from 'node:fs'
import { InvalidArgumentError, Option } from 'commander'
import { describe, expect, it } from 'vitest'
import type { RegisterCommand } from './commands/index.ts'
import { ExitError, UsageError } from './errors.ts'
import { execute, run } from './program.ts'
import { captureIo } from './test/run.ts'

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string }

/** Comandos de mentira, para cobrir o que os comandos reais vão usar. */
const fake: RegisterCommand = (program) => {
  program
    .command('greet')
    .description('Cumprimenta alguém.')
    .argument('<nome>', 'Quem cumprimentar.')
    .option('--root <pasta>', 'A pasta do projeto.')
    .option('--times <n>', 'Quantas vezes.', (value) => {
      if (!/^\d+$/.test(value)) throw new InvalidArgumentError('Use um número inteiro.')
      return Number(value)
    })
    .addOption(new Option('--mode <modo>', 'O modo.').choices(['a', 'b']).default('a'))
    .action(() => {})
  program.command('misuse').action(() => {
    throw new UsageError('o nome já existe.')
  })
  program
    .command('parse-fail')
    .option('--fields <campos>', 'Os campos.', (value) => {
      throw new UsageError(`campo inválido: ${value}.`)
    })
    .action(() => {})
  program.command('crash').action(() => {
    throw new Error('quebrou')
  })
  program.command('exit-three').action(() => {
    throw new ExitError(3, 'violação encontrada.')
  })
  program.command('group').description('Um grupo.').command('sub').description('Um subcomando.')
}

async function exec(
  argv: string[],
  commands: readonly RegisterCommand[] = [fake],
  env?: Readonly<Record<string, string | undefined>>,
) {
  const { io, stdout, stderr } = captureIo('/tmp', { env })
  const outcome = await execute(argv, io, commands)
  return { code: outcome.code, kind: outcome.kind, out: stdout(), err: stderr() }
}

/** Palavras que o commander escreve em inglês e que nada do que sai pode ter. */
const ENGLISH = /\b(usage|options?|commands?|arguments?|error|unknown|missing|required|display|output|invalid|default|choices|did you mean|too many|expected)\b/i

describe('ajuda', () => {
  it('mostra a ajuda da raiz em português, na saída padrão, com saída 0', async () => {
    const { code, out, err } = await exec(['--help'])
    expect(code).toBe(0)
    expect(err).toBe('')
    expect(out).toContain('Uso: prumo [opções] [comando]')
    expect(out).toContain(
      'Prumo, a ferramenta da Matizze que cria e confere a arquitetura de apps React.',
    )
    expect(out).toContain('Opções:')
    expect(out).toContain('-v, --version')
    expect(out).toContain('Mostra a versão.')
    expect(out).toContain('-h, --help')
    expect(out).toContain('Mostra esta ajuda.')
    expect(out).toContain('Comandos:')
    expect(out).toContain('greet [opções] <nome>')
    expect(out).not.toMatch(ENGLISH)
  })

  it('a ajuda não termina com linha em branco', async () => {
    for (const argv of [['--help'], ['greet', '--help'], ['help', 'greet']]) {
      const { out } = await exec(argv)
      expect(out.endsWith('\n') && !out.endsWith('\n\n'), argv.join(' ')).toBe(true)
    }
  })

  it('termina com o link da documentação, só na raiz', async () => {
    expect((await exec(['--help'])).out).toContain(
      '\nDocumentação: https://docs.prumo.matizze.com.br/reference/cli\n',
    )
    expect((await exec(['greet', '--help'])).out).not.toContain('Documentação:')
  })

  it('aceita -h', async () => {
    const { code, out } = await exec(['-h'])
    expect(code).toBe(0)
    expect(out).toContain('Uso: prumo')
  })

  it('mostra a ajuda de um subcomando, com argumentos, opções e valores', async () => {
    const { code, out, err } = await exec(['greet', '--help'])
    expect(code).toBe(0)
    expect(err).toBe('')
    expect(out).toContain('Uso: prumo greet [opções] <nome>')
    expect(out).toContain('Cumprimenta alguém.')
    expect(out).toContain('Argumentos:')
    expect(out).toContain('Quem cumprimentar.')
    expect(out).toContain('--root <pasta>')
    expect(out).toContain('(valores: "a", "b", padrão: "a")')
    expect(out).toContain('Mostra esta ajuda.')
    expect(out).not.toMatch(ENGLISH)
  })

  it('mostra a ajuda quando não há argumento, com saída 0', async () => {
    const withArgs = await exec([])
    const help = await exec(['--help'])
    expect(withArgs).toEqual({ code: 0, kind: 'ok', out: help.out, err: '' })
  })

  it('funciona sem nenhum comando registrado', async () => {
    const { code, out } = await exec([], [])
    expect(code).toBe(0)
    expect(out).toContain('Uso: prumo [opções]')
    expect(out).not.toContain('greet')
  })
})

describe('prumo help', () => {
  it('mostra a ajuda de um comando, com saída 0', async () => {
    const help = await exec(['greet', '--help'])
    const viaHelp = await exec(['help', 'greet'])
    expect(viaHelp.code).toBe(0)
    expect(viaHelp.out).toContain('Uso: prumo greet [opções] <nome>')
    expect(viaHelp).toEqual(help)
  })

  it('sem comando, mostra a ajuda da raiz, com a descrição em português', async () => {
    const { code, out } = await exec(['help'])
    expect(code).toBe(0)
    expect(out).toContain('help [comando]')
    expect(out).toContain('Mostra a ajuda de um comando.')
    expect(out).not.toMatch(ENGLISH)
  })

  it.each([
    ['nada', "comando desconhecido: 'nada'."],
    ['help', "comando desconhecido: 'help'."],
  ])('prumo help %s: erro de comando desconhecido, com saída 2', async (name, message) => {
    const { code, out, err } = await exec(['help', name])
    expect(code).toBe(2)
    expect(out).toBe('')
    expect(err).toBe(`prumo: ${message}\n\nUso: prumo [opções] [comando]\nVeja 'prumo --help'.\n`)
  })

  it('prumo help com nome parecido sugere o comando', async () => {
    const { code, err } = await exec(['help', 'gret'])
    expect(code).toBe(2)
    expect(err).toContain("prumo: comando desconhecido: 'gret'. Você quis dizer greet?")
  })

  it('só existe na raiz', async () => {
    const { code, err } = await exec(['group', 'help'])
    expect(code).toBe(2)
    expect(err).toContain("comando desconhecido: 'help'")
  })
})

describe('versão', () => {
  it.each(['--version', '-v'])('%s mostra a versão do package.json', async (flag) => {
    const result = await exec([flag])
    expect(result).toEqual({ code: 0, kind: 'ok', out: `${version}\n`, err: '' })
  })
})

describe('erros de uso (saída 2)', () => {
  /** Erro do commander: a mensagem, a linha de uso e o "Veja", sem a ajuda inteira. */
  async function usageError(argv: string[], message: string, usageOf: string) {
    const helpCommand = usageOf.split(' [')[0]
    const { code, kind, out, err } = await exec(argv)
    expect(code).toBe(2)
    expect(kind).toBe('usage')
    expect(out).toBe('')
    expect(err).toBe(`prumo: ${message}\n\nUso: ${usageOf}\nVeja '${helpCommand} --help'.\n`)
    expect(err).not.toMatch(ENGLISH)
  }

  /** Erro lançado pelo comando: só a mensagem. */
  async function actionError(argv: string[], message: string) {
    const { code, kind, out, err } = await exec(argv)
    expect({ code, kind, out, err }).toEqual({ code: 2, kind: 'usage', out: '', err: `prumo: ${message}\n` })
  }

  it('comando desconhecido, com sugestão', async () => {
    await usageError(['gret'], "comando desconhecido: 'gret'. Você quis dizer greet?", 'prumo [opções] [comando]')
  })

  it('comando desconhecido sem nenhum comando registrado', async () => {
    const { code, err } = await exec(['foo'], [])
    expect(code).toBe(2)
    expect(err).toBe("prumo: comando desconhecido: 'foo'.\n\nUso: prumo [opções]\nVeja 'prumo --help'.\n")
  })

  it('opção desconhecida na raiz', async () => {
    await usageError(['--x'], "opção desconhecida: '--x'.", 'prumo [opções] [comando]')
  })

  it('opção desconhecida num subcomando, com a ajuda dele e a sugestão', async () => {
    await usageError(
      ['greet', 'ana', '--rot', 'x'],
      "opção desconhecida: '--rot'. Você quis dizer --root?",
      'prumo greet [opções] <nome>',
    )
  })

  it('argumento que falta', async () => {
    await usageError(['greet'], 'falta o argumento <nome>.', 'prumo greet [opções] <nome>')
  })

  it('opção sem valor', async () => {
    await usageError(
      ['greet', 'ana', '--root'],
      "a opção '--root <pasta>' precisa de um valor.",
      'prumo greet [opções] <nome>',
    )
  })

  it('argumento a mais', async () => {
    await usageError(
      ['greet', 'ana', 'bia', 'caio'],
      "argumentos a mais: 'bia', 'caio'.",
      'prumo greet [opções] <nome>',
    )
    await usageError(['greet', 'ana', 'bia'], "argumento a mais: 'bia'.", 'prumo greet [opções] <nome>')
  })

  it('valor inválido, com o motivo do comando', async () => {
    await usageError(
      ['greet', 'ana', '--times', 'x'],
      "valor inválido para a opção '--times <n>': 'x'. Use um número inteiro.",
      'prumo greet [opções] <nome>',
    )
  })

  it('valor fora das opções permitidas', async () => {
    await usageError(
      ['greet', 'ana', '--mode', 'z'],
      "valor inválido para a opção '--mode <modo>': 'z'. Valores aceitos: a, b.",
      'prumo greet [opções] <nome>',
    )
  })

  it('UsageError lançado pelo comando mostra só a mensagem, sem a ajuda nem o "Veja"', async () => {
    await actionError(['misuse'], 'o nome já existe.')
  })

  it('UsageError lançado pelo parser de uma opção sai como erro de parse: linha de uso e "Veja"', async () => {
    await usageError(['parse-fail', '--fields', 'x'], 'campo inválido: x.', 'prumo parse-fail [opções]')
  })

  it('UsageError lançado pelo parser num subcomando de um grupo traz o uso dele', async () => {
    const nested: RegisterCommand = (program) => {
      program
        .command('outer')
        .command('inner')
        .option('--n <n>', 'Um número.', () => {
          throw new UsageError('número inválido.')
        })
        .action(() => {})
    }
    const { code, err } = await exec(['outer', 'inner', '--n', '1'], [nested])
    expect(code).toBe(2)
    expect(err).toBe(
      "prumo: número inválido.\n\nUso: prumo outer inner [opções]\nVeja 'prumo outer inner --help'.\n",
    )
  })

  it('erro ao montar o programa (comando duplicado) sai com 1 e a mensagem de erro inesperado', async () => {
    const twice: RegisterCommand = (program) => {
      program.command('dup').action(() => {})
      program.command('dup').action(() => {})
    }
    const { code, out, err } = await exec(['dup'], [twice])
    expect(code).toBe(1)
    expect(out).toBe('')
    expect(err).toContain('prumo: erro inesperado:')
  })

  it('grupo chamado sem subcomando sai com 2', async () => {
    const { code, out } = await exec(['group'])
    expect(code).toBe(2)
    expect(out).toBe('')
  })
})

describe('outros códigos de saída', () => {
  it('ExitError sai com o código dele e escreve a mensagem no stderr', async () => {
    expect(await exec(['exit-three'])).toEqual({
      code: 3,
      kind: 'exit',
      out: '',
      err: 'violação encontrada.\n',
    })
  })

  it('erro inesperado sai com 1, com a mensagem e sem a pilha', async () => {
    const { code, kind, out, err } = await exec(['crash'])
    expect({ code, kind, out }).toEqual({ code: 1, kind: 'unexpected', out: '' })
    expect(err).toBe(
      'prumo: erro inesperado: quebrou\nRode de novo com PRUMO_DEBUG=1 para ver a pilha.\n',
    )
  })

  it.each(['1', 'true', 'sim'])('com PRUMO_DEBUG=%s, o erro inesperado traz a pilha', async (value) => {
    const { code, err } = await exec(['crash'], [fake], { PRUMO_DEBUG: value })
    expect(code).toBe(1)
    expect(err).toContain('prumo: erro inesperado: quebrou\n')
    expect(err).toContain('Error: quebrou')
    expect(err).toContain('at ')
    expect(err).not.toContain('Rode de novo')
  })

  it.each(['', '0', 'false'])('com PRUMO_DEBUG=%j, a pilha não aparece', async (value) => {
    const { err } = await exec(['crash'], [fake], { PRUMO_DEBUG: value })
    expect(err).toContain('Rode de novo com PRUMO_DEBUG=1')
    expect(err).not.toContain('at ')
  })

  it('ExitError e sucesso têm o tipo próprio', async () => {
    expect((await exec(['exit-three'])).kind).toBe('exit')
    expect((await exec(['greet', 'ana'])).kind).toBe('ok')
  })

  it('o run devolve só o código', async () => {
    expect(await run(['exit-three'], captureIo('/tmp').io, [fake])).toBe(3)
  })
})

describe('idioma', () => {
  it('nada do que sai tem palavra do commander em inglês', async () => {
    const cases = [
      ['--help'],
      [],
      ['greet', '-h'],
      ['group', '--help'],
      ['--x'],
      ['nope'],
      ['greet'],
      ['greet', 'ana', '--root'],
      ['greet', 'ana', 'bia'],
      ['greet', 'ana', '--times', 'x'],
      ['greet', 'ana', '--mode', 'z'],
      ['greet', 'ana', '--nope'],
    ]
    for (const argv of cases) {
      const { out, err } = await exec(argv)
      expect(`${out}${err}`, argv.join(' ')).not.toMatch(ENGLISH)
    }
  })
})
