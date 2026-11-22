/**
 * A API em processo do `@matizze/prumo-cli`, para o servidor MCP: rodar um comando
 * sem subprocesso e descrever a árvore de comandos como dado. Importar este módulo não tem efeito
 * colateral (não lê o `process` nem escreve nada); o `bin.ts` é quem roda a CLI.
 */
export {
  describeCommands,
  toArgv,
  toolNameOf,
  type CommandInfo,
  type OptionInfo,
  type OptionKind,
} from './describe.ts'
export { runInProcess, type InProcessOptions, type InProcessResult } from './in-process.ts'
export { createRoot } from './root.ts'
export { runCli } from './run.ts'
export type { Runtime } from './runtime.ts'
