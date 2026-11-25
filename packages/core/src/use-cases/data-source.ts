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
