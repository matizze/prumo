#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { PACKAGE_NAME, PACKAGE_VERSION } from './package-info.ts'
import { createServer } from './server.ts'

const HELP = `Uso: prumo-mcp

O servidor MCP do Prumo (${PACKAGE_NAME} ${PACKAGE_VERSION}): uma ferramenta por comando do
prumo (check e doctor), por stdio. O servidor roda na pasta do projeto, e o stdout é o protocolo:
ligue-o ao agente pelo .mcp.json do projeto, não o rode à mão.

  { "mcpServers": { "prumo": { "command": "pnpm", "args": ["exec", "prumo-mcp"] } } }

Opções:
  -h, --help       Mostra esta ajuda.
  -v, --version    Mostra a versão.
`

const args = process.argv.slice(2)

if (args.includes('-h') || args.includes('--help')) {
  process.stdout.write(HELP)
} else if (args.includes('-v') || args.includes('--version')) {
  process.stdout.write(`${PACKAGE_VERSION}\n`)
} else if (args.length > 0) {
  process.stderr.write(`prumo-mcp: opção desconhecida: '${args[0]}'.\n\n${HELP}`)
  process.exitCode = 2
} else {
  // O stdout é do protocolo: o que mais escrevesse no console o corromperia, então vai para o stderr
  console.log = console.error
  console.info = console.error
  console.debug = console.error

  const fail = (error: unknown) => {
    process.stderr.write(
      `prumo-mcp: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    )
    process.exit(1)
  }
  try {
    // Uma instância por conexão (o SDK a pede da fábrica); o stdio fecha quando o cliente fecha o stdin
    serveStdio(async () => (await createServer()).server, {
      onerror: (error) => process.stderr.write(`prumo-mcp: ${error.message}\n`),
    })
  } catch (error) {
    fail(error)
  }
}
