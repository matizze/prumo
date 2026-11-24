/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** De onde os repositórios leem: mock (padrão), http ou storage. As fontes do app estão em src/repositories/options.ts. */
  readonly VITE_DATA_SOURCE?: string
  /** O endereço da API, para a fonte http (padrão: /api). */
  readonly VITE_API_URL?: string
}
