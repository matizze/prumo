import { existsSync } from 'node:fs'
import path from 'node:path'
import { toPosix } from '../eslint/paths.ts'
import { walk } from './files.ts'
import type { ResolvedOptions, Violation } from './types.ts'

/**
 * Todo `services/<ação>.usecase.ts` de `src/use-cases` tem o `types/<ação>.ts` (o endereço, o
 * Request e o Response), na pasta irmã `types`, e o `<ação>.usecase.test.ts` (o teste) ao lado. A
 * rota de mock (`mocks/<ação>.ts`) não é cobrada: o use case `--local` roda no navegador e não tem mock.
 *
 * Um `*.usecase.ts` fora de `services/` é o layout da 0.10 (os tipos ao lado, na mesma pasta): acusa
 * uma vez, com a migração, e não cobra os arquivos que ele não tem no layout novo.
 */
export function checkUseCaseFiles(options: ResolvedOptions): Violation[] {
  const base = path.join(options.root, options.useCasesDir)
  return walk(base).flatMap((file) => {
    const name = /^(.+)\.usecase\.ts$/.exec(path.basename(file))?.[1]
    if (name === undefined) return []
    const folder = path.dirname(file)
    if (path.basename(folder) !== 'services') {
      return [
        {
          rule: 'use-case-files',
          file: toPosix(path.relative(options.root, file)),
          message: `O use case '${name}' está fora de services/: mova para services/ e os tipos para types/ (veja o guia de migração).`,
        },
      ]
    }
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
