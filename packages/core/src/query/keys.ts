/** Partes de uma chave, depois do domínio. */
type KeyParts = readonly unknown[]

/** Uma chave é uma tupla fixa ou uma função que recebe os parâmetros e devolve a tupla. */
type KeyDefinition = KeyParts | ((...args: never[]) => KeyParts)

/**
 * O objeto devolvido por {@link createQueryKeys}: `all` mais uma entrada por definição, com o
 * domínio já na frente de cada tupla.
 */
export type QueryKeys<D extends string, Defs extends Record<string, KeyDefinition>> = {
  /** Prefixo de tudo do domínio: use para invalidar depois de criar, editar ou excluir. */
  readonly all: readonly [D]
} & {
  readonly [K in keyof Defs]: Defs[K] extends (...args: infer A) => infer R
    ? R extends KeyParts
      ? (...args: A) => readonly [D, ...R]
      : never
    : Defs[K] extends KeyParts
      ? readonly [D, ...Defs[K]]
      : never
}

/**
 * Cria as query keys de um domínio. Toda chave começa pelo nome do domínio, então invalidar
 * `keys.all` atinge o domínio inteiro e invalidar uma chave mais curta (uma lista, por exemplo)
 * atinge as chaves que começam por ela.
 *
 * Cada definição é uma tupla fixa ou uma função que recebe os parâmetros e devolve as partes
 * da chave que vêm depois do domínio. A tupla de uma função precisa de `as const`, para a chave
 * manter os tipos literais; a tupla fixa não precisa, porque o parâmetro já é `const`.
 *
 * A chave `all` é reservada: ela já existe em todo domínio, e o TypeScript recusa uma definição
 * com esse nome.
 *
 * @example
 * const catalogKeys = createQueryKeys('catalog', {
 *   lists: ['list'],
 *   list: (query: ProductListQuery = {}) => ['list', query] as const,
 *   detail: (id: string) => ['detail', id] as const,
 * })
 *
 * catalogKeys.all // ['catalog']
 * catalogKeys.lists // ['catalog', 'list']
 * catalogKeys.detail('42') // ['catalog', 'detail', '42']
 */
export function createQueryKeys<
  const D extends string,
  const Defs extends Record<string, KeyDefinition> & { readonly all?: never } = Record<
    never,
    never
  >,
>(domain: D, definitions: Defs = {} as Defs): QueryKeys<D, Defs> {
  const keys: Record<string, unknown> = { all: [domain] }
  for (const [name, definition] of Object.entries(definitions)) {
    keys[name] =
      typeof definition === 'function'
        ? (...args: never[]) => [domain, ...definition(...args)]
        : [domain, ...definition]
  }
  return keys as QueryKeys<D, Defs>
}
