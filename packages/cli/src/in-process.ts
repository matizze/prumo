import { createRoot } from './root.ts'
import { runCli } from './run.ts'
import type { Runtime } from './runtime.ts'

/** Onde e com que ambiente o comando roda em processo. */
export interface InProcessOptions {
  /** A pasta de trabalho do comando: quem chama passa, o `process.cwd()` não é lido. */
  cwd: string
  /** As variáveis de ambiente do comando. Padrão: nenhuma. */
  env?: Readonly<Record<string, string | undefined>>
}

/** O resultado de um comando rodado em processo. */
export interface InProcessResult {
  /** O código de saída: 0 sem erro, 1 para falha ou violação, 2 para uso errado. */
  exitCode: number
  /** O que o comando escreveu no stdout, inclusive a saída capturada dos subprocessos dele. */
  stdout: string
  /** O que o comando escreveu no stderr. */
  stderr: string
}

/**
 * Roda um comando do `prumo` neste processo e devolve o código de saída e a saída, sem escrever no
 * stdout nem no stderr do processo (num servidor MCP o stdout é o protocolo) e sem encerrar nada.
 * `argv` é a linha de comando sem o `prumo` (`['check', '--root=app']`); a de
 * um comando descrito é `[...command.path, ...toArgv(command, input)]`.
 *
 * O Runtime é de captura: nada é lido do processo (`cwd`, `env`), e duas chamadas não compartilham
 * estado.
 */
export async function runInProcess(
  argv: string[],
  options: InProcessOptions,
): Promise<InProcessResult> {
  let stdout = ''
  let stderr = ''
  const runtime: Runtime = {
    out: (text) => void (stdout += text),
    err: (text) => void (stderr += text),
    cwd: options.cwd,
    env: options.env ?? {},
  }
  const exitCode = await runCli(createRoot(runtime), argv, runtime)
  return { exitCode, stdout, stderr }
}
