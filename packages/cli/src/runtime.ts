/**
 * O que os comandos usam do ambiente: onde escrever e a pasta de trabalho. O bin passa o terminal
 * e o `process.cwd()`; os testes passam espaços em branco e uma pasta temporária, e assim rodam
 * os comandos sem subprocesso.
 */
export interface Runtime {
  out: (text: string) => void
  err: (text: string) => void
  cwd: string
}
