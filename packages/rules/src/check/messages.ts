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
 */
export function checkMessages(options: ResolvedOptions): Violation[] {
  const { messagesDir, locales } = options
  if (!existsSync(path.join(options.root, messagesDir))) return []

  const violations: Violation[] = []
  const report = (file: string, message: string) =>
    violations.push({ rule: 'messages', file, message })

  const byLocale = new Map<string, Messages>()
  for (const locale of locales) {
    const dir = `${messagesDir}/${locale}`
    if (!existsSync(path.join(options.root, dir))) {
      report(dir, `A pasta do idioma '${locale}' não existe.`)
      continue
    }
    byLocale.set(locale, readLocale(options.root, dir, report))
  }

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

/** Lê os JSONs de um idioma, um namespace por arquivo, achatando as chaves. */
function readLocale(
  root: string,
  dir: string,
  report: (file: string, message: string) => void,
): Messages {
  const messages: Messages = new Map()
  const names = readdirSync(path.join(root, dir))
    .filter((name) => name.endsWith('.json'))
    .sort()
  for (const name of names) {
    const file = `${dir}/${name}`
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
    flatten(tree, name.slice(0, -'.json'.length), file, messages, report)
  }
  return messages
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
