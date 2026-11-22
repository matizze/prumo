import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import type { Runtime } from './runtime.ts'

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
  const all = { 'package.json': '{ "name": "app" }\n', ...files }
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

/** Um `Runtime` que guarda o que o comando escreve, para os testes lerem. */
export function captureRuntime(
  cwd = process.cwd(),
  env: Record<string, string | undefined> = {},
): Runtime & { stdout: string; stderr: string } {
  const runtime = {
    cwd,
    env,
    stdout: '',
    stderr: '',
    out: (text: string) => void (runtime.stdout += text),
    err: (text: string) => void (runtime.stderr += text),
  }
  return runtime
}
