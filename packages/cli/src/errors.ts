/** Termina o comando com um código de saída próprio (1 para violação, por exemplo). A mensagem, se houver, vai para o stderr. */
export class ExitError extends Error {
  readonly code: number

  constructor(code: number, message?: string) {
    super(message ?? '')
    this.name = 'ExitError'
    this.code = code
  }
}

/** Uso errado do comando: sai com 2 e escreve `prumo: <mensagem>` no stderr. A mensagem já diz o que fazer. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}
