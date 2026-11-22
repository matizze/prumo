import { statSync, type Stats } from 'node:fs'
import path from 'node:path'
import { UsageError } from './errors.ts'

/** Os caminhos de um projeto Prumo que os comandos usam, todos absolutos. */
export interface Project {
  /** A raiz: a pasta com `package.json` e `src`. */
  root: string
  src: string
  /** `src/pages`: uma pasta por tela. */
  pages: string
  /** `src/messages`: uma pasta por idioma, com um JSON por namespace e um `index.ts`. */
  messages: string
  /** `src/App.tsx`: as rotas. */
  app: string
}

/**
 * Acha o projeto em `root` e devolve os caminhos que os comandos usam. A raiz precisa existir, ser
 * uma pasta e ter `package.json` e `src`: sem essa conferência, um comando apontado para a pasta
 * errada não acharia nada e sairia como se estivesse tudo certo. Se a raiz não serve, lança um
 * `UsageError` (saída 2) que explica o motivo.
 *
 * Só confere a raiz. Cada comando confere as pastas e os arquivos de que precisa, porque um
 * projeto novo ainda não tem `src/pages` nem `App.tsx`.
 */
export function findProject(root: string): Project {
  const resolved = path.resolve(root)
  const stat = statOf(resolved)
  if (!stat) throw new UsageError(`a pasta '${resolved}' não existe.`)
  if (!stat.isDirectory()) throw new UsageError(`'${resolved}' não é uma pasta.`)
  if (!statOf(path.join(resolved, 'package.json'))?.isFile()) {
    throw new UsageError(
      `a pasta '${resolved}' não tem package.json: aponte --root para a raiz do projeto.`,
    )
  }
  if (!statOf(path.join(resolved, 'src'))?.isDirectory()) {
    throw new UsageError(`a pasta '${resolved}' não tem src: aponte --root para a raiz do projeto.`)
  }

  const src = path.join(resolved, 'src')
  return {
    root: resolved,
    src,
    pages: path.join(src, 'pages'),
    messages: path.join(src, 'messages'),
    app: path.join(src, 'App.tsx'),
  }
}

function statOf(file: string): Stats | null {
  try {
    return statSync(file)
  } catch {
    return null
  }
}
