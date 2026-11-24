import { readFileSync, statSync, type Stats } from 'node:fs'
import path from 'node:path'
import { UsageError } from '../errors.ts'

/** A descrição da opção `--root`, a mesma em todo comando que acha o projeto. */
export const ROOT_OPTION_DESCRIPTION =
  'A pasta do projeto, a que tem o src. Padrão: a pasta atual ou a primeira acima com package.json e src.'

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

  return projectAt(resolved)
}

/** O `package.json` da pasta depende de algum pacote `@matizze/prumo-*`: é um projeto do Prumo. */
function dependsOnPrumo(dir: string): boolean {
  try {
    const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return [manifest.dependencies, manifest.devDependencies].some((deps) =>
      Object.keys(deps ?? {}).some((name) => name.startsWith('@matizze/prumo-')),
    )
  } catch {
    return false
  }
}

/**
 * O projeto de um comando. Com `--root`, é aquela pasta exata (`findProject`, com os mesmos erros).
 * Sem `--root`, sobe da pasta atual até a primeira que tem `src` e um `package.json` com dependência
 * `@matizze/prumo-*`, como o git faz com o `.git`: assim os comandos rodam de dentro de `src/pages`,
 * e uma pasta com `package.json` e `src` que não é do Prumo (o `website`, por exemplo) não é
 * confundida com o projeto.
 */
export function locateProject(cwd: string, root: string | undefined): Project {
  if (root !== undefined) {
    if (root === '') throw new UsageError("a opção '--root' precisa de um valor.")
    return findProject(path.resolve(cwd, root))
  }
  const start = path.resolve(cwd)
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (statOf(path.join(dir, 'src'))?.isDirectory() && dependsOnPrumo(dir)) return projectAt(dir)
    if (path.dirname(dir) === dir) break
  }
  throw new UsageError(
    `nenhum projeto Prumo achado a partir de '${start}' (uma pasta com src e um package.json que depende de @matizze/prumo-*, nela ou acima): entre na pasta do projeto ou aponte --root.`,
  )
}

/**
 * Os caminhos de um projeto na raiz dada, sem olhar o disco: o `new` planeja o app antes de a
 * pasta existir.
 */
export function projectAt(root: string): Project {
  const src = path.join(root, 'src')
  return {
    root,
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
