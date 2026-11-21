/**
 * Opções que o container repassa a toda fábrica de repositório. `S` é a união de fontes de dados
 * do produto (`'memory' | 'indexeddb'`); o core só exige que sejam textos. Domínios sem
 * implementação para a `dataSource` pedida caem no mock dentro da própria fábrica.
 */
export interface RepositoryOptions<S extends string = string> {
  dataSource: S
  /** Latência simulada dos mocks, em ms (padrão de cada mock: 300). Use 0 em testes. */
  latencyMs?: number
}
