import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import type { Io } from '../io.ts'

/** O limite da saída capturada de um subprocesso: 64 MB, o que sobra de um `pnpm install` longo. */
const MAX_BUFFER = 64 * 1024 * 1024

/**
 * Roda um subprocesso que escreve para quem usa o comando (o `pnpm install` do `new`). No terminal
 * (`io.inheritStdio`), o filho herda os três fluxos e a pessoa vê o progresso. Fora dele, o stdin do
 * filho é ignorado e o stdout e o stderr são capturados e repassados, ao fim, a `io.out` e `io.err`.
 * O resultado volta como o do `spawnSync`, com `stdout` e `stderr` em texto (vazios no terminal,
 * onde o filho escreveu direto).
 */
export function runChild(
  io: Io,
  command: string,
  args: string[],
  options: { cwd: string },
): SpawnSyncReturns<string> {
  if (io.inheritStdio) {
    const result = spawnSync(command, args, { cwd: options.cwd, encoding: 'utf8', stdio: 'inherit' })
    return { ...result, stdout: '', stderr: '' }
  }
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: MAX_BUFFER,
  })
  // Mesmo com erro (estouro do buffer, filho morto por sinal), o que o filho já escreveu é repassado
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  if (stdout !== '') io.out(stdout)
  if (stderr !== '') io.err(stderr)
  return { ...result, stdout, stderr }
}
