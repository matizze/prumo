/** Uma opção da pergunta ao usuário: o valor que volta, o rótulo e uma dica ao lado. */
export interface Choice {
  value: string
  label: string
  hint?: string
}

/**
 * O que os comandos usam do ambiente: onde escrever, a pasta de trabalho e a conversa com o
 * terminal. O bin passa o terminal e o `process.cwd()`; os testes passam espaços em branco, uma
 * pasta temporária e respostas prontas, e assim rodam os comandos sem subprocesso.
 */
export interface Runtime {
  out: (text: string) => void
  err: (text: string) => void
  cwd: string
  /** Há uma pessoa no terminal para responder perguntas. Em CI e em agentes é falso. */
  interactive: boolean
  /**
   * Pergunta ao usuário e devolve o valor da opção escolhida, ou `undefined` se ele cancelou. Só
   * é chamada quando `interactive` é verdadeiro.
   */
  choose: (message: string, options: readonly Choice[]) => Promise<string | undefined>
}
