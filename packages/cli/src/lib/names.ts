import { UsageError } from '../errors.ts'

/** Os nomes derivados de um nome em kebab-case. */
export interface Names {
  /** `pedidos-recentes`: a pasta, o arquivo de mensagens e a rota. */
  kebab: string
  /** `PedidosRecentes`: componentes, hooks e tipos. */
  pascal: string
  /** `pedidosRecentes`: o namespace do i18n e as chaves. */
  camel: string
}

/**
 * As palavras que não servem de identificador no código gerado, porque o nome da tela, do
 * domínio ou do componente vira `import <camel> from './<nome>.json'`, `const <camel> = ...` e
 * chaves de objeto. Entram as palavras reservadas do JavaScript, as reservadas só em modo estrito
 * (todo módulo é estrito: `let`, `static`, `yield`, `await`...), os literais (`null`, `true`) e os
 * nomes que o modo estrito proíbe como identificador (`eval`, `arguments`, `undefined`).
 */
export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  'arguments',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'with',
  'yield',
])

/**
 * Os nomes globais que um tipo ou componente com o mesmo nome esconderia dentro do arquivo gerado,
 * e o código que usa `Date`, `Promise` ou `Record<...>` passaria a apontar para o nome novo: os
 * objetos do JavaScript, os tipos utilitários do TypeScript e o `React`. São nomes em Pascal, o
 * que o domínio (`Date`, `Record`) e o componente usam sozinhos, sem prefixo nem sufixo.
 */
export const GLOBAL_NAMES: ReadonlySet<string> = new Set([
  'Array',
  'ArrayBuffer',
  'Awaited',
  'BigInt',
  'Boolean',
  'Date',
  'Error',
  'Exclude',
  'Extract',
  'Function',
  'Intl',
  'InstanceType',
  'JSON',
  'JSX',
  'Map',
  'Math',
  'NonNullable',
  'Number',
  'Object',
  'Omit',
  'Parameters',
  'Partial',
  'Pick',
  'Promise',
  'Proxy',
  'React',
  'Readonly',
  'Record',
  'Reflect',
  'RegExp',
  'Required',
  'ReturnType',
  'Set',
  'String',
  'Symbol',
  'URL',
  'URLSearchParams',
  'WeakMap',
  'WeakSet',
])

const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** Nome válido: kebab-case com letras minúsculas, números e hífen, começando por letra. */
export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name)
}

/** Lança um `UsageError` (saída 2) se o nome não for kebab-case. `what` entra na mensagem. */
export function assertValidName(name: string, what = 'nome'): void {
  if (isValidName(name)) return
  throw new UsageError(
    `${what} '${name}' é inválido: use kebab-case, com letras minúsculas, números e hífen, começando por letra (ex.: pedidos-recentes).`,
  )
}

/** Deriva Pascal e camel de um nome kebab-case, já validado: `error-404` vira `Error404`. */
export function deriveNames(name: string): Names {
  assertValidName(name)
  const pascal = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
  return { kebab: name, pascal, camel: pascal.charAt(0).toLowerCase() + pascal.slice(1) }
}

/**
 * Lança um `UsageError` (saída 2) se o nome derivado não serve de identificador no código gerado:
 * o camel é palavra reservada do JavaScript (`new`, `class`, `default`...: viraria
 * `import new from './new.json'`), ou, com `globals`, o Pascal é um nome global que o tipo ou o
 * componente esconderia (`Date`, `Record`, `Promise`...). `what` entra na mensagem.
 */
export function assertNotReserved(names: Names, what: string, { globals = false } = {}): void {
  if (RESERVED_WORDS.has(names.camel)) {
    throw new UsageError(
      `${what} '${names.kebab}' vira o identificador '${names.camel}', que é palavra reservada do JavaScript e quebraria o código gerado: escolha outro nome.`,
    )
  }
  if (globals && GLOBAL_NAMES.has(names.pascal)) {
    throw new UsageError(
      `${what} '${names.kebab}' vira o identificador '${names.pascal}', que é um nome global do JavaScript ou do TypeScript e esconderia o original no código gerado: escolha outro nome.`,
    )
  }
}

/** Valida o nome (kebab-case, sem palavra reservada) e devolve os nomes derivados dele. */
export function usableNames(name: string, what: string, options?: { globals?: boolean }): Names {
  assertValidName(name, what)
  const names = deriveNames(name)
  assertNotReserved(names, what, options)
  return names
}

/** O tamanho máximo de um nome de pacote no npm. */
const MAX_APP_NAME_LENGTH = 214

/**
 * Confere o nome do app, que vira o nome da pasta e o `name` do `package.json`. Devolve o motivo,
 * em português, se o nome não serve, ou `undefined` se serve.
 */
export function appNameProblem(name: string): string | undefined {
  if (name.length > MAX_APP_NAME_LENGTH) {
    return `o nome '${name}' é longo demais para um pacote (no máximo ${MAX_APP_NAME_LENGTH} caracteres).`
  }
  if (!isValidName(name)) {
    return `o nome '${name}' precisa estar em kebab-case, começar com letra e ter só letras minúsculas, números e hífens (por exemplo, meu-app).`
  }
  return undefined
}

/** O nome para ler: `meu-app` vira `Meu App` (título do `index.html` e do `AGENTS.md`). */
export function titleOf(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Os nomes de um domínio: o plural (`suppliers`) e o singular da entidade (`supplier`). */
export interface DomainNames {
  plural: Names
  singular: Names
}

/**
 * Os plurais cujo singular a regra de tirar o `s` erra, e o que costuma ser o singular. Terminam
 * em `ies` (`categories`, de `category`), `sses`, `xes`, `ches` e `shes` (`classes`, `boxes`,
 * `matches`, `wishes`: o singular perde o `es`), ou em `us` e `ss`, que já parecem singulares
 * (`status`, `address`) e não têm um palpite.
 */
const IRREGULAR_PLURALS: { suffix: string; singular: (plural: string) => string | undefined }[] = [
  { suffix: 'ies', singular: (plural) => `${plural.slice(0, -3)}y` },
  { suffix: 'sses', singular: (plural) => plural.slice(0, -2) },
  { suffix: 'xes', singular: (plural) => plural.slice(0, -2) },
  { suffix: 'ches', singular: (plural) => plural.slice(0, -2) },
  { suffix: 'shes', singular: (plural) => plural.slice(0, -2) },
  { suffix: 'us', singular: () => undefined },
  { suffix: 'ss', singular: () => undefined },
]

/**
 * O singular de um plural, pela regra simples que serve ao inglês e ao português: tira o `s`
 * final (`suppliers` vira `supplier`, `pedidos` vira `pedido`), com as exceções do português na
 * última palavra do nome (`fornecedores` vira `fornecedor`, `paes` vira `pao`, `itens` vira `item`;
 * veja `PORTUGUESE_PLURALS`). Onde a regra erra, recusa em vez
 * de derivar um nome errado em silêncio (`status` viraria `statu`, `categories`, `categorie`):
 * o plural que termina em `ies`, `us`, `ss`, `xes`, `ches`, `shes` ou `sses` pede o singular
 * explícito (`--entity`), e a mensagem sugere o provável (`categories`: `--entity category`).
 */
export function singularOf(plural: string): string {
  const singular = plural.slice(0, -1)
  if (!plural.endsWith('s') || singular.length < 2 || singular.endsWith('-')) {
    throw new UsageError(
      `não consegui derivar o singular de '${plural}': o nome do domínio é o plural e termina em 's'. Informe o singular com --entity.`,
    )
  }
  const irregular = IRREGULAR_PLURALS.find(({ suffix }) => plural.endsWith(suffix))
  if (irregular) {
    const guess = irregular.singular(plural)
    throw new UsageError(
      guess === undefined
        ? `'${plural}' parece já estar no singular, e tirar o 's' daria '${singular}': informe a entidade com --entity (ela tem que diferir do nome do domínio).`
        : `tirar o 's' de '${plural}' daria '${singular}', que provavelmente não é o singular: informe a entidade com --entity (provavelmente --entity ${guess}).`,
    )
  }
  return portugueseSingular(plural) ?? singular
}

/**
 * Os plurais do português (em kebab-case, sem acento) que a regra de tirar o `s` erra, pelo final
 * da última palavra do nome (`pedidos-itens` olha `itens`): o sufixo, o que ele vira e quantas
 * letras a palavra precisa ter antes dele (para `leis`, `reis` e `bois` não virarem `lel`, `rel`
 * e `bol`). Só entram os finais que o inglês quase não usa: `-ns` geral (`icons`, `options`,
 * `sessions`) e `-res`, `-zes` e `-oes` gerais (`features`, `sizes`, `shoes`) trariam singulares
 * errados, então valem `-ens`, `-ores`, `-eres`, `-uzes`, `-ezes` e `-ozes`.
 */
const PORTUGUESE_PLURALS: { suffix: string; singular: string; stem: number }[] = [
  { suffix: 'ores', singular: 'or', stem: 1 },
  { suffix: 'eres', singular: 'er', stem: 1 },
  { suffix: 'uzes', singular: 'uz', stem: 1 },
  { suffix: 'ezes', singular: 'ez', stem: 1 },
  { suffix: 'ozes', singular: 'oz', stem: 1 },
  { suffix: 'oes', singular: 'ao', stem: 2 },
  { suffix: 'aes', singular: 'ao', stem: 1 },
  { suffix: 'ais', singular: 'al', stem: 2 },
  { suffix: 'eis', singular: 'el', stem: 3 },
  { suffix: 'ois', singular: 'ol', stem: 3 },
  { suffix: 'ens', singular: 'em', stem: 1 },
]

/** Últimas palavras que parecem plural do português e são do inglês: ficam com a regra do `s`. */
const ENGLISH_LOOKALIKES: ReadonlySet<string> = new Set([
  'shoes',
  'toes',
  'heroes',
  'potatoes',
  'tomatoes',
  'echoes',
  'canoes',
  'stores',
  'scores',
  'tokens',
  'citizens',
])

/** O singular do português para a última palavra do plural, ou `undefined` se nenhuma regra vale. */
function portugueseSingular(plural: string): string | undefined {
  const cut = plural.lastIndexOf('-') + 1
  const word = plural.slice(cut)
  if (ENGLISH_LOOKALIKES.has(word)) return undefined
  for (const { suffix, singular, stem } of PORTUGUESE_PLURALS) {
    if (word.endsWith(suffix) && word.length - suffix.length >= stem) {
      return plural.slice(0, plural.length - suffix.length) + singular
    }
  }
  return undefined
}

/**
 * O singular que o `make:*` deriva do domínio, ou `undefined` quando `singularOf` recusa: o
 * `--entity` só precisa aparecer na dica quando a entidade não é essa.
 */
export function automaticSingular(plural: string): string | undefined {
  try {
    return singularOf(plural)
  } catch {
    return undefined
  }
}

/** ` --entity <singular>` quando a entidade difere da derivada do domínio, ou `''` quando a derivada serve. */
export function entityFlag(names: DomainNames): string {
  return automaticSingular(names.plural.kebab) === names.singular.kebab
    ? ''
    : ` --entity ${names.singular.kebab}`
}

/**
 * Deriva os nomes de um domínio. `plural` é o nome do domínio (`suppliers`); `singular` é a
 * entidade (`supplier`) e, quando falta, sai da regra de `singularOf`. O singular não pode ser
 * igual ao plural, senão o tipo da entidade e o da lista teriam o mesmo nome.
 */
export function domainNames(plural: string, singular?: string): DomainNames {
  assertValidName(plural, 'o nome do domínio')
  if (singular !== undefined) assertValidName(singular, 'a entidade')
  // O singular e o plural viram tipos, constantes e variáveis locais: nenhum pode ser palavra
  // reservada nem um nome global
  const pluralNames = usableNames(plural, 'o nome do domínio', { globals: true })
  const entity = singular ?? singularOf(plural)
  if (entity === plural) {
    throw new UsageError(
      `a entidade '${entity}' é igual ao nome do domínio: o singular tem que diferir do plural.`,
    )
  }
  return {
    plural: pluralNames,
    singular: usableNames(entity, 'a entidade', { globals: true }),
  }
}
