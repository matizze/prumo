import { existsSync } from 'node:fs'
import path from 'node:path'
import { toPosix } from '../eslint/paths.ts'
import { walk } from './files.ts'
import type { ResolvedOptions, Violation } from './types.ts'

/**
 * Todo `services/<ação>.usecase.ts` de `src/use-cases` tem o `types/<ação>.ts` (o endereço, o
 * Request e o Response), na pasta irmã `types`, e o `<ação>.usecase.test.ts` (o teste) ao lado. A
 * rota de mock (`mocks/<ação>.ts`) não é cobrada: o use case `--local` roda no navegador e não tem mock.
 */
export function checkUseCaseFiles(options: ResolvedOptions): Violation[] {
  const base = path.join(options.root, options.useCasesDir)
  return walk(base).flatMap((file) => {
    const name = /^(.+)\.usecase\.ts$/.exec(path.basename(file))?.[1]
    if (name === undefined) return []
    const folder = path.dirname(file)
    const companions = [
      path.join(path.dirname(folder), 'types', `${name}.ts`),
      path.join(folder, `${name}.usecase.test.ts`),
    ]
    return companions
      .filter((companion) => !existsSync(companion))
      .map(
        (companion): Violation => ({
          rule: 'use-case-files',
          file: toPosix(path.relative(options.root, file)),
          message: `O use case '${name}' precisa do arquivo '${toPosix(path.relative(path.dirname(folder), companion))}' (a partir da pasta do domínio).`,
        }),
      )
  })
}
