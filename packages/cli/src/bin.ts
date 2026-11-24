#!/usr/bin/env node
import { run } from './program.ts'

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
  env: process.env,
  columns: process.stdout.columns,
  inheritStdio: true,
})
