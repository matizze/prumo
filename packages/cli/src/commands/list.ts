import {
  listProject,
  type ListedField,
  type ListedPage,
  type PageVariation,
  type ProjectListing,
} from '../generators/listing.ts'
import { locateProject, ROOT_OPTION_DESCRIPTION } from '../lib/project.ts'
import { documentCommand } from './help-text.ts'
import type { RegisterCommand } from './index.ts'

/** Os rótulos da variação da tela no texto; o JSON traz o valor em inglês. */
const VARIATION_LABELS: Record<PageVariation, string> = {
  title: 'título',
  list: 'lista',
  param: 'parâmetro',
  detail: 'detalhe',
}

function fieldText({ name, type, values, optional }: ListedField): string {
  const shown = type === 'enum' ? `enum(${(values ?? []).join('|')})` : type
  return `${name}${optional ? '?' : ''}: ${shown}`
}

function routeText({ route, routeKind, routePartial }: ListedPage): string {
  if (route === null) return 'nenhuma'
  if (routeKind === 'catchAll') return 'curinga'
  if (routeKind === 'expression') return `${route} (expressão)`
  return routePartial ? `${route} (parcial: o caminho de fora não é literal)` : route
}

function section(title: string, lines: string[]): string {
  return lines.length === 0
    ? `${title}: nenhum\n`
    : `${title} (${lines.length}):\n${lines.map((line) => `  ${line}`).join('\n')}\n`
}

/** O levantamento em texto: uma seção por tipo, uma linha por item; seção vazia diz "nenhum". */
export function formatListing(listing: ProjectListing): string {
  return [
    section(
      'Schemas',
      listing.schemas.map((schema) =>
        schema.fields
          ? `${schema.entity}  ${schema.file}  ${schema.fields.map(fieldText).join(', ') || 'sem campos'}`
          : `${schema.entity}  ${schema.file}  editado à mão (${schema.problem})`,
      ),
    ),
    section(
      'Repositórios',
      listing.repositories.map(
        (repository) =>
          `${repository.domain}  ${repository.entity ?? 'entidade desconhecida'}  fontes: ${repository.sources.join(', ') || 'nenhuma'}`,
      ),
    ),
    section(
      'Queries',
      listing.queries.map(
        (query) =>
          `${query.domain}  ${query.entity ?? 'entidade desconhecida'}  ${query.hooks.join(', ') || 'sem hooks'}`,
      ),
    ),
    section(
      'Telas',
      listing.pages.map(
        (page) =>
          `${page.name}  rota: ${routeText(page)}  ${VARIATION_LABELS[page.variation]}${page.query ? `  query: ${page.query}` : ''}`,
      ),
    ),
    section('Idiomas', listing.languages),
  ].join('\n')
}

/** `prumo list`: mostra o que o projeto tem, só lendo. Sai com 2 se a pasta não é um projeto. */
export const registerList: RegisterCommand = (program, io) => {
  const command = program
    .command('list')
    .summary('Mostra o que o projeto tem: schemas, repositórios, queries, telas e idiomas.')
    .description(
      'Mostra o que o projeto tem: schemas, repositórios, queries, telas e idiomas.\n\nSó lê os arquivos; com --json, escreve o levantamento em JSON para outras ferramentas.',
    )
    .option('--root <pasta>', ROOT_OPTION_DESCRIPTION)
    .option('--json', 'Escreve o levantamento em JSON.')
    .action((options: { root?: string; json?: boolean }) => {
      const project = locateProject(io.cwd, options.root)
      const listing = listProject(project)
      io.out(options.json ? `${JSON.stringify(listing, null, 2)}\n` : formatListing(listing))
    })
  documentCommand(command, {
    examples: [
      'prumo list',
      'prumo list --json',
    ],
    anchor: 'prumo-list',
    agentDetail:
      "Só lê os arquivos e nunca escreve. Devolve um JSON com as chaves schemas (entity, file, fields com name, type, optional e values; ou fields null e problem quando o schema foi editado à mão), repositories (domain, entity, sources: mock, http, storage), queries (domain, file, entity, hooks), pages (name, route, routeKind, routePartial, variation: title, list, param ou detail, e query) e languages (as pastas de src/messages). Chame antes de gerar: evita repetir um domínio e mostra qual camada falta.",
  })
}
