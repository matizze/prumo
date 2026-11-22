import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import { makeRegistryDir, startRegistry, uiProject } from '../../cli/src/add/ui-test-support.ts'
import { REPOSITORY, makeDir, makeProject } from './test-support.ts'

const BIN = path.resolve(import.meta.dirname, 'bin.ts')

/** Uma sessão com o bin por stdio: manda JSON-RPC e guarda as linhas cruas do stdout. */
class Session {
  readonly stdoutLines: string[] = []
  stderr = ''
  private readonly child: ChildProcessWithoutNullStreams
  private buffer = ''
  private nextId = 1
  private readonly waiting = new Map<number, (message: Record<string, unknown>) => void>()
  private readonly exited: Promise<number | null>

  constructor(cwd: string, env: Record<string, string> = {}) {
    this.child = spawn(process.execPath, [BIN], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child.stderr.on('data', (chunk: Buffer) => (this.stderr += String(chunk)))
    this.child.stdout.on('data', (chunk: Buffer) => {
      this.buffer += String(chunk)
      let at: number
      while ((at = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, at)
        this.buffer = this.buffer.slice(at + 1)
        this.stdoutLines.push(line)
        const message = JSON.parse(line) as Record<string, unknown>
        if (typeof message.id === 'number') this.waiting.get(message.id)?.(message)
      }
    })
    this.exited = new Promise((resolve) => this.child.on('close', resolve))
    sessions.push(this)
  }

  private write(message: object) {
    this.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  request(method: string, params?: object): Promise<Record<string, unknown>> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`sem resposta a ${method}: ${this.stderr}`)),
        60_000,
      )
      this.waiting.set(id, (message) => {
        clearTimeout(timer)
        resolve(message)
      })
      this.write({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })
    })
  }

  async initialize() {
    const response = await this.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'teste', version: '0.0.0' },
    })
    this.write({ jsonrpc: '2.0', method: 'notifications/initialized' })
    return response
  }

  /** Chama a ferramenta e devolve o texto, e se foi erro. */
  async call(name: string, args: object): Promise<{ text: string; isError: boolean }> {
    const response = await this.request('tools/call', { name, arguments: args })
    const result = response.result as { content: Array<{ text: string }>; isError?: boolean }
    return {
      text: result.content.map((block) => block.text).join(''),
      isError: Boolean(result.isError),
    }
  }

  /** Fecha o stdin, como o cliente que sai, e espera o servidor encerrar. */
  async close(): Promise<number | null> {
    this.child.stdin.end()
    return this.exited
  }

  kill() {
    this.child.kill('SIGKILL')
  }
}

const sessions: Session[] = []
afterAll(() => {
  for (const session of sessions) session.kill()
})

describe('o bin prumo-mcp', () => {
  it('--help e --version escrevem e saem com 0, sem subir o servidor', () => {
    const help = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8', cwd: makeDir() })
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('Uso: prumo-mcp')
    expect(help.stdout).toContain('pnpm')

    const version = spawnSync(process.execPath, [BIN, '--version'], { encoding: 'utf8' })
    expect(version.status).toBe(0)
    expect(version.stdout).toBe(`${pkg.version}\n`)
  })

  it('uma opção desconhecida sai com 2, no stderr', () => {
    const result = spawnSync(process.execPath, [BIN, '--foo'], { encoding: 'utf8' })
    expect(result.status).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain("opção desconhecida: '--foo'")
  })

  it('o package.json declara o bin e o arquivo é executável com shebang', () => {
    expect(pkg.bin).toEqual({ 'prumo-mcp': './src/bin.ts' })
    expect(readFileSync(BIN, 'utf8').startsWith('#!/usr/bin/env node\n')).toBe(true)
  })

  it('inicializa por stdio e responde com o nome e a versão', async () => {
    const session = new Session(makeProject())
    const response = await session.initialize()

    expect(response.result).toMatchObject({
      serverInfo: { name: 'prumo', version: pkg.version },
      capabilities: { tools: {} },
    })
    expect(await session.close()).toBe(0)
  })
})

describe('o stdout do bin é o protocolo', () => {
  it('só tem JSON-RPC, e nada do que os comandos escreveram está fora das respostas', async () => {
    const project = uiProject()
    const registry = await startRegistry(makeRegistryDir())
    const env = { MADS_REGISTRY_URL: registry.url, MADS_REGISTRY_TOKEN: 'segredo' }
    const session = new Session(project, env)
    await session.initialize()

    const calls: Array<[string, object]> = [
      ['make_page', { nome: 'produtos', like: 'products-list', 'dry-run': true }],
      ['doctor', {}],
      ['check', {}],
      // O shadcn de mentira escreve no stderr quando falha: o texto tem de vir dentro da resposta
      ['add', { item: ['@mads/inexistente'] }],
      ['add', { item: ['@mads/button'] }],
      ['new', { nome: 'loja', dir: 'filhos', 'dry-run': true, install: false, from: REPOSITORY }],
    ]
    const results: Array<{ text: string; isError: boolean }> = []
    for (const [name, args] of calls) results.push(await session.call(name, args))

    // make_page --dry-run
    expect(results[0]?.isError, results[0]?.text).toBe(false)
    expect(results[0]?.text).toContain('Simulação (--dry-run): nada foi escrito.')
    // doctor: o que escreveu, voltou na resposta (sucesso ou aviso, o importante é a saída estar nela)
    expect(results[1]?.text).toContain('prumo doctor')
    // check
    expect(results[2]?.text).toBe('prumo check: nenhuma violação.\n')
    // add com falha do shadcn: o stderr do filho chegou à resposta, não ao stderr do servidor
    expect(results[3]?.isError).toBe(true)
    expect(results[3]?.text).toContain('shadcn de mentira')
    expect(results[3]?.text).toContain('[saída 1]')
    // add que instala: o filho rodou, o arquivo existe
    expect(results[4]?.isError, results[4]?.text).toBe(false)
    expect(readFileSync(path.join(project, 'src/components/ui/button.tsx'), 'utf8')).toContain(
      'Button',
    )
    // new --dry-run
    expect(results[5]?.isError, results[5]?.text).toBe(false)
    expect(results[5]?.text).toContain('Simulação (--dry-run): nada foi escrito.')

    expect(await session.close()).toBe(0)

    // Cada linha do stdout é uma mensagem JSON-RPC, e há uma resposta por requisição e nada mais
    const messages = session.stdoutLines.map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(messages.length).toBe(1 + calls.length)
    for (const message of messages) expect(message.jsonrpc).toBe('2.0')
    expect(
      messages.every((message) => 'id' in message && ('result' in message || 'error' in message)),
    ).toBe(true)
    // O que os filhos escreveram não vazou: o stderr do servidor não tem o texto do shadcn
    expect(session.stderr).not.toContain('shadcn de mentira')
  }, 120_000)
})
