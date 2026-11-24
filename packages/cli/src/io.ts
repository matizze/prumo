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
  /** As variáveis de ambiente (só o `PRUMO_DEBUG` interessa: ligado com qualquer valor que não seja vazio, `0` ou `false`). O `bin.ts` passa as do processo; sem elas, nenhuma está definida. */
  env?: Readonly<Record<string, string | undefined>>
  /** O processo é o `prumo` do terminal: um subprocesso (o `pnpm install` do `new`) herda os fluxos e mostra o progresso direto. Só o `bin.ts` liga. */
  inheritStdio?: boolean
}
