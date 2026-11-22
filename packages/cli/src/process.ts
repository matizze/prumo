import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import type { Runtime } from './runtime.ts'

/** O limite da saída capturada de um subprocesso: 64 MB, o que sobra de um `pnpm install` longo. */
const MAX_BUFFER = 64 * 1024 * 1024

/** O ambiente dos subprocessos: o do processo, com o do runtime por cima. */
export function childEnv(runtime: Runtime): NodeJS.ProcessEnv {
  return { ...process.env, ...runtime.env }
}

/** Onde e com que ambiente o subprocesso roda. */
export interface ChildOptions {
  cwd: string
  /** O ambiente do filho. Padrão: o do processo, com o do runtime por cima (`childEnv`). */
  env?: NodeJS.ProcessEnv
}

/**
 * Roda um subprocesso que escreve para quem usa o comando (o `pnpm install` do `new`, o `shadcn`
 * do `add`): é o único lugar do cli que faz isso, e um teste proíbe `stdio: 'inherit'` e
 * `process.stdout` fora daqui e do `bin.ts`.
 *
 * No terminal (`runtime.inheritStdio`), o filho herda os três fluxos e a pessoa vê o progresso. Fora
 * dele, o stdin do filho é `ignore` (ele não lê o que o processo recebe, que num servidor MCP são os
 * bytes do protocolo) e o stdout e o stderr são capturados e repassados, ao fim, a `runtime.out` e
 * `runtime.err`. O resultado volta como o do `spawnSync`, com `stdout` e `stderr` em texto (vazios
 * no terminal, onde o filho escreveu direto).
 */
export function runChild(
  runtime: Runtime,
  command: string,
  args: string[],
  options: ChildOptions,
): SpawnSyncReturns<string> {
  const env = options.env ?? childEnv(runtime)
  if (runtime.inheritStdio) {
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      env,
      encoding: 'utf8',
      stdio: 'inherit',
    })
    return { ...result, stdout: '', stderr: '' }
  }
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: MAX_BUFFER,
  })
  // Mesmo com erro (estouro do buffer, filho morto por sinal), o que o filho já escreveu é repassado
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  if (stdout !== '') runtime.out(stdout)
  if (stderr !== '') runtime.err(stderr)
  return { ...result, stdout, stderr }
}
