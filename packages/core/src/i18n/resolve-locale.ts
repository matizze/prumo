/**
 * Converte um código vindo do navegador ou do localStorage em um dos idiomas suportados.
 * Primeiro vale a igualdade sem diferença de caixa ("pt-br" vira "pt-BR"); depois, o primeiro
 * idioma suportado com a mesma língua-base ("pt" e "pt-PT" viram "pt-BR"; "en-US" vira "en").
 * Um código sem equivalente volta sem mudança, para o i18next seguir para o próximo candidato
 * (a lista `navigator.languages`) e só cair no padrão quando nenhum servir.
 */
export function resolveLocale(code: string, supported: readonly string[]): string {
  const lower = code.toLowerCase()
  const exact = supported.find((locale) => locale.toLowerCase() === lower)
  if (exact) return exact

  const base = (value: string) => value.toLowerCase().split('-')[0]
  return supported.find((locale) => base(locale) === base(code)) ?? code
}
