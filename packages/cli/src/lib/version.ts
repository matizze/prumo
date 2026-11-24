import { readFileSync } from 'node:fs'

/** A versão do pacote: o package.json fica dois níveis acima de `src/` e de `dist/`. */
export function readVersion(): string {
  const manifest = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version: string }
  return manifest.version
}
