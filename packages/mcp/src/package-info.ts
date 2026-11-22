import { readFileSync } from 'node:fs'

/**
 * O `package.json` do mcp, lido na hora: o caminho `../package.json` é o mesmo a partir de `src/` e
 * de `dist/`, então vale no workspace e no pacote publicado.
 */
const info = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  version: string
}

/** O nome do pacote, como está no `package.json`. */
export const PACKAGE_NAME: string = info.name

/** A versão do pacote, que o servidor informa ao cliente. */
export const PACKAGE_VERSION: string = info.version
