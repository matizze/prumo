import path from 'node:path'

/** Um nó da árvore do Markdown (mdast): só o que o plugin lê. */
interface Node {
  type: string
  url?: string
  children?: Node[]
}

export interface LinkOutsideDocsOptions {
  /** A pasta publicada como site (a `docs/` do repositório), caminho absoluto. */
  docsDir: string
  /** O endereço do repositório no GitHub. */
  repository: string
}

/**
 * Plugin de remark que leva para o GitHub os links que saem do site. A documentação é escrita para
 * ser lida no GitHub, com links relativos para o CONTRIBUTING.md e o SECURITY.md; o site só
 * publica a pasta `docs/`, e esses links quebrariam. O link para um arquivo fora de `docs/` vira o
 * endereço do arquivo na `main`, com a âncora.
 */
export function linkOutsideDocs({ docsDir, repository }: LinkOutsideDocsOptions) {
  const root = path.dirname(docsDir)

  function rewrite(node: Node, from: string): void {
    const url = node.url ?? ''
    // Endereço absoluto, âncora na própria página ou caminho do site: o Docusaurus resolve
    if (url === '' || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#') || url.startsWith('/')) {
      return
    }
    const [target = '', hash] = url.split('#')
    const absolute = path.resolve(path.dirname(from), target)
    const inDocs = absolute.startsWith(`${docsDir}${path.sep}`)
    if (inDocs) return
    const file = path.relative(root, absolute).split(path.sep).join('/')
    node.url = `${repository}/blob/main/${file}${hash ? `#${hash}` : ''}`
  }

  return () => (tree: Node, file: { path?: string }) => {
    const from = file.path
    if (!from) return
    const visit = (node: Node): void => {
      if (node.type === 'link') rewrite(node, from)
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}
