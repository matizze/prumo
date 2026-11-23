/** Valores que entram no texto do erro (variáveis da mensagem ICU, como `{limite}`). */
export type ErrorParams = Record<string, unknown>

/**
 * Erro que pode chegar à interface. O repositório não conhece idioma: lança um `UIError` com um
 * código estável (`INVALID_CREDENTIALS`, `TASK_NOT_FOUND`), e a interface mostra o texto da chave
 * `errors.<CODE>` no idioma ativo. A `message` é só para logs e testes, nunca para a tela.
 *
 * `params` leva os valores que o texto precisa (`new UIError('LOAN_LIMIT', 'limite', { limite: 3 })`
 * com `"LOAN_LIMIT": "Você já tem {limite} livros emprestados"`), em vez de fixar o número no JSON.
 */
export class UIError extends Error {
  code: string
  params?: ErrorParams
  constructor(code: string, message: string, params?: ErrorParams) {
    super(message)
    this.name = 'UIError'
    this.code = code
    if (params) this.params = params
  }
}
