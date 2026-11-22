/**
 * O que os comandos usam do ambiente: onde escrever e a pasta de trabalho. O bin passa o terminal
 * e o `process.cwd()`; os testes passam espaços em branco e uma pasta temporária, e assim rodam os
 * comandos sem subprocesso.
 */
export interface Runtime {
  out: (text: string) => void
  err: (text: string) => void
  cwd: string
  /** As variáveis de ambiente dos comandos. Os testes passam um mapa vazio. */
  env: Readonly<Record<string, string | undefined>>
  /**
   * O processo é o `prumo` do terminal: um subprocesso (o `pnpm install` do `new`) pode herdar o
   * stdout, o stderr e o stdin e mostrar o progresso direto. Ausente ou falso, o stdout e o stderr
   * do processo não são do comando (num servidor MCP, o stdout é o protocolo): a saída do filho é
   * capturada e repassada a `out` e `err`, e o stdin dele é ignorado. Só o `bin.ts` o liga.
   */
  inheritStdio?: boolean
}
