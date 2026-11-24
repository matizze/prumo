import path from 'node:path'
import { Option } from 'commander'
import { UsageError } from '../errors.ts'
import { DATA_SOURCE_CHOICES, generateRepository, type DataSourceChoice } from '../generators/repository.ts'
import { describeField } from '../lib/fields.ts'
import { entityFlag } from '../lib/names.ts'
import { findProject } from '../lib/project.ts'
import { formatSummary } from './summary.ts'
import type { RegisterCommand } from './index.ts'

type MakeRepositoryOptions = {
  entity?: string
  dataSource: DataSourceChoice
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
 * `prumo make:repository <domínio>`: cria o repositório do domínio com a fonte `mock`
 * (`src/repositories/<domínio>/`) e o registra no container `src/repositories/index.ts`; com
 * `--data-source http|storage`, acrescenta também a fonte (e cria o repositório, se falta). Os campos
 * saem do schema gerado pelo `make:schema`. O gerador valida tudo e monta o plano antes de
 * escrever, então um erro de uso (saída 2) não deixa nada pela metade; `--dry-run` só mostra o plano.
 */
export const registerMakeRepository: RegisterCommand = (program, io) => {
  program
    .command('make:repository')
    .summary('Cria o repositório de um domínio (contrato, mock e teste de contrato) ou acrescenta uma fonte.')
    .description(
      `Cria o repositório de um domínio, com a fonte mock, ou acrescenta a ele uma fonte (http ou storage).

Precisa do schema (prumo make:schema). Os campos do repositório (busca, ordem, dados de exemplo e teste de contrato) saem do schema gerado: não há --fields aqui. Um campo que o comando não reconhece (o schema foi editado à mão com algo fora dos tipos do --fields) é erro de uso, com a linha do campo. O .pick do schema de entrada e a SortKey também são lidos: o create e o teste de entrada usam só os campos do pick, e a ordem só os da SortKey.

Cria src/repositories/<domínio>/ com repository.contract.ts (o contrato), repository.mock.ts (em memória, com latência simulada), fixtures.ts (os dados de exemplo), repository.contract.test.ts (o teste de contrato, que roda contra o mock) e index.ts (a fábrica). Registra o domínio no container src/repositories/index.ts (o import, o export * e a entrada do mapa factories, em ordem alfabética) e acrescenta o texto de <ENTIDADE>_NOT_FOUND ao errors.json de cada idioma; num app sem esse arquivo, avisa e segue.

O <domínio> é o nome do domínio, no plural e em kebab-case (clientes, pedidos-recentes). A entidade é o singular, que sai do nome (tira o s final); onde a regra erra, informe a entidade com --entity, a mesma do make:schema.

Com --data-source http ou storage, cria o repositório completo (com o mock) se ele não existe e acrescenta a fonte; se já existe, acrescenta só a fonte. A fonte repository.storage.ts é o mock gravando no localStorage, com a chave <nome do app>:<domínio>. A fonte repository.http.ts usa fetch por src/repositories/http.ts: o backend responde no formato do app ({ items, total } na lista, os campos do schema), e a lista envia search, sort=<campo>:<asc|desc>, page e page_size; o 404 vira <ENTIDADE>_NOT_FOUND. A primeira fonte http do app cria também src/repositories/http.ts (o cliente), src/repositories/api.ts (a instância, com a VITE_API_URL) e src/vite-env.d.ts, se faltam. A fonte entra em DATA_SOURCES (src/repositories/options.ts), na fábrica do domínio (a linha if (dataSource === 'http') ..., que termina no mock) e no repository.contract.test.ts (o http só roda com API_TEST_URL). O app escolhe a fonte pela VITE_DATA_SOURCE.

Valida tudo antes de escrever e nunca sobrescreve: repositório que já existe (sem --data-source), fonte que já existe, schema que falta ou campo que não se lê saem com 2, sem deixar nada pela metade. --dry-run lista o que seria criado e alterado, sem escrever.`,
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
    .option('--root <pasta>', 'A pasta do projeto, a que tem o src.', '.')
    .option('--dry-run', 'Só lista o que seria criado e alterado, sem escrever nada.')
    .action((name: string, options: MakeRepositoryOptions) => {
      if (options.root === '') throw new UsageError("a opção '--root' precisa de um valor.")
      const project = findProject(path.resolve(io.cwd, options.root))
      const { plan, names, fields, dataSource, created, warnings } = generateRepository(project, {
        name,
        entity: options.entity,
        dataSource: options.dataSource,
      })
      const dryRun = options.dryRun === true
      const summary = dryRun ? plan.summary() : plan.commit()
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
}
