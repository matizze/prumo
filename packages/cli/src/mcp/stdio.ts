import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createMcpServer, type ServerOptions } from './server.ts'

/** Abre o servidor por stdio e só devolve quando o cliente fecha (o stdin chega ao fim). */
export async function serve(options: ServerOptions): Promise<void> {
  const handle = serveStdio(() => createMcpServer(options), {
    onerror: (error) => process.stderr.write(`prumo mcp: ${error.message}\n`),
  })
  await new Promise<void>((resolve) => {
    process.stdin.once('end', resolve)
    process.stdin.once('close', resolve)
  })
  await handle.close()
}
