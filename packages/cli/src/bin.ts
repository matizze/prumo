#!/usr/bin/env node
import { runCheck } from './check.ts'

const USAGE = `Uso: prumo <comando> [opções]

Comandos:
  check  Analisa o projeto e lista as violações da arquitetura.

Rode "prumo <comando> --help" para ver as opções de um comando.`

const [command, ...args] = process.argv.slice(2)

if (command === 'check') {
  process.exitCode = runCheck(args, {
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
  })
} else if (command === undefined || command === '--help' || command === '-h') {
  process.stdout.write(`${USAGE}\n`)
} else {
  process.stderr.write(`Comando desconhecido: '${command}'.\n\n${USAGE}\n`)
  process.exitCode = 2
}
