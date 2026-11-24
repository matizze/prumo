import { fromJsonSchema, McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import type { Io } from '../io.ts'
import { createProgram, execute, type Outcome } from '../program.ts'
import { describeTools, toArgv, type ToolSpec } from './tools.ts'

/** Como o servidor é montado. */
export type ServerOptions = {
  /** A raiz do projeto: o `cwd` de todo comando que as ferramentas rodam. */
  root: string
  /** A versão que o servidor informa ao cliente (a da cli). */
  version: string
}

/** O resultado de uma ferramenta: o stdout e, se houver, o stderr; `isError` quando a saída não é 0 (menos o `check` com violação). */
export function resultOf(tool: ToolSpec, outcome: Outcome, stdout: string, stderr: string): CallToolResult {
  const parts = [stdout, stderr].filter((part) => part !== '')
  const text = parts.map((part) => (part.endsWith('\n') ? part : `${part}\n`)).join('')
  // O código 1 do check é violação (`exit`); o do erro inesperado é falha
  const violation = tool.command === 'check' && outcome.kind === 'exit' && outcome.code === 1
  return {
    content: [{ type: 'text', text: text === '' ? '(sem saída)' : text }],
    isError: outcome.code !== 0 && !violation,
  }
}

/** Roda o comando da ferramenta em processo, na raiz do projeto, com a saída capturada. */
async function callTool(
  tool: ToolSpec,
  input: Readonly<Record<string, unknown>>,
  root: string,
): Promise<CallToolResult> {
  let argv: string[]
  try {
    argv = toArgv(tool, input)
  } catch (error) {
    return resultOf(tool, { code: 2, kind: 'usage' }, '', `prumo: ${error instanceof Error ? error.message : String(error)}\n`)
  }
  let stdout = ''
  let stderr = ''
  // Sem `inheritStdio`: nenhum subprocesso escreve no terminal, que aqui é o protocolo
  const io: Io = {
    cwd: root,
    out: (text) => void (stdout += text),
    err: (text) => void (stderr += text),
  }
  const outcome = await execute(argv, io)
  return resultOf(tool, outcome, stdout, stderr)
}

/**
 * Monta o servidor MCP do Prumo (nome `prumo`, a versão da cli): uma ferramenta por comando, descrita a
 * partir da árvore do commander. As chamadas rodam uma de cada vez (fila): duas escritas no mesmo
 * projeto ao mesmo tempo (duas telas no `App.tsx`) se atropelariam. Não liga a transporte nenhum.
 */
export function createMcpServer({ root, version }: ServerOptions): McpServer {
  const noop = (): void => undefined
  const tools = describeTools(createProgram({ cwd: root, out: noop, err: noop }))
  const server = new McpServer({ name: 'prumo', version })

  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task)
    queue = next.catch(() => undefined)
    return next
  }

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: fromJsonSchema<Record<string, unknown>>(tool.inputSchema),
      },
      (input) => serial(() => callTool(tool, input, root)),
    )
  }
  return server
}
