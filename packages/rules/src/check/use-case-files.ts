import { existsSync } from 'node:fs'
import path from 'node:path'
import { toPosix } from '../eslint/paths.ts'
import { walk } from './files.ts'
import type { ResolvedOptions, Violation } from './types.ts'

/** Os arquivos que cada `<ação>.usecase.ts` tem ao lado, pelo sufixo (o mock não é obrigatório: o use case local não tem). */
const COMPANIONS = ['types.ts', 'usecase.test.ts'] as const

/**
 * Todo `<ação>.usecase.ts` de `src/use-cases` tem, na mesma pasta, o `<ação>.types.ts` (o endereço, o
 * Input e o Output) e o `<ação>.usecase.test.ts` (o teste). O mock (`<ação>.mock.ts`) não é cobrado:
 * o use case `--local` roda no navegador e não tem mock.
 */
export function checkUseCaseFiles(options: ResolvedOptions): Violation[] {
  const base = path.join(options.root, options.useCasesDir)
  return walk(base).flatMap((file) => {
    const name = /^(.+)\.usecase\.ts$/.exec(path.basename(file))?.[1]
    if (name === undefined) return []
    const folder = path.dirname(file)
    return COMPANIONS.filter((suffix) => !existsSync(path.join(folder, `${name}.${suffix}`))).map(
      (suffix): Violation => ({
        rule: 'use-case-files',
        file: toPosix(path.relative(options.root, file)),
        message: `O use case '${name}' precisa do arquivo '${name}.${suffix}' na mesma pasta.`,
      }),
    )
  })
}
