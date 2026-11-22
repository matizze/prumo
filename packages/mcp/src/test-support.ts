import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client, InMemoryTransport, type CallToolResult } from '@modelcontextprotocol/client'
import { afterAll } from 'vitest'
import { createServer, type ServerOptions } from './server.ts'

/**
 * O projeto de fixture do cli (o app em miniatura do codemod) e a raiz do monorepo: os testes do mcp
 * usam os mesmos que os do cli, em vez de manter uma cópia. Só os testes leem estes caminhos; o pacote
 * publicado não os tem.
 */
const FIXTURE_APP = path.resolve(import.meta.dirname, '../../cli/src/codemod/__fixtures__/app')

/** A raiz do monorepo, a origem (`--from`) que tem o `catalog/index.json` e o `starter/`. */
export const REPOSITORY = path.resolve(import.meta.dirname, '../../..')

const created: string[] = []
afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true })
})

/** Uma pasta temporária vazia, que some quando os testes do arquivo terminam. */
export function makeDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'prumo-mcp-'))
  created.push(dir)
  return dir
}

/** Uma cópia do app em miniatura, numa pasta temporária. Devolve a raiz. */
export function makeProject(): string {
  const root = makeDir()
  cpSync(FIXTURE_APP, root, { recursive: true })
  return root
}

const clients: Client[] = []
afterAll(async () => {
  for (const client of clients) await client.close()
})

/** Sobe o servidor num transporte em memória e devolve o cliente do SDK ligado a ele. */
export async function connect(options: ServerOptions): Promise<Client> {
  const { server } = await createServer(options)
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'teste', version: '0.0.0' })
  clients.push(client)
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  return client
}

/** O texto de um resultado de ferramenta (o primeiro e único bloco de texto). */
export function textOf(result: CallToolResult): string {
  const [block, ...others] = result.content
  if (block?.type !== 'text' || others.length > 0) {
    throw new Error(`esperava um bloco de texto só: ${JSON.stringify(result.content)}`)
  }
  return block.text
}
