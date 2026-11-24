/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** De onde os dados vêm: mock (padrão) ou http; outro valor dá erro. As fontes estão em src/use-cases/options.ts. */
  readonly VITE_DATA_SOURCE?: string
  /** O endereço da API, para a fonte http (padrão: /api). */
  readonly VITE_API_URL?: string
}
