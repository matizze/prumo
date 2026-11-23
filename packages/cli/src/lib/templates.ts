import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Names } from './names.ts'

/**
 * A pasta dos modelos: `templates/`, na raiz do pacote. Fica dois níveis acima de `src/lib/` e de `dist/lib/`,
 * então o mesmo caminho vale no workspace (que roda o código-fonte) e no pacote publicado (que
 * roda o `dist/`, e leva a pasta pelo `files` do package.json).
 */
export const TEMPLATES_DIR = path.resolve(import.meta.dirname, '../../templates')

/** Os valores dos marcadores de um modelo: `{ 'plural.kebab': 'clientes' }` para `{{plural.kebab}}`. */
export type TemplateVars = Readonly<Record<string, string>>

const MARKER = /\{\{([A-Za-z][A-Za-z0-9.]*)\}\}/g

/**
 * Troca cada marcador `{{nome}}` do texto pelo valor de `nome`. O nome do marcador só tem letras,
 * números e ponto, então um `{{` de JSX (`style={{ a: 1 }}`) não é marcador. Um marcador sem valor é
 * erro do modelo e lança: gerar `undefined` no código de alguém seria pior que parar.
 */
export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(MARKER, (_, key: string) => {
    const value = vars[key]
    if (value === undefined)
      throw new Error(`o modelo usa o marcador {{${key}}}, que não tem valor.`)
    return value
  })
}

/** O texto de um modelo, com o caminho relativo a `templates/` (`domain/schema.ts.tpl`). */
export function readTemplate(name: string): string {
  return readFileSync(path.join(TEMPLATES_DIR, name), 'utf8')
}

/** Lê o modelo e troca os marcadores. */
export function renderTemplateFile(name: string, vars: TemplateVars): string {
  return renderTemplate(readTemplate(name), vars)
}

/**
 * Os marcadores de um nome: `<prefixo>.kebab` (`clientes`), `.pascal` (`Clientes`), `.camel`
 * (`clientes`), `.constant` (`CLIENTES`, para constantes e códigos de erro; `pedidos-recentes`
 * vira `PEDIDOS_RECENTES`) e `.title` (`Pedidos recentes`, o nome como texto para a pessoa ler:
 * hífen vira espaço e a primeira letra sobe).
 */
export function nameVars(prefix: string, names: Names): Record<string, string> {
  const words = names.kebab.replaceAll('-', ' ')
  return {
    [`${prefix}.kebab`]: names.kebab,
    [`${prefix}.pascal`]: names.pascal,
    [`${prefix}.camel`]: names.camel,
    [`${prefix}.constant`]: names.kebab.replaceAll('-', '_').toUpperCase(),
    [`${prefix}.title`]: words.charAt(0).toUpperCase() + words.slice(1),
  }
}
