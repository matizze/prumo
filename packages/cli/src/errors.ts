/**
 * Fim de comando com um código de saída. A mensagem, se houver, vai para o stderr; sem mensagem, o
 * comando já escreveu o que tinha a dizer (como o `check`, que lista as violações).
 */
export class ExitError extends Error {
  readonly code: number

  constructor(code: number, message = '') {
    super(message)
    this.name = 'ExitError'
    this.code = code
  }
}

/** Uso errado do comando: opção inexistente, argumento que falta, pasta que não é projeto. Sai com 2. */
export class UsageError extends ExitError {
  constructor(message: string) {
    super(2, message)
    this.name = 'UsageError'
  }
}
