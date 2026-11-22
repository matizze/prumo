/** As verificações do `prumo check`, pelo nome que aparece em cada violação. */
export type CheckRule =
  'components-folders' | 'shared-usage' | 'page-structure' | 'messages' | 'references'

/** Uma violação achada no projeto. */
export interface Violation {
  /** A verificação que acusou. */
  rule: CheckRule
  /** O arquivo (ou a pasta) em questão, relativo à raiz do projeto e com barras normais. */
  file: string
  /** O que está errado e, quando cabe, o que fazer, em português. */
  message: string
}

export interface CheckOptions {
  /** Pasta do projeto, a que tem o `src`. Caminho absoluto ou relativo ao diretório de trabalho. */
  root: string
  /** Alias de import que aponta para `aliasRoot`. Padrão: `'@/'`. */
  alias?: string
  /** Pasta para onde o alias aponta, relativa à raiz. Padrão: `'src'`. */
  aliasRoot?: string
  /** Pasta das telas, relativa à raiz. Cada subpasta é uma tela. Padrão: `'src/pages'`. */
  pagesDir?: string
  /** Arquivos que toda tela tem na própria pasta. Padrão: `['index.tsx', 'model.ts', 'view.tsx']`. */
  requiredPageFiles?: string[]
  /** Pasta dos componentes, relativa à raiz. Padrão: `'src/components'`. */
  componentsDir?: string
  /** As únicas subpastas permitidas na pasta dos componentes. Padrão: `['layout', 'shared', 'ui']`. */
  allowedComponentDirs?: string[]
  /** Pasta dos componentes compartilhados, relativa à raiz. Padrão: `'src/components/shared'`. */
  sharedDir?: string
  /** Pasta da casca do layout, relativa à raiz. Conta como duas telas. Padrão: `'src/components/layout'`. */
  layoutDir?: string
  /** Pasta das mensagens, com uma subpasta de JSONs por idioma, relativa à raiz. Padrão: `'src/messages'`. */
  messagesDir?: string
  /** Idiomas do produto, o primeiro é a referência das comparações. Padrão: `['pt-BR', 'en']`. */
  locales?: string[]
  /**
   * Os arquivos de texto cujas citações entre crases a análise `references` confere, relativos à
   * raiz. O que não existe é pulado. Padrão: `['AGENTS.md', 'docs/patterns.md']`.
   */
  referenceFiles?: string[]
}

/** As opções com todos os padrões aplicados e os caminhos de pasta sem barras nas pontas. */
export type ResolvedOptions = Required<CheckOptions>
