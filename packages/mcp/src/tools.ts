import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { runInProcess, toArgv, type CommandInfo } from '@matizze/prumo-cli/api'
import type { CallToolResult } from '@modelcontextprotocol/server'
import { inputSchemaOf } from './schema.ts'

/** Onde e com que ambiente as ferramentas rodam os comandos. */
export interface ToolsOptions {
  /** A pasta do servidor: o cwd dos comandos, e o limite do `root` e do `dir`. */
  cwd: string
  /** As variáveis de ambiente dos comandos (`PATH` para o `pnpm`, `HOME`). */
  env?: Readonly<Record<string, string | undefined>>
}

/** Uma ferramenta MCP, a projeção de um comando da CLI. */
export interface PrumoTool {
  /** O nome da ferramenta: o do comando com `:` trocado por `_` (`make_page`). */
  name: string
  /** A descrição inteira do comando, a mesma da ajuda. */
  description: string
  /** O comando que a ferramenta roda. */
  command: CommandInfo
  /** O esquema de entrada, derivado dos argumentos do comando. */
  inputSchema: ReturnType<typeof inputSchemaOf>
  /** Roda o comando com os campos dados e devolve o texto dele. */
  call: (input: Readonly<Record<string, unknown>>) => Promise<CallToolResult>
}

/**
 * Os campos que dizem uma pasta onde o comando escreve: ficam dentro da pasta do servidor. O `dir`
 * é o do `new`, que volta com os geradores: a regra vale para qualquer comando que o tenha.
 */
const FOLDER_FIELDS = ['root', 'dir']

/** Resolve os links simbólicos da parte do caminho que já existe, para o `..` e o link não escaparem. */
function realPathOf(target: string): string {
  let existing = target
  const missing: string[] = []
  while (!existsSync(existing)) {
    const parent = path.dirname(existing)
    if (parent === existing) break
    missing.unshift(path.basename(existing))
    existing = parent
  }
  return path.join(realpathSync(existing), ...missing)
}

function isInside(folder: string, target: string): boolean {
  const relative = path.relative(realPathOf(folder), realPathOf(target))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

/**
 * Confere que `root` e `dir` ficam dentro da pasta do servidor. Quem escolhe o valor é o agente, e
 * `--root /` ou `--dir ~` o levaria a escrever fora do projeto. É a única regra do servidor que não
 * vem da CLI: existe por segurança. Devolve a mensagem de erro, ou `undefined` se está tudo dentro.
 */
function outsideFolder(input: Readonly<Record<string, unknown>>, cwd: string): string | undefined {
  for (const field of FOLDER_FIELDS) {
    const value = input[field]
    if (typeof value !== 'string' || value === '') continue
    if (!isInside(cwd, path.resolve(cwd, value))) {
      return `o campo '${field}' ('${value}') fica fora da pasta do servidor (${cwd}): o servidor MCP só escreve dentro dela. Para outro lugar, rode o prumo no terminal.`
    }
  }
  return undefined
}

/**
 * O texto de uma ferramenta, sem moldura: o stdout e, depois, o stderr do comando, na ordem, e, se o
 * código de saída não é 0, uma última linha `[saída <código>]`.
 */
function textOf(exitCode: number, stdout: string, stderr: string): string {
  const parts = [stdout, stderr].filter((part) => part !== '')
  const text = parts.map((part) => (part.endsWith('\n') ? part : `${part}\n`)).join('')
  if (exitCode !== 0) return `${text}[saída ${exitCode}]`
  return text === '' ? '(sem saída)' : text
}

function resultOf(exitCode: number, stdout: string, stderr: string): CallToolResult {
  return {
    content: [{ type: 'text', text: textOf(exitCode, stdout, stderr) }],
    isError: exitCode !== 0,
  }
}

/**
 * Uma ferramenta por comando: o servidor não tem lógica de comando. O nome, a descrição e o esquema
 * saem do `CommandInfo`; a chamada vira a linha de comando (`toArgv`, a função da CLI) e roda em
 * processo (`runInProcess`), com o `cwd` e o ambiente do servidor. O código de saída que não é 0
 * (violação do `check`, uso errado) é `isError`, e o agente lê o motivo no texto.
 *
 * As chamadas rodam uma de cada vez: dois comandos que escrevem no mesmo projeto ao mesmo tempo
 * (duas telas no `App.tsx`, por exemplo) se atropelariam, e o cliente pode pedir várias juntas.
 */
export function toolsOf(commands: readonly CommandInfo[], options: ToolsOptions): PrumoTool[] {
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task)
    queue = next.catch(() => undefined)
    return next
  }

  return commands.map((command) => ({
    name: command.toolName,
    description: command.description,
    command,
    inputSchema: inputSchemaOf(command),
    call: (input) =>
      serial(async () => {
        const outside = outsideFolder(input, options.cwd)
        if (outside) return resultOf(2, '', `${outside}\n`)
        let argv: string[]
        try {
          argv = [...command.path, ...toArgv(command, input)]
        } catch (error) {
          return resultOf(2, '', `${error instanceof Error ? error.message : String(error)}\n`)
        }
        try {
          const { exitCode, stdout, stderr } = await runInProcess(argv, {
            cwd: options.cwd,
            ...(options.env === undefined ? {} : { env: options.env }),
          })
          return resultOf(exitCode, stdout, stderr)
        } catch (error) {
          // O runCli devolve o erro inesperado como código 1; isto cobre o que escapar dele
          return resultOf(1, '', `${error instanceof Error ? error.message : String(error)}\n`)
        }
      }),
  }))
}
