import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../test/fixture-project.ts'
import { makeDir } from '../test/fs.ts'

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin.ts')
const version = (
  JSON.parse(readFileSync(path.join(path.dirname(BIN), '..', 'package.json'), 'utf8')) as {
    version: string
  }
).version

describe('prumo mcp, por subprocesso', () => {
  it('só o protocolo vai para o stdout, e o servidor fecha quando o cliente fecha', async () => {
    const { root } = fixtureProject()
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [BIN, 'mcp'],
      cwd: root,
      stderr: 'ignore',
    })
    const client = new Client({ name: 'teste', version: '0.0.0' })
    await client.connect(transport)
    expect(client.getServerVersion()).toMatchObject({ name: 'prumo', version })

    const { tools } = await client.listTools()
    expect(tools).toHaveLength(6)
    const made = await client.callTool({
      name: 'make_schema',
      arguments: { dominio: 'livros', fields: 'title:string' },
    })
    expect(made.isError).not.toBe(true)

    const pid = transport.pid
    expect(pid).not.toBeNull()
    await client.close()
    // O processo some: kill(0) falha com ESRCH
    await expect.poll(() => alive(pid as number), { timeout: 5000 }).toBe(false)
  })

  it('o stdout é só JSON-RPC (cru, sem o cliente)', async () => {
    const { root } = fixtureProject()
    const child = spawn(process.execPath, [BIN, 'mcp'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (chunk: Buffer) => void (out += chunk.toString()))
    const request = (id: number, method: string, params: object) =>
      JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
    child.stdin.write(
      request(1, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'cru', version: '0' },
      }),
    )
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    child.stdin.write(request(2, 'tools/list', {}))
    await expect.poll(() => out.split('\n').filter(Boolean).length, { timeout: 5000 }).toBeGreaterThanOrEqual(2)
    child.stdin.end()
    const [code] = (await once(child, 'exit')) as [number | null]
    expect(code).toBe(0)
    for (const line of out.split('\n').filter(Boolean)) {
      expect(JSON.parse(line)).toMatchObject({ jsonrpc: '2.0' })
    }
  })

  it('sai com 2 fora de um projeto, sem abrir o servidor', async () => {
    const child = spawn(process.execPath, [BIN, 'mcp'], { cwd: makeDir(), stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk: Buffer) => void (out += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => void (err += chunk.toString()))
    const [code] = (await once(child, 'exit')) as [number | null]
    expect(code).toBe(2)
    expect(out).toBe('')
    expect(err).toContain('package.json')
  })
})

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
