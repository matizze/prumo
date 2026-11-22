#!/usr/bin/env node
import { createRoot } from './root.ts'
import { runCli } from './run.ts'

const runtime = {
  out: (text: string) => process.stdout.write(text),
  err: (text: string) => process.stderr.write(text),
  cwd: process.cwd(),
  env: process.env,
}

process.exitCode = await runCli(createRoot(runtime), process.argv.slice(2), runtime)
