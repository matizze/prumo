import { UsageError } from '../errors.ts'
import { generateQuery } from '../generators/query.ts'
import { locateProject, ROOT_OPTION_DESCRIPTION } from '../lib/project.ts'
import { formatSummary } from './summary.ts'
import { addExamples } from './help-text.ts'
import type { RegisterCommand } from './index.ts'

type MakeQueryOptions = {
  entity?: string
  root?: string
  dryRun?: boolean
}

/** Recusa a opção dada sem valor (`--entity ''`): o commander a aceita. */
function nonEmpty(option: string) {
  return (value: string): string => {
    if (value.trim() === '') throw new UsageError(`a opção '${option}' precisa de um valor.`)
    return value
  }
}

/**
 * `prumo make:query <domínio>`: cria `src/queries/<domínio>.ts` (chaves, queries e hooks) e o
 * registra em `src/queries/index.ts`. Precisa do repositório. O gerador valida tudo e monta o
 * plano antes de escrever, então um erro de uso (saída 2) não deixa nada pela metade; `--dry-run`
 * só mostra o plano.
 */
export const registerMakeQuery: RegisterCommand = (program, io) => {
  const command = program
    .command('make:query')
    .summary('Cria as queries e mutations de um domínio (chaves, hooks de lista, detalhe e escrita).')
    .description(
        'Cria as queries e as mutations de um domínio, em cima do repositório dele.\n\nPrecisa do repositório (prumo make:repository).',
      )
    .argument('<domínio>', 'O nome do domínio, no plural e em kebab-case (por exemplo, clientes).')
    .option(
      '--entity <singular>',
      'A entidade, no singular (por exemplo, cliente). Padrão: o nome sem o s final. A mesma do make:schema.',
      nonEmpty('--entity'),
    )
    .option('--root <pasta>', ROOT_OPTION_DESCRIPTION)
    .option('--dry-run', 'Só lista o que seria criado e alterado, sem escrever nada.')
    .action((name: string, options: MakeQueryOptions) => {
      const project = locateProject(io.cwd, options.root)
      const { plan, names, exports } = generateQuery(project, { name, entity: options.entity })
      const dryRun = options.dryRun === true
      const summary = dryRun ? plan.verify() : plan.commit()
      const heading = `prumo make:query: ${names.plural.kebab} (entidade ${names.singular.kebab})${dryRun ? ' (simulação)' : ''}.`
      const ending = dryRun
        ? 'Simulação (--dry-run): nada foi escrito.\n'
        : `Próximo passo: prumo make:page ${names.plural.kebab} --query ${names.plural.kebab}\n`
      io.out(`${heading}\nExporta: ${exports.join(', ')}.\n\n${formatSummary(summary, dryRun)}\n${ending}`)
    })
  addExamples(
    command,
    [
      'prumo make:query livros',
      'prumo make:query categories --entity category',
    ],
    'prumo-makequery',
  )
}
