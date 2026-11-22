import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeOrigin } from './add/test-support.ts'
import { describeCommands, toArgv } from './describe.ts'
import { runInProcess } from './in-process.ts'
import { createRoot } from './root.ts'
import { makeStarterOrigin } from './new/test-support.ts'
import { captureRuntime, makeDir, makeProject } from './test-support.ts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

/** Um projeto com uma tela fora da estrutura (sem model.ts nem view.tsx): o `check` acusa. */
const brokenProject = () => makeProject({ 'src/pages/solta/index.tsx': 'export {}\n' })

describe('runInProcess', () => {
  it('devolve o código 0 e o que o comando escreveu no stdout', async () => {
    const result = await runInProcess(['catalog', 'badge', '--from', makeOrigin()], {
      cwd: makeDir(),
    })

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'status-badge — block — status-badge\n\n1 item.\n',
      stderr: '',
    })
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

    const missing = await runInProcess(['make:page'], { cwd: makeProject({}) })
    expect(missing.exitCode).toBe(2)
    expect(missing.stderr).toContain('falta o argumento <nome>')
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
    const origin = makeOrigin()
    const first = await runInProcess(['catalog', 'badge', '--from', origin], { cwd: makeDir() })
    const second = await runInProcess(['catalog', 'settings', '--from', origin], {
      cwd: makeDir(),
    })
    const failing = await runInProcess(['nao-existe'], { cwd: makeDir() })
    const after = await runInProcess(['catalog', 'badge', '--from', origin], { cwd: makeDir() })

    expect(first.stdout).toContain('status-badge')
    expect(second.stdout).not.toContain('status-badge')
    expect(second.stdout).toContain('page-settings-security')
    expect(failing.stdout).toBe('')
    expect(after).toEqual(first)
  })

  it('chamadas em paralelo também ficam separadas', async () => {
    const origin = makeOrigin()
    const [badge, orders] = await Promise.all([
      runInProcess(['catalog', 'badge', '--from', origin], { cwd: makeDir() }),
      runInProcess(['catalog', 'repo-orders', '--from', origin], { cwd: makeDir() }),
    ])

    expect(badge.stdout).toContain('1 item.')
    expect(badge.stdout).not.toContain('repo-orders')
    expect(orders.stdout).toContain('repo-orders')
    expect(orders.stdout).not.toContain('status-badge')
  })

  it('não escreve no stdout nem no stderr do processo', async () => {
    const out = vi.spyOn(process.stdout, 'write')
    const err = vi.spyOn(process.stderr, 'write')

    await runInProcess(['catalog', '--from', makeOrigin()], { cwd: makeDir() })
    await runInProcess(['check'], { cwd: brokenProject() })
    await runInProcess(['nao-existe'], { cwd: makeDir() })

    expect(out).not.toHaveBeenCalled()
    expect(err).not.toHaveBeenCalled()
  })

  it('não lê o process.env: o ambiente é o dado, e vazio por padrão', async () => {
    vi.stubEnv('NODE_AUTH_TOKEN', 'token-do-processo')
    const args = ['new', 'meu-produto', '--from', makeStarterOrigin()]

    // Sem a variável no env dado, o new recusa antes de escrever, apesar do token do processo
    const without = await runInProcess(args, { cwd: makeDir() })
    expect(without.exitCode).toBe(2)
    expect(without.stderr).toContain('falta a variável NODE_AUTH_TOKEN')

    const empty = await runInProcess(args, { cwd: makeDir(), env: {} })
    expect(empty.exitCode).toBe(2)
  })

  it('não é interativo: onde o comando perguntaria, ele recusa e diz o comando que resolve', async () => {
    const root = makeProject({
      'src/components/shared/status-badge.tsx': 'export {}\n',
    })
    // O add de uma página que precisa de UI que o projeto não tem pergunta no terminal; aqui recusa
    const result = await runInProcess(['add', 'page-orders', '--from', makeOrigin()], {
      cwd: root,
    })

    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('prumo add @mads/')
  })
  it('roda a linha que o toArgv monta a partir de um comando descrito, como o servidor MCP fará', async () => {
    const commands = await describeCommands(createRoot(captureRuntime()))
    const catalog = commands.find((command) => command.name === 'catalog')!

    const result = await runInProcess(
      [
        ...catalog.path,
        ...toArgv(catalog, { busca: 'orders', kind: 'page', from: makeOrigin(), json: true }),
      ],
      { cwd: makeDir() },
    )

    expect(result.exitCode, result.stderr).toBe(0)
    expect((JSON.parse(result.stdout) as { items: Array<{ name: string }> }).items).toEqual([
      expect.objectContaining({ name: 'page-orders' }),
    ])
  })
})
