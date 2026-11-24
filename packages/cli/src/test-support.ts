import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import type { RegisterCommand } from './commands/index.ts'
import type { Io } from './io.ts'
import { run } from './program.ts'

/** O `package.json` de um projeto do Prumo: depende de um pacote `@matizze/prumo-*`. */
export const PROJECT_MANIFEST = '{ "name": "app", "devDependencies": { "@matizze/prumo-cli": "^0.8.0" } }\n'

const created: string[] = []
afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true })
})

/**
 * Cria um projeto temporário em disco a partir de um mapa de caminho para conteúdo e devolve a
 * raiz. A pasta some quando os testes do arquivo terminam. Sem `package.json` no mapa, o projeto
 * ganha um, e `src` existe porque algum arquivo mora nele (ou por `emptyDirs`).
 */
export function makeProject(files: Record<string, string>, emptyDirs: string[] = []): string {
  const root = mkdtempSync(path.join(tmpdir(), 'prumo-cli-'))
  created.push(root)
  const all = { 'package.json': PROJECT_MANIFEST, ...files }
  for (const [file, content] of Object.entries(all)) {
    const full = path.join(root, file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  for (const dir of emptyDirs) mkdirSync(path.join(root, dir), { recursive: true })
  return root
}

/** Pasta temporária vazia, para o que não é projeto. */
export function makeDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'prumo-cli-'))
  created.push(dir)
  return dir
}

/** Roda o prumo em processo, na pasta `cwd`, e devolve o código de saída e o que saiu em cada fluxo. */
export async function exec(
  argv: string[],
  cwd: string,
  commands?: readonly RegisterCommand[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = ''
  let stderr = ''
  const io: Io = {
    cwd,
    out: (text) => void (stdout += text),
    err: (text) => void (stderr += text),
  }
  const code = await (commands ? run(argv, io, commands) : run(argv, io))
  return { code, stdout, stderr }
}
