import path from 'node:path'
import { UsageError } from '../errors.ts'
import { listProject, type ListedField, type ProjectListing } from '../generators/listing.ts'
import { findProject } from '../lib/project.ts'
import type { RegisterCommand } from './index.ts'

function fieldText({ name, type, values, optional }: ListedField): string {
  const shown = type === 'enum' ? `enum(${(values ?? []).join('|')})` : type
  return `${name}${optional ? '?' : ''}: ${shown}`
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
          `${page.name}  rota: ${page.route ?? 'nenhuma'}  ${page.variation}${page.query ? `  query: ${page.query}` : ''}`,
      ),
    ),
    section('Idiomas', listing.languages),
  ].join('\n')
}

/** `prumo list`: mostra o que o projeto tem, só lendo. Sai com 2 se a pasta não é um projeto. */
export const registerList: RegisterCommand = (program, io) => {
  program
    .command('list')
    .summary('Mostra o que o projeto tem: schemas, repositórios, queries, telas e idiomas.')
    .description(
      `Mostra o que o projeto tem: schemas, repositórios, queries, telas e idiomas.

Só lê os arquivos e nunca escreve. Para cada schema, mostra a entidade, o arquivo e os campos que o Prumo reconhece (ou "editado à mão", com o motivo, quando não reconhece); para cada repositório, o domínio, a entidade e as fontes (mock, http, storage); para cada query, o domínio, a entidade e os hooks; para cada tela, a rota do App.tsx, a variação (titulo, lista, parametro ou detalhe) e a query que usa; e os idiomas de src/messages.

Com --json, escreve um objeto com as chaves schemas, repositories, queries, pages e languages, para outras ferramentas lerem.

Sai com 2 quando a pasta não é um projeto (sem package.json e src).`,
    )
    .option('--root <pasta>', 'A pasta do projeto, a que tem o src.', '.')
    .option('--json', 'Escreve o levantamento em JSON.')
    .action((options: { root: string; json?: boolean }) => {
      if (options.root === '') throw new UsageError("a opção '--root' precisa de um valor.")
      const project = findProject(path.resolve(io.cwd, options.root))
      const listing = listProject(project)
      io.out(options.json ? `${JSON.stringify(listing, null, 2)}\n` : formatListing(listing))
    })
}
