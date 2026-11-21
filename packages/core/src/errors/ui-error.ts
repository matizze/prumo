/**
 * Erro que pode chegar à interface. O repositório não conhece idioma: lança um `UIError` com um
 * código estável (`INVALID_CREDENTIALS`, `TASK_NOT_FOUND`), e a interface mostra o texto da chave
 * `errors.<CODE>` no idioma ativo. A `message` é só para logs e testes, nunca para a tela.
 */
export class UIError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'UIError'
    this.code = code
  }
}
