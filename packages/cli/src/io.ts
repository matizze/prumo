/** O que um comando precisa do mundo de fora: a pasta, a saída e a saída de erro. O `bin.ts` passa o terminal; os testes passam funções que capturam o texto. */
export type Io = {
  /** A pasta onde o comando roda (o `process.cwd()` no terminal). */
  cwd: string
  /** Escreve na saída padrão. O texto já traz as quebras de linha. */
  out: (text: string) => void
  /** Escreve na saída de erro. */
  err: (text: string) => void
  /** A largura do terminal, para quebrar a ajuda. Padrão: 80. */
  columns?: number
}
