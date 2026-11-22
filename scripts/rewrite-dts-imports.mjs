#!/usr/bin/env node
// Troca a extensão .ts/.tsx dos imports relativos dos .d.ts de uma pasta por .js.
//
// O tsc, com `rewriteRelativeImportExtensions`, reescreve os imports dos .js emitidos, mas deixa
// intactos os dos .d.ts (`from './render.tsx'`). Um produto que consome o pacote não liga
// `allowImportingTsExtensions`, então o .d.ts precisa apontar para './render.js', que o TypeScript
// resolve para o render.d.ts ao lado. Uso: node scripts/rewrite-dts-imports.mjs <pasta>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// `from './x.ts'`, `import('./x.ts')` e `import './x.ts'`, só com caminho relativo
const RELATIVE_TS_IMPORT = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"]*)\.tsx?\2/g

/** Os .d.ts de uma pasta, em qualquer profundidade. */
function declarationFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return declarationFiles(file)
    return entry.name.endsWith('.d.ts') ? [file] : []
  })
}

const dir = process.argv[2]
if (!dir) {
  process.stderr.write('uso: node scripts/rewrite-dts-imports.mjs <pasta>\n')
  process.exit(2)
}

for (const file of declarationFiles(path.resolve(dir))) {
  const text = readFileSync(file, 'utf8')
  const rewritten = text.replace(RELATIVE_TS_IMPORT, '$1$2$3.js$2')
  if (rewritten !== text) writeFileSync(file, rewritten)
}
