import { defineConfig } from 'vitest/config'

// Roda só pelo `contract.test.ts`, num Vitest filho: o `vitest run` do pacote não pega `*.fixture.ts`
export default defineConfig({
  test: { include: ['*.fixture.ts'] },
})
