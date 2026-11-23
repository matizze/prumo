import path from 'node:path'
import { UsageError } from '../errors.ts'
import { generateRepository } from '../generators/repository.ts'
import { describeField } from '../lib/fields.ts'
import { entityFlag } from '../lib/names.ts'
import { findProject } from '../lib/project.ts'
import { formatSummary } from './summary.ts'
import type { RegisterCommand } from './index.ts'

type MakeRepositoryOptions = { entity?: string; root: string; dryRun?: boolean }

/** Recusa a opção dada sem valor (`--entity ''`): o commander a aceita. */
function nonEmpty(option: string) {
  return (value: string): string => {
    if (value.trim() === '') throw new UsageError(`a opção '${option}' precisa de um valor.`)
    return value
  }
}

/**
 * `prumo make:repository <domínio>`: cria o repositório do domínio com a fonte `mock`
 * (`src/repositories/<domínio>/`) e o registra no container `src/repositories/index.ts`. Os campos
 * saem do schema gerado pelo `make:schema`. O gerador valida tudo e monta o plano antes de
 * escrever, então um erro de uso (saída 2) não deixa nada pela metade; `--dry-run` só mostra o plano.
 */
export const registerMakeRepository: RegisterCommand = (program, io) => {
  program
    .command('make:repository')
    .summary('Cria o repositório de um domínio (contrato, mock e teste de contrato).')
    .description(
      `Cria o repositório de um domínio, com a fonte mock.

Precisa do schema (prumo make:schema). Os campos do repositório (busca, ordem, dados de exemplo e teste de contrato) saem do schema gerado: não há --fields aqui. Um campo que o comando não reconhece (o schema foi editado à mão com algo fora dos tipos do --fields) é erro de uso, com a linha do campo. O .pick do schema de entrada e a SortKey também são lidos: o create e o teste de entrada usam só os campos do pick, e a ordem só os da SortKey.

Cria src/repositories/<domínio>/ com repository.contract.ts (o contrato), repository.mock.ts (em memória, com latência simulada), fixtures.ts (os dados de exemplo), repository.contract.test.ts (o teste de contrato, que roda contra o mock) e index.ts (a fábrica). Registra o domínio no container src/repositories/index.ts (o import, o export * e a entrada do mapa factories, em ordem alfabética) e acrescenta o texto de <ENTIDADE>_NOT_FOUND ao errors.json de cada idioma; num app sem esse arquivo, avisa e segue.

O <domínio> é o nome do domínio, no plural e em kebab-case (clientes, pedidos-recentes). A entidade é o singular, que sai do nome (tira o s final); onde a regra erra, informe a entidade com --entity, a mesma do make:schema.

Valida tudo antes de escrever e nunca sobrescreve: repositório que já existe, schema que falta ou campo que não se lê saem com 2, sem deixar nada pela metade. --dry-run lista o que seria criado e alterado, sem escrever.`,
    )
    .argument('<domínio>', 'O nome do domínio, no plural e em kebab-case (por exemplo, clientes).')
    .option(
      '--entity <singular>',
      'A entidade, no singular (por exemplo, cliente). Padrão: o nome sem o s final. A mesma do make:schema.',
      nonEmpty('--entity'),
    )
    .option('--root <pasta>', 'A pasta do projeto, a que tem o src.', '.')
    .option('--dry-run', 'Só lista o que seria criado e alterado, sem escrever nada.')
    .action((name: string, options: MakeRepositoryOptions) => {
      if (options.root === '') throw new UsageError("a opção '--root' precisa de um valor.")
      const project = findProject(path.resolve(io.cwd, options.root))
      const { plan, names, fields, warnings } = generateRepository(project, {
        name,
        entity: options.entity,
      })
      const dryRun = options.dryRun === true
      const summary = dryRun ? plan.summary() : plan.commit()
      const heading = `prumo make:repository: ${names.plural.kebab} (entidade ${names.singular.kebab}, fonte mock)${dryRun ? ' (simulação)' : ''}.`
      const fieldsLine = `Campos (lidos do schema): ${fields.map(describeField).join(', ')}.`
      const warningLines = warnings.map((warning) => `Aviso: ${warning}\n`).join('')
      const ending = dryRun
        ? 'Simulação (--dry-run): nada foi escrito.\n'
        : `Próximo passo: prumo make:query ${names.plural.kebab}${entityFlag(names)}\n`
      io.out(
        `${heading}\n${fieldsLine}\n\n${formatSummary(summary, dryRun)}\n${warningLines}${warningLines === '' ? '' : '\n'}${ending}`,
      )
    })
}
