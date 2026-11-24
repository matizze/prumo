import path from 'node:path'

/** O caminho de `file` relativo à `root`, sempre com `/`: o que as mensagens e as listas mostram. */
export function displayPath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}
