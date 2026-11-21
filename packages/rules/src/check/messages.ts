import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { icuPlaceholders } from './icu.ts'
import type { ResolvedOptions, Violation } from './types.ts'

/** Mensagens de um idioma: chave completa (`namespace.caminho.da.chave`) e texto. */
type Messages = Map<string, { text: string; file: string }>

type Tree = { [key: string]: unknown }

const isTree = (value: unknown): value is Tree =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Textos completos: os idiomas têm as mesmas chaves, cada chave usa os mesmos argumentos ICU
 * em todos eles e nenhuma mensagem fica vazia. As mensagens são um JSON por namespace em
 * `<pasta de mensagens>/<idioma>/<namespace>.json`, e o primeiro idioma é a referência: o que
 * falta ou diverge nos outros acusa no arquivo do outro idioma. Sem a pasta de mensagens, o
 * projeto não tem i18n e a verificação não acusa nada.
 *
 * Quando a pasta do idioma tem um `index.ts`, é ele que registra os namespaces para o `t()`
 * (`import addProduct from './add-product.json'` e a chave no `export default`). Então todo
 * JSON da pasta precisa estar importado e exportado nele, o `index.ts` não pode importar JSON
 * que não existe, os idiomas registram o mesmo conjunto de namespaces e as chaves citadas nas
 * violações usam o nome registrado (`addProduct.title`), como o app as usa no `t()`. Sem
 * `index.ts`, o namespace é o nome do arquivo.
 */
export function checkMessages(options: ResolvedOptions): Violation[] {
  const { messagesDir, locales } = options
  if (!existsSync(path.join(options.root, messagesDir))) return []

  const violations: Violation[] = []
  const report = (file: string, message: string) =>
    violations.push({ rule: 'messages', file, message })

  const byLocale = new Map<string, Messages>()
  const indexes = new Map<string, LocaleIndex>()
  for (const locale of locales) {
    const dir = `${messagesDir}/${locale}`
    if (!existsSync(path.join(options.root, dir))) {
      report(dir, `A pasta do idioma '${locale}' não existe.`)
      continue
    }
    const index = readIndex(options.root, dir)
    byLocale.set(locale, readLocale(options.root, dir, index, report))
    if (index) indexes.set(locale, index)
  }

  checkIndexes(indexes, byLocale, options, report)

  // Mensagem vazia, em qualquer idioma
  for (const messages of byLocale.values()) {
    for (const [key, { text, file }] of messages) {
      if (text.trim() === '') report(file, `A mensagem '${key}' está vazia.`)
    }
  }

  // Chaves e argumentos de cada idioma contra os da referência
  const [reference, ...others] = locales.filter((locale) => byLocale.has(locale))
  const base = reference ? byLocale.get(reference)! : undefined
  if (!reference || !base) return violations

  for (const locale of others) {
    const messages = byLocale.get(locale)!
    for (const [key, { file }] of base) {
      if (!messages.has(key)) {
        report(
          `${messagesDir}/${locale}/${path.posix.basename(file)}`,
          `A chave '${key}' existe em '${reference}' e falta em '${locale}'.`,
        )
      }
    }
    for (const [key, { file }] of messages) {
      if (!base.has(key)) {
        report(file, `A chave '${key}' existe em '${locale}' e falta em '${reference}'.`)
      }
    }
    for (const [key, { text, file }] of messages) {
      const baseText = base.get(key)?.text
      if (baseText === undefined) continue
      const expected = placeholdersOf(baseText, key, file, report)
      const found = placeholdersOf(text, key, file, report)
      if (expected && found && JSON.stringify(expected) !== JSON.stringify(found)) {
        report(
          file,
          `A chave '${key}' usa argumentos diferentes: '${reference}' tem [${expected.join(', ')}] e '${locale}' tem [${found.join(', ')}].`,
        )
      }
    }
  }

  return dedupe(violations)
}

/** O que o `index.ts` de um idioma registra: o arquivo, os imports de JSON e as chaves exportadas. */
interface LocaleIndex {
  /** Caminho do `index.ts`, relativo à raiz do projeto. */
  file: string
  /** Identificador importado e o arquivo JSON de onde vem (sem a extensão). */
  imports: Map<string, string>
  /** Nome registrado no `export default` (o namespace do `t()`) e o identificador dele. */
  exports: Map<string, string>
}

const IMPORT_JSON = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]\.\/([^/'"]+)\.json['"]/g
const EXPORT_DEFAULT = /export\s+default\s*\{([\s\S]*?)\}/
const EXPORT_ENTRY = /^(?:([A-Za-z_$][\w$]*)|'([^']+)'|"([^"]+)")(?:\s*:\s*([A-Za-z_$][\w$]*))?$/

/**
 * Lê o `index.ts` do idioma por expressão regular: os imports de `./x.json` e as chaves do
 * `export default`, na forma abreviada (`addProduct`) e na forma `chave: identificador`.
 * Devolve null se a pasta não tem `index.ts`.
 */
function readIndex(root: string, dir: string): LocaleIndex | null {
  const file = `${dir}/index.ts`
  if (!existsSync(path.join(root, file))) return null
  const source = readFileSync(path.join(root, file), 'utf8').replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    '',
  )

  const imports = new Map<string, string>()
  for (const [, ident, stem] of source.matchAll(IMPORT_JSON)) imports.set(ident!, stem!)

  const exports = new Map<string, string>()
  const body = EXPORT_DEFAULT.exec(source)?.[1] ?? ''
  for (const entry of body.split(',')) {
    const match = EXPORT_ENTRY.exec(entry.trim())
    if (!match) continue
    const name = match[1] ?? match[2] ?? match[3]!
    const ident = match[4] ?? match[1]
    if (ident) exports.set(name, ident)
  }
  return { file, imports, exports }
}

/** Confere os `index.ts` dos idiomas: o que registram contra os JSONs da pasta e entre si. */
function checkIndexes(
  indexes: Map<string, LocaleIndex>,
  byLocale: Map<string, Messages>,
  options: ResolvedOptions,
  report: (file: string, message: string) => void,
): void {
  const { root, messagesDir, locales } = options

  for (const [locale, index] of indexes) {
    const dir = `${messagesDir}/${locale}`
    const exported = new Set(index.exports.values())
    const importedStems = new Set(index.imports.values())

    // (b) JSON importado que não existe
    for (const [ident, stem] of index.imports) {
      if (!existsSync(path.join(root, dir, `${stem}.json`))) {
        report(index.file, `O index.ts importa './${stem}.json', que não existe em '${locale}'.`)
      }
      if (!exported.has(ident))
        report(
          index.file,
          `O namespace de './${stem}.json' está importado, mas não está no export default.`,
        )
    }

    // (a) JSON da pasta que o index.ts não registra
    for (const name of jsonFiles(root, dir)) {
      const stem = name.slice(0, -'.json'.length)
      if (!importedStems.has(stem)) {
        report(index.file, `O arquivo '${name}' não está importado nem exportado no index.ts.`)
      }
    }
  }

  // (c) mesmo conjunto de namespaces registrados em todos os idiomas
  const present = locales.filter((locale) => byLocale.has(locale))
  const [reference] = present
  if (!reference) return
  const referenceIndex = indexes.get(reference)
  for (const locale of present.slice(1)) {
    const index = indexes.get(locale)
    if (!referenceIndex && !index) continue
    if (!referenceIndex || !index) {
      const [withIndex, without] = referenceIndex ? [reference, locale] : [locale, reference]
      report(
        `${messagesDir}/${without}`,
        `O idioma '${withIndex}' registra os namespaces num index.ts e '${without}' não tem index.ts.`,
      )
      continue
    }
    for (const name of referenceIndex.exports.keys()) {
      if (!index.exports.has(name)) {
        report(
          index.file,
          `O namespace '${name}' está registrado em '${reference}' e falta em '${locale}'.`,
        )
      }
    }
    for (const name of index.exports.keys()) {
      if (!referenceIndex.exports.has(name)) {
        report(
          index.file,
          `O namespace '${name}' está registrado em '${locale}' e falta em '${reference}'.`,
        )
      }
    }
  }
}

/** Nomes dos arquivos JSON da pasta do idioma, em ordem alfabética. */
function jsonFiles(root: string, dir: string): string[] {
  return readdirSync(path.join(root, dir))
    .filter((name) => name.endsWith('.json'))
    .sort()
}

/** `add-product` vira `addProduct`: o nome que o app registra para o namespace. */
function camelCase(stem: string): string {
  return stem.replace(/-+([a-z0-9])/gi, (_, char: string) => char.toUpperCase())
}

/**
 * Lê os JSONs de um idioma, um namespace por arquivo, achatando as chaves. Com `index.ts`, o
 * prefixo da chave é o nome registrado lá; o arquivo que o `index.ts` não registra usa o nome
 * do arquivo em camelCase, para que o resto da análise não vire ruído.
 */
function readLocale(
  root: string,
  dir: string,
  index: LocaleIndex | null,
  report: (file: string, message: string) => void,
): Messages {
  const messages: Messages = new Map()
  for (const name of jsonFiles(root, dir)) {
    const file = `${dir}/${name}`
    const stem = name.slice(0, -'.json'.length)
    let tree: unknown
    try {
      tree = JSON.parse(readFileSync(path.join(root, file), 'utf8'))
    } catch (error) {
      report(file, `O arquivo não é um JSON válido: ${(error as Error).message}`)
      continue
    }
    if (!isTree(tree)) {
      report(file, 'O arquivo precisa ser um objeto JSON com as mensagens.')
      continue
    }
    for (const prefix of namespacesOf(stem, index)) flatten(tree, prefix, file, messages, report)
  }
  return messages
}

/** Os nomes sob os quais o arquivo é registrado: o do `index.ts`, ou o do arquivo sem ele. */
function namespacesOf(stem: string, index: LocaleIndex | null): string[] {
  if (!index) return [stem]
  const idents = [...index.imports].filter(([, from]) => from === stem).map(([ident]) => ident)
  const names = [...index.exports]
    .filter(([, ident]) => idents.includes(ident))
    .map(([name]) => name)
  return names.length > 0 ? names : [camelCase(stem)]
}

function flatten(
  tree: Tree,
  prefix: string,
  file: string,
  into: Messages,
  report: (file: string, message: string) => void,
): void {
  for (const [name, value] of Object.entries(tree)) {
    const key = `${prefix}.${name}`
    if (typeof value === 'string') into.set(key, { text: value, file })
    else if (isTree(value)) flatten(value, key, file, into, report)
    else report(file, `A mensagem '${key}' precisa ser um texto.`)
  }
}

/** Argumentos ICU do texto, ou null (e uma violação) se a mensagem está malformada. */
function placeholdersOf(
  text: string,
  key: string,
  file: string,
  report: (file: string, message: string) => void,
): string[] | null {
  try {
    return icuPlaceholders(text)
  } catch (error) {
    report(file, `A mensagem '${key}' tem ICU malformado: ${(error as Error).message}`)
    return null
  }
}

/** A mensagem malformada na referência é lida uma vez por idioma; deixa só a primeira. */
function dedupe(violations: Violation[]): Violation[] {
  const seen = new Set<string>()
  return violations.filter((v) => {
    const id = `${v.rule}|${v.file}|${v.message}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}
