import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeCommands, toArgv } from './describe.ts'
import { runInProcess } from './in-process.ts'
import { createRoot } from './root.ts'
import { captureRuntime, makeDir, makeProject } from './test-support.ts'

afterEach(() => vi.restoreAllMocks())

/** Um projeto com uma tela fora da estrutura (sem model.ts nem view.tsx): o `check` acusa. */
const brokenProject = () => makeProject({ 'src/pages/solta/index.tsx': 'export {}\n' })

describe('runInProcess', () => {
  it('devolve o código 0 e o que o comando escreveu no stdout', async () => {
    const result = await runInProcess(['check'], {
      cwd: makeProject({ 'src/main.ts': 'export {}\n' }),
    })

    expect(result).toEqual({ exitCode: 0, stdout: 'prumo check: nenhuma violação.\n', stderr: '' })
  })

  it('devolve o código 1 com a saída do comando que falha, sem lançar', async () => {
    const result = await runInProcess(['check'], { cwd: brokenProject() })

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('src/pages/solta')
    expect(result.stderr).toContain('prumo check: 2 violações.')
  })

  it('devolve o código 2 para uso errado, com a mensagem em português no stderr', async () => {
    const unknown = await runInProcess(['nao-existe'], { cwd: makeDir() })
    expect(unknown.exitCode).toBe(2)
    expect(unknown.stderr).toContain("comando desconhecido: 'nao-existe'.")

    const option = await runInProcess(['check', '--nope'], { cwd: makeProject({}) })
    expect(option.exitCode).toBe(2)
    expect(option.stderr).toContain("opção desconhecida: '--nope'.")
  })

  it('devolve a ajuda no stdout com 0', async () => {
    const result = await runInProcess(['check', '--help'], { cwd: makeDir() })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Uso: prumo check')
  })

  it('o cwd é o dado: o mesmo comando em duas pastas dá dois resultados', async () => {
    const ok = await runInProcess(['check'], { cwd: makeProject({ 'src/main.ts': 'export {}\n' }) })
    const broken = await runInProcess(['check'], { cwd: brokenProject() })
    const notProject = await runInProcess(['check'], { cwd: makeDir() })

    expect([ok.exitCode, broken.exitCode, notProject.exitCode]).toEqual([0, 1, 2])
    expect(ok.stdout).toBe('prumo check: nenhuma violação.\n')
    expect(notProject.stderr).toContain('não tem package.json')
  })

  it('não lê o process.cwd: um --root relativo vale a partir do cwd dado', async () => {
    const project = brokenProject()
    const parent = project.split('/').slice(0, -1).join('/')
    const name = project.split('/').at(-1)!

    const result = await runInProcess(['check', `--root=${name}`], { cwd: parent })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('src/pages/solta')
  })

  it('duas chamadas em sequência não compartilham estado: a saída de uma não aparece na outra', async () => {
    const broken = brokenProject()
    const first = await runInProcess(['check'], { cwd: broken })
    const failing = await runInProcess(['nao-existe'], { cwd: makeDir() })
    const after = await runInProcess(['check'], { cwd: broken })

    expect(first.exitCode).toBe(1)
    expect(failing.stdout).toBe('')
    expect(after).toEqual(first)
  })

  it('chamadas em paralelo também ficam separadas', async () => {
    const [ok, broken] = await Promise.all([
      runInProcess(['check'], { cwd: makeProject({ 'src/main.ts': 'export {}\n' }) }),
      runInProcess(['check'], { cwd: brokenProject() }),
    ])

    expect(ok.stdout).toBe('prumo check: nenhuma violação.\n')
    expect(ok.stderr).toBe('')
    expect(broken.stdout).toBe('')
    expect(broken.stderr).toContain('src/pages/solta')
  })

  it('não escreve no stdout nem no stderr do processo', async () => {
    const out = vi.spyOn(process.stdout, 'write')
    const err = vi.spyOn(process.stderr, 'write')

    await runInProcess(['check'], { cwd: brokenProject() })
    await runInProcess(['nao-existe'], { cwd: makeDir() })

    expect(out).not.toHaveBeenCalled()
    expect(err).not.toHaveBeenCalled()
  })

  it('roda a linha que o toArgv monta a partir de um comando descrito, como o servidor MCP faz', async () => {
    const commands = await describeCommands(createRoot(captureRuntime()))
    const check = commands.find((command) => command.name === 'check')!

    const result = await runInProcess(
      [...check.path, ...toArgv(check, { root: brokenProject() })],
      {
        cwd: makeDir(),
      },
    )

    expect(result.exitCode, result.stderr).toBe(1)
    expect(result.stderr).toContain('src/pages/solta')
  })
})
