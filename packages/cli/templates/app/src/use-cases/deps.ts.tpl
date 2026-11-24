import type { Http } from '@matizze/prumo-core/http'

/** O que os use cases recebem para trabalhar: o transporte da API (mock ou real) e o armazenamento do navegador. */
export interface UseCaseDeps {
  http: Http
  storage: Storage
}
