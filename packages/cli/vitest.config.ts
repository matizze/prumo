import { defineConfig } from 'vitest/config'

// Alguns testes compilam projetos e sobem subprocesso (o app gerado, o MCP por stdio): com a máquina
// carregada, passam dos 5 s padrão do Vitest. O tempo maior vale só para esses, e não esconde travas.
export default defineConfig({
  test: { testTimeout: 20_000 },
})
