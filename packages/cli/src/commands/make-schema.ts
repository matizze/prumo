import { generateSchema } from '../generators/schema.ts'
import { UsageError } from '../errors.ts'
import { describeField } from '../lib/fields.ts'
import { entityFlag } from '../lib/names.ts'
import { locateProject, ROOT_OPTION_DESCRIPTION } from '../lib/project.ts'
import { formatSummary } from './summary.ts'
import { addExamples } from './help-text.ts'
import type { RegisterCommand } from './index.ts'

type MakeSchemaOptions = { entity?: string; fields?: string; root?: string; dryRun?: boolean }

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
  const command = program
    .command('make:schema')
    .summary('Cria o schema (zod) de uma entidade, com os campos.')
    .description(
        'Cria o schema (zod) de uma entidade, com os campos, e o registra em src/schemas/index.ts.\n\nNunca sobrescreve; --dry-run mostra o que faria.',
      )
    .argument('<domínio>', 'O nome do domínio, no plural e em kebab-case (por exemplo, clientes).')
    .option('--entity <singular>', 'A entidade, no singular (por exemplo, cliente). Padrão: o nome sem o s final.', nonEmpty('--entity'))
    .option(
      '--fields <campos>',
      'Os campos, nome:tipo separados por vírgula (por exemplo, "titulo:string,ano:int,apelido?:string"). Tipos: string, number, int, boolean, date, datetime, enum(a|b|c); ? torna opcional. Padrão: só name:string.',
    )
    .option('--root <pasta>', ROOT_OPTION_DESCRIPTION)
    .option('--dry-run', 'Só lista o que seria criado e alterado, sem escrever nada.')
    .action((name: string, options: MakeSchemaOptions) => {
      const project = locateProject(io.cwd, options.root)
      const { plan, names, fields } = generateSchema(project, {
        name,
        entity: options.entity,
        fields: options.fields,
      })
      const dryRun = options.dryRun === true
      const summary = dryRun ? plan.verify() : plan.commit()
      const heading = `prumo make:schema: ${names.plural.kebab} (entidade ${names.singular.kebab})${dryRun ? ' (simulação)' : ''}.`
      const entityLine =
        options.entity === undefined
          ? `Entidade: ${names.singular.kebab} (derivada de ${names.plural.kebab}; use --entity para trocar).`
          : `Entidade: ${names.singular.kebab} (--entity).`
      const fieldsLine = `Campos: ${fields.map(describeField).join(', ')}.`
      const ending = dryRun
        ? 'Simulação (--dry-run): nada foi escrito.\n'
        : `Próximo passo: prumo make:repository ${names.plural.kebab}${entityFlag(names)}\n`
      io.out(`${heading}\n${entityLine}\n${fieldsLine}\n\n${formatSummary(summary, dryRun)}\n${ending}`)
    })
  addExamples(
    command,
    [
      'prumo make:schema livros',
      'prumo make:schema livros --fields "titulo:string,ano:int,apelido?:string"',
      'prumo make:schema categories --entity category --dry-run',
    ],
    'prumo-makeschema',
  )
}
