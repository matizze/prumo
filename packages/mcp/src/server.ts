import { createRoot, describeCommands, type CommandInfo } from '@matizze/prumo-cli/api'
import { McpServer } from '@modelcontextprotocol/server'
import { PACKAGE_VERSION } from './package-info.ts'
import { toolsOf, type PrumoTool } from './tools.ts'

/** Como o servidor é montado: tudo opcional, e os padrões são os do bin. */
export interface ServerOptions {
  /** A pasta do projeto: o cwd dos comandos e o limite do `root` e do `dir`. Padrão: `process.cwd()`. */
  cwd?: string
  /** O ambiente dos comandos. Padrão: `process.env`. */
  env?: Readonly<Record<string, string | undefined>>
  /** Os comandos a expor. Padrão: a árvore do `prumo` (`describeCommands(createRoot(...))`). */
  commands?: readonly CommandInfo[]
}

/** A árvore do `prumo` como dado. O Runtime é de mentira: descrever não roda comando. */
async function prumoCommands(): Promise<CommandInfo[]> {
  const unused = () => {
    throw new Error('descrever os comandos não os roda')
  }
  return describeCommands(
    createRoot({ out: unused, err: unused, cwd: '/', env: {}, interactive: false, choose: unused }),
  )
}

/** O servidor e as ferramentas que ele registrou. */
export interface PrumoServer {
  server: McpServer
  tools: PrumoTool[]
}

/**
 * Monta o servidor MCP do Prumo (nome `prumo`, versão do pacote): uma ferramenta por comando da CLI,
 * e nada além disso (sem resources nem prompts). Não liga a transporte nenhum; o `bin.ts` liga o
 * stdio e os testes ligam o que quiserem.
 */
export async function createServer(options: ServerOptions = {}): Promise<PrumoServer> {
  const commands = options.commands ?? (await prumoCommands())
  const tools = toolsOf(commands, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
  })
  const server = new McpServer({ name: 'prumo', version: PACKAGE_VERSION })
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      (input) => tool.call(input),
    )
  }
  return { server, tools }
}
