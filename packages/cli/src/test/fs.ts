import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'

/** O `package.json` de um projeto do Prumo: depende de um pacote `@matizze/prumo-*`. */
export const PROJECT_MANIFEST = '{ "name": "app", "devDependencies": { "@matizze/prumo-cli": "^0.8.0" } }\n'

const created: string[] = []
afterAll(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/**
 * Uma pasta temporária vazia, que some quando os testes do arquivo terminam. Todo teste que
 * precisa de pasta passa por aqui (ou por `makeProject`), para nada ficar no `tmpdir()`.
 */
export function makeDir(prefix = 'prumo-test-'): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix))
  created.push(dir)
  return dir
}

/** Escreve os arquivos de um mapa de caminho para conteúdo sob `root`, criando as pastas. */
export function writeFiles(root: string, files: Readonly<Record<string, string>>): void {
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
}

/**
 * Cria um projeto temporário em disco a partir de um mapa de caminho para conteúdo e devolve a
 * raiz. Sem `package.json` no mapa, o projeto ganha um, e `src` existe porque algum arquivo mora
 * nele (ou por `emptyDirs`).
 */
export function makeProject(files: Record<string, string>, emptyDirs: string[] = []): string {
  const root = makeDir()
  writeFiles(root, { 'package.json': PROJECT_MANIFEST, ...files })
  for (const dir of emptyDirs) mkdirSync(path.join(root, dir), { recursive: true })
  return root
}
