/** Nome padrão do parâmetro de query que leva a rota de origem até o login. */
export const ORIGIN_PARAM = 'next'

/**
 * Devolve `value` só se for um caminho relativo do próprio app (começa com `/`, sem `//`, sem
 * barra invertida, sem esquema nem caractere de controle); caso contrário, `fallback`. É a
 * defesa contra redirecionamento aberto: `?next=https://outro.site` ou `?next=//outro.site` nunca
 * levam a pessoa para fora do app.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.includes('\\')) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  try {
    // Confere que o texto continua no mesmo endereço quando lido como URL.
    if (new URL(value, 'http://app.invalid').origin !== 'http://app.invalid') return fallback
  } catch {
    return fallback
  }
  return value
}

/**
 * A rota do login com a origem anexada: `/login` + `/clientes?page=2` vira
 * `/login?next=%2Fclientes%3Fpage%3D2`. Origem que não é um caminho seguro é descartada.
 */
export function buildLoginRedirect(
  redirectTo: string,
  origin: string,
  param: string = ORIGIN_PARAM,
): string {
  const safe = safeRedirectPath(origin, '')
  if (!safe) return redirectTo
  const separator = redirectTo.includes('?') ? '&' : '?'
  return `${redirectTo}${separator}${encodeURIComponent(param)}=${encodeURIComponent(safe)}`
}

/**
 * Lê a rota de origem de uma query (`?next=/clientes?page=2`) e devolve um caminho seguro, ou
 * `fallback`. Aceita o texto da query com ou sem o `?` inicial.
 */
export function readOrigin(search: string, fallback = '/', param: string = ORIGIN_PARAM): string {
  return safeRedirectPath(new URLSearchParams(search).get(param), fallback)
}
