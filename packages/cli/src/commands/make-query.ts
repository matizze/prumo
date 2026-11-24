import path from 'node:path'
import { UsageError } from '../errors.ts'
import { generateQuery } from '../generators/query.ts'
import { findProject } from '../lib/project.ts'
import { formatSummary } from './summary.ts'
import type { RegisterCommand } from './index.ts'

type MakeQueryOptions = {
  entity?: string
  root: string
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
  program
    .command('make:query')
    .summary('Cria as queries e mutations de um domínio (chaves, hooks de lista, detalhe e escrita).')
    .description(
      `Cria as queries e as mutations de um domínio, em cima do repositório dele.

Precisa do repositório (prumo make:repository). Cria src/queries/<domínio>.ts com <entidade>Keys (as chaves do cache), <entidade>Queries (as opções de lista e detalhe), use<Domínio>List, use<Entidade>Detail, useCreate<Entidade>, useUpdate<Entidade>, useRemove<Entidade> e o tipo <Domínio>ListOptions, e registra o domínio em src/queries/index.ts (export { ... } from './<domínio>', em ordem alfabética). As queries só usam o contrato do repositório pelo useRepositories(), então funcionam com qualquer fonte (mock, http ou storage) e não leem os campos do schema.

O <domínio> é o nome do domínio, no plural e em kebab-case (clientes, pedidos-recentes). A entidade é o singular, que sai do nome (tira o s final); onde a regra erra, informe a entidade com --entity, a mesma do make:schema e do make:repository.

Valida tudo antes de escrever e nunca sobrescreve. Saem com 2, sem deixar nada pela metade: repositório que falta; repositório de outra entidade (a mensagem diz o --entity certo); arquivo do schema que falta; query que já existe; export que sobrou no índice sem o arquivo; e índice src/queries/index.ts que falta. --dry-run lista o que seria criado e alterado, sem escrever.`,
    )
    .argument('<domínio>', 'O nome do domínio, no plural e em kebab-case (por exemplo, clientes).')
    .option(
      '--entity <singular>',
      'A entidade, no singular (por exemplo, cliente). Padrão: o nome sem o s final. A mesma do make:schema.',
      nonEmpty('--entity'),
    )
    .option('--root <pasta>', 'A pasta do projeto, a que tem o src.', '.')
    .option('--dry-run', 'Só lista o que seria criado e alterado, sem escrever nada.')
    .action((name: string, options: MakeQueryOptions) => {
      if (options.root === '') throw new UsageError("a opção '--root' precisa de um valor.")
      const project = findProject(path.resolve(io.cwd, options.root))
      const { plan, names, exports } = generateQuery(project, { name, entity: options.entity })
      const dryRun = options.dryRun === true
      const summary = dryRun ? plan.summary() : plan.commit()
      const heading = `prumo make:query: ${names.plural.kebab} (entidade ${names.singular.kebab})${dryRun ? ' (simulação)' : ''}.`
      const ending = dryRun
        ? 'Simulação (--dry-run): nada foi escrito.\n'
        : `Próximo passo: prumo make:page ${names.plural.kebab} --query ${names.plural.kebab}\n`
      io.out(`${heading}\nExporta: ${exports.join(', ')}.\n\n${formatSummary(summary, dryRun)}\n${ending}`)
    })
}
