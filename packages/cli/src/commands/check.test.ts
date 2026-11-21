import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createRoot } from '../root.ts'
import { runCli } from '../run.ts'
import { captureRuntime, makeDir, makeProject } from '../test-support.ts'
import { formatViolation } from './check.ts'

/** Projeto temporário com uma violação (pasta de fora em src/components) ou nenhuma. */
function project(withViolation: boolean): string {
  const dirs = ['src/components/ui', ...(withViolation ? ['src/components/widgets'] : [])]
  return makeProject({}, dirs)
}

async function run(args: string[], cwd?: string) {
  const runtime = captureRuntime(cwd)
  const code = await runCli(createRoot(runtime), args, runtime)
  return { code, stdout: runtime.stdout, stderr: runtime.stderr }
}

describe('prumo check', () => {
  it('sai com 0 e avisa quando não há violação', async () => {
    const result = await run(['check', '--root', project(false)])
    expect(result).toEqual({ code: 0, stdout: 'prumo check: nenhuma violação.\n', stderr: '' })
  })

  it('sai com 1 e lista o arquivo e a regra de cada violação', async () => {
    const result = await run(['check', '--root', project(true)])

    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain(
      "src/components/widgets  [components-folders]  A pasta 'widgets' não é permitida em src/components",
    )
    expect(result.stderr).toContain('prumo check: 1 violação.')
  })

  it('conta várias violações no plural', async () => {
    const root = makeProject({}, [
      'src/components/ui',
      'src/components/widgets',
      'src/components/cards',
    ])
    const result = await run(['check', '--root', root])

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('prumo check: 2 violações.')
  })

  it('usa a pasta atual quando não recebe --root', async () => {
    expect((await run(['check'], project(true))).code).toBe(1)
    expect((await run(['check'], project(false))).code).toBe(0)
  })

  it('aceita --root relativo à pasta atual e --root=<pasta>', async () => {
    const root = project(true)
    const parent = path.dirname(root)

    expect((await run(['check', '--root', path.basename(root)], parent)).code).toBe(1)
    expect((await run(['check', `--root=${root}`])).code).toBe(1)
  })

  it('sai com 2 e explica quando a raiz não existe, não é pasta ou não é um projeto', async () => {
    const base = makeDir()
    const file = path.join(base, 'arquivo.txt')
    writeFileSync(file, '')
    const withoutSrc = path.join(base, 'sem-src')
    mkdirSync(withoutSrc)
    writeFileSync(path.join(withoutSrc, 'package.json'), '{}')
    const withoutPackage = path.join(base, 'sem-package')
    mkdirSync(path.join(withoutPackage, 'src'), { recursive: true })
    const srcIsFile = path.join(base, 'src-arquivo')
    mkdirSync(srcIsFile)
    writeFileSync(path.join(srcIsFile, 'package.json'), '{}')
    writeFileSync(path.join(srcIsFile, 'src'), '')

    const cases: [string, string][] = [
      [path.join(base, 'nao-existe'), 'não existe'],
      [file, 'não é uma pasta'],
      [withoutSrc, 'não tem src'],
      [withoutPackage, 'não tem package.json'],
      [srcIsFile, 'não tem src'],
    ]
    for (const [root, reason] of cases) {
      const result = await run(['check', '--root', root])
      expect(result.code, root).toBe(2)
      expect(result.stdout).toBe('')
      expect(result.stderr, root).toContain('prumo check: ')
      expect(result.stderr, root).toContain(reason)
      expect(result.stderr, root).toContain(root)
      expect(result.stderr, root).toContain('Uso: prumo check [--root <pasta>]')
    }
  })

  it('sem --root, a pasta atual que não é projeto também sai com 2', async () => {
    const result = await run(['check'], makeDir())
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('não tem package.json')
  })

  it('mostra a ajuda com --help ou -h e sai com 0', async () => {
    for (const flag of ['--help', '-h']) {
      const result = await run(['check', flag])
      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('Uso: prumo check [--root <pasta>]')
      expect(result.stdout).toContain('--root <pasta>  Pasta do projeto, a que tem o src.')
      expect(result.stdout).toContain('-h, --help')
      expect(result.stdout).toContain('Sai com código 1 quando há violação')
    }
  })

  it('sai com 2 e mostra o uso quando a opção não existe, falta o valor ou sobra argumento', async () => {
    const cases: [string[], string][] = [
      [['--nope'], "opção desconhecida: '--nope'"],
      [['--root'], 'a opção --root precisa de um valor'],
      [['--root='], 'a opção --root precisa de um valor'],
      [['extra'], "argumento inesperado: 'extra'"],
      [['-x'], "opção desconhecida: '-x'"],
    ]
    for (const [args, reason] of cases) {
      const result = await run(['check', ...args], project(false))
      expect(result.code, args.join(' ')).toBe(2)
      expect(result.stdout).toBe('')
      expect(result.stderr, args.join(' ')).toContain(`prumo check: ${reason}`)
      expect(result.stderr, args.join(' ')).toContain('Uso: prumo check')
    }
  })

  it('formata a violação com arquivo, regra e mensagem', () => {
    expect(formatViolation({ rule: 'messages', file: 'a.json', message: 'quebrou' })).toBe(
      'a.json  [messages]  quebrou',
    )
  })
})

describe('bin prumo', () => {
  const bin = path.join(import.meta.dirname, '..', 'bin.ts')
  const node = (args: string[], cwd?: string) =>
    spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', cwd })

  it('roda o check de verdade, com código de saída 1 e a violação no stderr', () => {
    const result = node(['check', '--root', project(true)])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('[components-folders]')
  })

  it('sai com 0 num projeto limpo, e a pasta atual é a raiz padrão', () => {
    const result = node(['check'], project(false))
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('prumo check: nenhuma violação.\n')
  })

  it('sai com 2 no bin quando a raiz não existe', () => {
    const result = node(['check', '--root', path.join(tmpdir(), 'prumo-cli-nao-existe')])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('não existe')
  })

  it('lista os comandos sem argumentos e com --help', () => {
    for (const args of [[], ['--help'], ['-h']]) {
      const result = node(args)
      expect(result.status, args.join(' ')).toBe(0)
      expect(result.stdout).toContain('Uso: prumo <comando> [opções]')
      expect(result.stdout).toContain(
        'check  Analisa o projeto e lista as violações da arquitetura.',
      )
    }
  })

  it('mostra a sintaxe de um comando com <comando> --help', () => {
    const result = node(['check', '--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Uso: prumo check [--root <pasta>]')
  })

  it('recusa comando e opção desconhecidos com 2', () => {
    const command = node(['deploy'])
    expect(command.status).toBe(2)
    expect(command.stderr).toContain("prumo: comando desconhecido: 'deploy'.")
    expect(command.stderr).toContain('Comandos:')

    const option = node(['--nope'])
    expect(option.status).toBe(2)
    expect(option.stderr).toContain("prumo: opção desconhecida: '--nope'.")

    const checkOption = node(['check', '--nope'])
    expect(checkOption.status).toBe(2)
    expect(checkOption.stderr).toContain("prumo check: opção desconhecida: '--nope'.")
  })
})
