import type { RepositoryOptions } from '../options'
import type { I{{plural.pascal}}Repository } from './repository.contract'
import { Mock{{plural.pascal}}Repository } from './repository.mock'

export type { I{{plural.pascal}}Repository } from './repository.contract'
export { Mock{{plural.pascal}}Repository, type Mock{{plural.pascal}}RepositoryOptions } from './repository.mock'
export { MOCK_{{plural.constant}} } from './fixtures'

export function create{{plural.pascal}}Repository({ latencyMs }: RepositoryOptions): I{{plural.pascal}}Repository {
  // Só mock por enquanto; a implementação real (API) entra aqui
  return new Mock{{plural.pascal}}Repository({ latencyMs })
}
