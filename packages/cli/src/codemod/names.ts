import { UsageError } from '../errors.ts'

/** Os nomes derivados de um nome em kebab-case. */
export interface Names {
  /** `pedidos-recentes`: a pasta, o arquivo de mensagens e a rota. */
  kebab: string
  /** `PedidosRecentes`: componentes, hooks e tipos. */
  pascal: string
  /** `pedidosRecentes`: o namespace do i18n e as chaves. */
  camel: string
}

/** Os nomes de um domínio: o plural (`suppliers`) e o singular da entidade (`supplier`). */
export interface DomainNames {
  plural: Names
  singular: Names
}

const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** Nome válido: kebab-case com letras minúsculas, números e hífen, começando por letra. */
export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name)
}

/** Lança um `UsageError` (saída 2) se o nome não for kebab-case. `what` entra na mensagem. */
export function assertValidName(name: string, what = 'nome'): void {
  if (isValidName(name)) return
  throw new UsageError(
    `${what} '${name}' é inválido: use kebab-case, com letras minúsculas, números e hífen, começando por letra (ex.: pedidos-recentes).`,
  )
}

/** Deriva Pascal e camel de um nome kebab-case, já validado: `error-404` vira `Error404`. */
export function deriveNames(name: string): Names {
  assertValidName(name)
  const pascal = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
  return { kebab: name, pascal, camel: pascal.charAt(0).toLowerCase() + pascal.slice(1) }
}

/**
 * O singular de um plural, pela regra simples que serve ao inglês e ao português: tira o `s`
 * final (`suppliers` vira `supplier`, `pedidos` vira `pedido`). Os casos que a regra erra
 * (`status`, `categories`) pedem o singular explícito em `domainNames`.
 */
export function singularOf(plural: string): string {
  const singular = plural.slice(0, -1)
  if (!plural.endsWith('s') || singular.length < 2 || singular.endsWith('-')) {
    throw new UsageError(
      `não consegui derivar o singular de '${plural}': o nome do domínio é o plural e termina em 's'. Informe o singular com --entity.`,
    )
  }
  return singular
}

/**
 * Deriva os nomes de um domínio. `plural` é o nome do domínio (`suppliers`); `singular` é a
 * entidade (`supplier`) e, quando falta, sai da regra de `singularOf`. O singular não pode ser
 * igual ao plural, senão o tipo da entidade e o da lista teriam o mesmo nome.
 */
export function domainNames(plural: string, singular?: string): DomainNames {
  assertValidName(plural, 'o nome do domínio')
  if (singular !== undefined) assertValidName(singular, 'a entidade')
  const entity = singular ?? singularOf(plural)
  if (entity === plural) {
    throw new UsageError(
      `a entidade '${entity}' é igual ao nome do domínio: o singular tem que diferir do plural.`,
    )
  }
  return { plural: deriveNames(plural), singular: deriveNames(entity) }
}
