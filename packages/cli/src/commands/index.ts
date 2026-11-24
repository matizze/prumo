import type { Command } from 'commander'
import type { Io } from '../io.ts'
import { registerCheck } from './check.ts'
import { registerList } from './list.ts'
import { registerMcp } from './mcp.ts'
import { registerMakePage } from './make-page.ts'
import { registerMakeQuery } from './make-query.ts'
import { registerMakeRepository } from './make-repository.ts'
import { registerMakeSchema } from './make-schema.ts'
import { registerMakeUseCase } from './make-usecase.ts'
import { registerNew } from './new.ts'

/**
 * Um comando do prumo: um arquivo em `commands/` que exporta uma função destas. Ela registra o comando
 * no programa (`program.command('nome')`, com argumentos, opções e `.action`) e devolve nada. O comando
 * fica fino: lê os argumentos, chama o gerador e escreve o resultado pelo `io`. Erro de uso é `UsageError`;
 * código de saída próprio é `ExitError`.
 */
export type RegisterCommand = (program: Command, io: Io) => void

/** Os comandos do prumo, na ordem em que aparecem na ajuda. Um comando novo entra aqui. */
export const commands: readonly RegisterCommand[] = [
  registerNew,
  registerMakeSchema,
  registerMakeUseCase,
  registerMakeRepository,
  registerMakeQuery,
  registerMakePage,
  registerCheck,
  registerList,
  registerMcp,
]
