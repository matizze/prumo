import path from 'node:path'
import type { Rule } from 'eslint'

/** Caminho com barras normais, para comparar igual em qualquer sistema operacional. */
export function toPosix(file: string): string {
  return file.split(path.sep).join('/')
}

/** Tira as barras das pontas de um caminho de pasta (`'/src/pages/'` vira `'src/pages'`). */
export function trimSlashes(dir: string): string {
  return dir.replace(/^\/+|\/+$/g, '')
}

/** Alias de import sempre terminado em barra (`'@'` vira `'@/'`). */
export function normalizeAlias(alias: string): string {
  return alias.endsWith('/') ? alias : `${alias}/`
}

export interface Placement {
  /** Pasta do projeto: tudo o que vem antes da pasta procurada. */
  root: string
  /** Caminho do arquivo dentro da pasta procurada, sem a barra do começo. */
  inner: string
}

/**
 * Diz onde o arquivo está em relação a uma pasta do projeto (como `src/pages`). Em vez de
 * depender do diretório de trabalho do ESLint, que muda entre terminal e editor, procura a
 * pasta no próprio caminho do arquivo. Devolve null se o arquivo não está dentro dela.
 */
export function locateInside(filename: string, dir: string): Placement | null {
  const marker = `/${trimSlashes(dir)}/`
  const file = toPosix(filename)
  const index = file.lastIndexOf(marker)
  if (index === -1) return null
  return { root: file.slice(0, index), inner: file.slice(index + marker.length) }
}

/** O caminho é a própria pasta ou está dentro dela (também casa `pasta.ts` e `pasta.tsx`). */
export function isInside(target: string, base: string, { extension = false } = {}): boolean {
  if (target === base || target.startsWith(`${base}/`)) return true
  return extension && target.startsWith(`${base}.`)
}

/**
 * Resolve o especificador de um import para um caminho no projeto: pelo alias (`@/x`) ou
 * relativo ao arquivo (`./x`, `../x`). Devolve null para pacote npm. `aliasRoot` é a pasta
 * para onde o alias aponta, relativa ao projeto (por exemplo `src`).
 */
export function resolveSpecifier(
  specifier: string,
  options: { filename: string; root: string; alias: string; aliasRoot: string },
): { target: string; relative: boolean } | null {
  const alias = normalizeAlias(options.alias)
  if (specifier.startsWith(alias)) {
    const target = path.posix.join(
      options.root,
      trimSlashes(options.aliasRoot),
      specifier.slice(alias.length),
    )
    return { target: target.replace(/\/+$/, ''), relative: false }
  }
  if (specifier === '.' || specifier === '..' || /^\.\.?\//.test(specifier)) {
    const target = path.posix.join(path.posix.dirname(toPosix(options.filename)), specifier)
    return { target: target.replace(/\/+$/, ''), relative: true }
  }
  return null
}

/** O especificador é o pacote (ou um subcaminho dele). */
export function matchesPackage(specifier: string, name: string): boolean {
  return specifier === name || specifier.startsWith(`${name}/`)
}

/**
 * Listener que chama `check` a cada especificador de import ou export com origem: `import`,
 * `import type`, `export ... from`, `export *` e `import()` com texto fixo. Lê os mesmos
 * casos que o teste de arquitetura lia por expressão regular.
 */
export function importListener(
  check: (node: Rule.Node, specifier: string) => void,
): Rule.RuleListener {
  const visit = (node: Rule.Node, source: { type: string; value?: unknown } | null | undefined) => {
    if (source?.type === 'Literal' && typeof source.value === 'string') check(node, source.value)
  }
  return {
    ImportDeclaration: (node) => visit(node, node.source),
    ExportAllDeclaration: (node) => visit(node, node.source),
    ExportNamedDeclaration: (node) => visit(node, node.source),
    ImportExpression: (node) => visit(node, node.source),
  }
}
