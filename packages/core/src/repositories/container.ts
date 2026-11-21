import type { RepositoryOptions } from './options.ts'

/** Mapa de fábricas: o nome do domínio aponta para a função que cria o repositório dele. */
export type RepositoryFactories<S extends string = string> = Record<
  string,
  (options: RepositoryOptions<S>) => unknown
>

/** O container tipado que sai de um mapa de fábricas: cada chave guarda o que a fábrica devolve. */
export type RepositoryContainerOf<F extends Record<string, (...args: never[]) => unknown>> = {
  [K in keyof F]: ReturnType<F[K]>
}

/**
 * Cria o container chamando cada fábrica com as mesmas `options`. O tipo do container vem do mapa,
 * então acrescentar um domínio é acrescentar uma linha ao mapa do produto.
 */
export function createRepositoryContainer<S extends string, F extends RepositoryFactories<S>>(
  factories: F,
  options: RepositoryOptions<S>,
): RepositoryContainerOf<F> {
  const container: Record<string, unknown> = {}
  for (const [name, create] of Object.entries(factories)) container[name] = create(options)
  return container as RepositoryContainerOf<F>
}

/**
 * Resolve a fonte de dados a partir de um texto de configuração (por exemplo, uma variável de
 * ambiente). Valor vazio ou ausente usa o `fallback`. Valor fora de `sources` lança um erro, para
 * a inicialização falhar em vez de cair em silêncio em outra fonte de dados.
 *
 * @param name nome da configuração, só para a mensagem de erro (padrão: `dataSource`).
 */
export function resolveDataSource<S extends string>(
  value: string | undefined,
  sources: readonly S[],
  fallback: S,
  name = 'dataSource',
): S {
  const resolved = value || fallback
  if (!(sources as readonly string[]).includes(resolved)) {
    throw new Error(`Invalid ${name} "${resolved}". Expected one of: ${sources.join(', ')}.`)
  }
  return resolved as S
}
