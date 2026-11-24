import type { RegisterCommand } from '../commands/index.ts'
import type { Io } from '../io.ts'
import { run } from '../program.ts'

/** Um `Io` que captura o que sai em cada fluxo, para os testes rodarem o comando sem terminal. */
export function captureIo(
  cwd: string,
  extra: Partial<Io> = {},
): { io: Io; stdout: () => string; stderr: () => string } {
  let stdout = ''
  let stderr = ''
  const io: Io = {
    cwd,
    out: (text) => void (stdout += text),
    err: (text) => void (stderr += text),
    ...extra,
  }
  return { io, stdout: () => stdout, stderr: () => stderr }
}

/** Roda o prumo em processo, na pasta `cwd`, e devolve o código de saída e o que saiu em cada fluxo. */
export async function exec(
  argv: string[],
  cwd: string,
  commands?: readonly RegisterCommand[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const { io, stdout, stderr } = captureIo(cwd)
  const code = await (commands ? run(argv, io, commands) : run(argv, io))
  return { code, stdout: stdout(), stderr: stderr() }
}
