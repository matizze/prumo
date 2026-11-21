/** Árvore de mensagens: objetos aninhados cujas folhas são textos (o formato dos JSON de mensagens). */
export interface MessageTree {
  [key: string]: string | MessageTree
}

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]

/** Todo caminho de M que aponta para um objeto: um namespace válido ("auth", "layout.nav"). */
type NamespacePaths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? never
    : `${P}${K}` | NamespacePaths<T[K], `${P}${K}.`>
}[keyof T & string]

type Get<T, P extends string> = P extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? Get<T[H], R>
    : never
  : P extends keyof T
    ? T[P]
    : never

/** Namespaces válidos de um conjunto de mensagens M ("auth", "auth.signIn"...). */
export type NamespaceOf<M> = NamespacePaths<M>

/** Chaves válidas dentro de um namespace; sem namespace, o caminho completo ("auth.signIn.title"). */
export type MessageKeyOf<M, N extends NamespaceOf<M> | undefined = undefined> =
  N extends NamespaceOf<M> ? Leaves<Get<M, N>> : Leaves<M>

/** Valores das variáveis ICU ({name}, {count, plural, ...}). */
export type TranslationValues = Record<string, string | number | Date>

/** Função `t` de um namespace de M, com as chaves tipadas pelas mensagens. */
export type TranslatorOf<M, N extends NamespaceOf<M> | undefined = undefined> = (
  key: MessageKeyOf<M, N>,
  values?: TranslationValues,
) => string

/** Metadados de um idioma para o seletor de idioma. */
export interface LanguageOf<L extends string> {
  id: L
  /** Nome no próprio idioma (o que aparece no seletor). */
  name: string
  /** Código curto para espaços apertados (ex.: gatilho do seletor no header). */
  shortName: string
  /** Direção do texto, aplicada ao `<html dir>`. */
  dir: 'ltr' | 'rtl'
}
