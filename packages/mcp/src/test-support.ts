import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client, InMemoryTransport, type CallToolResult } from '@modelcontextprotocol/client'
import { afterAll } from 'vitest'
import { createServer, type ServerOptions } from './server.ts'

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

/**
 * Um projeto mínimo numa pasta temporária (o `package.json` e um `src`). Com `broken`, tem também
 * uma tela fora da estrutura (só o `index.tsx`, sem `model.ts` nem `view.tsx`), que o `check` acusa.
 * Com `inside`, a pasta do projeto é criada dentro dessa pasta (o `root` de uma chamada tem de ficar
 * dentro da pasta do servidor). Devolve a raiz.
 */
export function makeProject({
  broken = false,
  inside,
}: { broken?: boolean; inside?: string } = {}): string {
  const root = inside === undefined ? makeDir() : mkdtempSync(path.join(inside, 'app-'))
  mkdirSync(path.join(root, 'src'), { recursive: true })
  writeFileSync(path.join(root, 'package.json'), '{ "name": "app" }\n')
  writeFileSync(path.join(root, 'src/main.ts'), 'export {}\n')
  if (broken) {
    mkdirSync(path.join(root, 'src/pages/solta'), { recursive: true })
    writeFileSync(path.join(root, 'src/pages/solta/index.tsx'), 'export {}\n')
  }
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
