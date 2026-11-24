import { Option } from 'commander'
import { UsageError } from '../errors.ts'
import { DATA_SOURCE_CHOICES, generateRepository, type DataSourceChoice } from '../generators/repository.ts'
import { describeField } from '../lib/fields.ts'
import { entityFlag } from '../lib/names.ts'
import { locateProject, ROOT_OPTION_DESCRIPTION } from '../lib/project.ts'
import { formatSummary } from './summary.ts'
import { addExamples } from './help-text.ts'
import type { RegisterCommand } from './index.ts'

type MakeRepositoryOptions = {
  entity?: string
  dataSource: DataSourceChoice
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
 * `prumo make:repository <domínio>`: cria o repositório do domínio com a fonte `mock`
 * (`src/repositories/<domínio>/`) e o registra no container `src/repositories/index.ts`; com
 * `--data-source http|storage`, acrescenta também a fonte (e cria o repositório, se falta). Os campos
 * saem do schema gerado pelo `make:schema`. O gerador valida tudo e monta o plano antes de
 * escrever, então um erro de uso (saída 2) não deixa nada pela metade; `--dry-run` só mostra o plano.
 */
export const registerMakeRepository: RegisterCommand = (program, io) => {
  const command = program
    .command('make:repository')
    .summary('Cria o repositório de um domínio (contrato, mock e teste de contrato) ou acrescenta uma fonte.')
    .description(
        'Cria o repositório de um domínio (contrato, mock e teste de contrato) ou acrescenta a ele uma fonte, http ou storage.\n\nPrecisa do schema (prumo make:schema); os campos saem dele.',
      )
    .argument('<domínio>', 'O nome do domínio, no plural e em kebab-case (por exemplo, clientes).')
    .option(
      '--entity <singular>',
      'A entidade, no singular (por exemplo, cliente). Padrão: o nome sem o s final. A mesma do make:schema.',
      nonEmpty('--entity'),
    )
    .addOption(
      new Option(
        '--data-source <fonte>',
        'A fonte a criar: mock (o repositório inteiro), ou http e storage (acrescentam a fonte, e criam o repositório se falta).',
      )
        .choices(DATA_SOURCE_CHOICES)
        .default('mock'),
    )
    .option('--root <pasta>', ROOT_OPTION_DESCRIPTION)
    .option('--dry-run', 'Só lista o que seria criado e alterado, sem escrever nada.')
    .action((name: string, options: MakeRepositoryOptions) => {
      const project = locateProject(io.cwd, options.root)
      const { plan, names, fields, dataSource, created, warnings } = generateRepository(project, {
        name,
        entity: options.entity,
        dataSource: options.dataSource,
      })
      const dryRun = options.dryRun === true
      const summary = dryRun ? plan.verify() : plan.commit()
      const origin = created ? '' : ', repositório que já existia'
      const heading = `prumo make:repository: ${names.plural.kebab} (entidade ${names.singular.kebab}, fonte ${dataSource}${origin})${dryRun ? ' (simulação)' : ''}.`
      const fieldsLine = `Campos (lidos do schema): ${fields.map(describeField).join(', ')}.`
      const warningLines = warnings.map((warning) => `Aviso: ${warning}\n`).join('')
      const use =
        dataSource === 'mock'
          ? ''
          : `Para usar a fonte ${dataSource}: ${dataSource === 'http' ? 'VITE_DATA_SOURCE=http e VITE_API_URL=<endereço da API>' : 'VITE_DATA_SOURCE=storage'} (veja docs/guides/real-api.md).\n`
      const ending = dryRun
        ? 'Simulação (--dry-run): nada foi escrito.\n'
        : `${use}Próximo passo: prumo make:query ${names.plural.kebab}${entityFlag(names)}\n`
      io.out(
        `${heading}\n${fieldsLine}\n\n${formatSummary(summary, dryRun)}\n${warningLines}${warningLines === '' ? '' : '\n'}${ending}`,
      )
    })
  addExamples(
    command,
    [
      'prumo make:repository livros',
      'prumo make:repository livros --data-source http',
      'prumo make:repository livros --data-source storage --dry-run',
    ],
    'prumo-makerepository',
  )
}
