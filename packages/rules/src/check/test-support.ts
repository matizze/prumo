import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'

const created: string[] = []
afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true })
})

/**
 * Cria um projeto temporário em disco a partir de um mapa de caminho para conteúdo e devolve a
 * raiz. A pasta some quando os testes do arquivo terminam.
 */
export function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'prumo-check-'))
  created.push(root)
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}
