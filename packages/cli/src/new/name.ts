/** O tamanho máximo de um nome de pacote no npm. */
const MAX_LENGTH = 214

/** kebab-case que começa com letra: `meu-produto`, `loja2`, `app`. */
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/**
 * Confere o nome do produto, que vira o nome da pasta e o `name` do `package.json`. Devolve o
 * motivo, em português, se o nome não serve, ou `undefined` se serve.
 */
export function productNameProblem(name: string): string | undefined {
  if (name.length > MAX_LENGTH) {
    return `o nome '${name}' é longo demais para um pacote (no máximo ${MAX_LENGTH} caracteres).`
  }
  if (!KEBAB_CASE.test(name)) {
    return `o nome '${name}' precisa estar em kebab-case, começar com letra e ter só letras minúsculas, números e hífens (por exemplo, meu-produto).`
  }
  return undefined
}

/** O nome para ler: `meu-produto` vira `Meu Produto` (título do `index.html` e do README). */
export function titleOf(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
