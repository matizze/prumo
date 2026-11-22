#!/usr/bin/env node
import { createRoot } from './root.ts'
import type { Choice } from './runtime.ts'
import { runCli } from './run.ts'

const runtime = {
  out: (text: string) => process.stdout.write(text),
  err: (text: string) => process.stderr.write(text),
  cwd: process.cwd(),
  env: process.env,
  // As perguntas precisam de um terminal nos dois lados: com a saída redirecionada, a lista sumiria
  interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  // O @clack/prompts só carrega quando há pergunta: o `check` e os demais comandos não pagam por ele
  choose: async (message: string, options: readonly Choice[]) =>
    (await import('./prompt.ts')).chooseInTerminal(message, options),
}

process.exitCode = await runCli(createRoot(runtime), process.argv.slice(2), runtime)
