import path from 'node:path'
import { generateSchema } from '../generators/schema.ts'
import { UsageError } from '../errors.ts'
import { describeField } from '../lib/fields.ts'
import { entityFlag } from '../lib/names.ts'
import { findProject } from '../lib/project.ts'
import { formatSummary } from './summary.ts'
import type { RegisterCommand } from './index.ts'

type MakeSchemaOptions = { entity?: string; fields?: string; root: string; dryRun?: boolean }

/** Recusa a opção dada sem valor (`--fields ''`): o commander a aceita, o schema sairia sem campos. */
function nonEmpty(option: string) {
  return (value: string): string => {
    if (value.trim() === '') throw new UsageError(`a opção '${option}' precisa de um valor.`)
    return value
  }
}

/**
 * `prumo make:schema <domínio>`: cria o schema da entidade (`src/schemas/entities/<entidade>.ts`,
 * com os campos do `--fields`) e o registra em `src/schemas/index.ts`. O gerador valida tudo e
 * monta o plano antes de escrever, então um erro de uso (saída 2) não deixa nada pela metade;
 * `--dry-run` só mostra o plano.
 */
export const registerMakeSchema: RegisterCommand = (program, io) => {
  program
    .command('make:schema')
    .summary('Cria o schema (zod) de uma entidade, com os campos.')
    .description(
      `Cria o schema (zod) de uma entidade, com os campos.

Cria src/schemas/entities/<entidade>.ts, com o schema da entidade (id, os campos e createdAt), o schema de entrada (o que se envia para criar ou editar), os tipos, a chave de ordem e o tipo da consulta de lista, e acrescenta o export em src/schemas/index.ts.

O <domínio> é o nome do domínio, no plural e em kebab-case (clientes, pedidos-recentes). A entidade é o singular, que sai do nome (tira o s final). Onde a regra erra (o plural termina em ies, us, ss, xes, ches, shes ou sses), o comando recusa e pede a entidade com --entity: categories daria categorie, e o certo é --entity category.

Os campos vêm de --fields, nome:tipo separados por vírgula ("titulo:string,ano:int,situacao:enum(lido|lendo),apelido?:string"). O nome é camelCase; os tipos são string, number, int (inteiro), boolean, date (AAAA-MM-DD), datetime (ISO com hora) e enum(a|b|c) (dois valores ou mais, identificadores simples); um ? depois do nome torna o campo opcional. Os nomes id e createdAt são reservados, e um nome repetido é recusado. Sem --fields, a entidade tem só o campo name, de texto.

Valida tudo antes de escrever (nome, entidade, campos, schema que já existe e o índice) e nunca sobrescreve: erro de uso sai com 2, sem deixar nada pela metade. --dry-run lista o que seria criado e alterado, sem escrever.`,
    )
    .argument('<domínio>', 'O nome do domínio, no plural e em kebab-case (por exemplo, clientes).')
    .option('--entity <singular>', 'A entidade, no singular (por exemplo, cliente). Padrão: o nome sem o s final.', nonEmpty('--entity'))
    .option(
      '--fields <campos>',
      'Os campos, nome:tipo separados por vírgula (por exemplo, "titulo:string,ano:int,apelido?:string"). Tipos: string, number, int, boolean, date, datetime, enum(a|b|c); ? torna opcional. Padrão: só name:string.',
    )
    .option('--root <pasta>', 'A pasta do projeto, a que tem o src.', '.')
    .option('--dry-run', 'Só lista o que seria criado e alterado, sem escrever nada.')
    .action((name: string, options: MakeSchemaOptions) => {
      if (options.root === '') throw new UsageError("a opção '--root' precisa de um valor.")
      const project = findProject(path.resolve(io.cwd, options.root))
      const { plan, names, fields } = generateSchema(project, {
        name,
        entity: options.entity,
        fields: options.fields,
      })
      const dryRun = options.dryRun === true
      const summary = dryRun ? plan.summary() : plan.commit()
      const heading = `prumo make:schema: ${names.plural.kebab} (entidade ${names.singular.kebab})${dryRun ? ' (simulação)' : ''}.`
      const derived = options.entity === undefined
      const entityLine = derived
        ? `Entidade: ${names.singular.kebab}, derivada do nome (tira o s final; o português tem exceções, como -ores, -oes, -aes e -ens). Use --entity <singular> para trocá-la.`
        : `Entidade: ${names.singular.kebab} (--entity).`
      const fieldsLine = `Campos: ${fields.map(describeField).join(', ')}.`
      const ending = dryRun
        ? 'Simulação (--dry-run): nada foi escrito.\n'
        : `Próximo passo: prumo make:repository ${names.plural.kebab}${entityFlag(names)}\n`
      io.out(`${heading}\n${entityLine}\n${fieldsLine}\n\n${formatSummary(summary, dryRun)}\n${ending}`)
    })
}
