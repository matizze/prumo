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
  /** As variáveis de ambiente (`PRUMO_REPOSITORY`, `PRUMO_CACHE_DIR`, `HOME`). Os testes passam um mapa vazio. */
  env: Readonly<Record<string, string | undefined>>
  /** Há uma pessoa no terminal para responder perguntas. Em CI e em agentes é falso. */
  interactive: boolean
  /**
   * O processo é o `prumo` do terminal: um subprocesso (o `pnpm install` do `new`, o `shadcn` do
   * `add`) pode herdar o stdout, o stderr e o stdin e mostrar o progresso direto. Ausente ou falso,
   * o stdout e o stderr do processo não são do comando (num servidor MCP, o stdout é o protocolo):
   * a saída do filho é capturada e repassada a `out` e `err`, e o stdin dele é ignorado. Só o
   * `bin.ts` o liga.
   */
  inheritStdio?: boolean
  /**
   * Pergunta ao usuário e devolve o valor da opção escolhida, ou `undefined` se ele cancelou. Só
   * é chamada quando `interactive` é verdadeiro.
   */
  choose: (message: string, options: readonly Choice[]) => Promise<string | undefined>
}
