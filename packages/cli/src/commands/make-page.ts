import { UsageError } from '../errors.ts'
import { generatePage } from '../generators/page.ts'
import { testCommandFor } from '../lib/pnpm.ts'
import { locateProject, ROOT_OPTION_DESCRIPTION } from '../lib/project.ts'
import { formatSummary } from './summary.ts'
import { addExamples } from './help-text.ts'
import type { RegisterCommand } from './index.ts'

type MakePageOptions = {
  query?: string
  path?: string
  root?: string
  dryRun?: boolean
}

/** Recusa a opção dada sem valor (`--query ''`): o commander a aceita. */
function nonEmpty(option: string) {
  return (value: string): string => {
    if (value.trim() === '') throw new UsageError(`a opção '${option}' precisa de um valor.`)
    return value
  }
}

/**
 * `prumo make:page <nome>`: cria uma tela (`index`, `model`, `view` e o teste), as mensagens nos
 * idiomas do projeto, o namespace nos índices de mensagens e a rota no `src/App.tsx`. O gerador
 * valida tudo e monta o plano antes de escrever, então um erro de uso (saída 2) não deixa nada pela
 * metade; `--dry-run` só mostra o plano.
 */
export const registerMakePage: RegisterCommand = (program, io) => {
  const command = program
    .command('make:page')
    .summary('Cria uma tela: index, model, view, teste, mensagens e rota.')
    .description(
        'Cria uma tela nova: index, model, view, teste, mensagens e rota.\n\nSem --query, a tela só tem o título; com --query, lista ou detalhe do domínio.',
      )
    .argument('<nome>', 'O nome da tela, em kebab-case (por exemplo, clientes).')
    .option(
      '--query <domínio>',
      'O domínio cuja query a tela usa (por exemplo, clientes): lista, ou detalhe com um caminho com parâmetro. Padrão: nenhum.',
      nonEmpty('--query'),
    )
    .option(
      '--path <caminho>',
      'O caminho da rota, com um parâmetro opcional (por exemplo, /clientes/:id). Padrão: /<nome>.',
      nonEmpty('--path'),
    )
    .option('--root <pasta>', ROOT_OPTION_DESCRIPTION)
    .option('--dry-run', 'Só lista o que seria criado e alterado, sem escrever nada.')
    .action((name: string, options: MakePageOptions) => {
      const project = locateProject(io.cwd, options.root)
      const { plan, names, query, route, warnings } = generatePage(project, {
        name,
        query: options.query,
        route: options.path,
      })
      const dryRun = options.dryRun === true
      const summary = dryRun ? plan.verify() : plan.commit()
      const heading = `prumo make:page: ${names.kebab} (rota ${route}${query ? `, query ${query.kebab}` : ''})${dryRun ? ' (simulação)' : ''}.`
      const warningLines = warnings.map((warning) => `Aviso: ${warning}\n`).join('')
      const warningText = warningLines === '' ? '' : `${warningLines}\n`
      const ending = dryRun
        ? 'Simulação (--dry-run): nada foi escrito.\n'
        : `Edite o model (src/pages/${names.kebab}/model.ts), a view (view.tsx) e os textos (src/messages/<idioma>/${names.kebab}.json); o teste acompanha.\n\nPara rodar os testes da tela nova:\n  ${testCommandFor(project, io.cwd, `src/pages/${names.kebab}`)}\n`
      io.out(`${heading}\n\n${formatSummary(summary, dryRun)}\n${warningText}${ending}`)
    })
  addExamples(
    command,
    [
      'prumo make:page sobre',
      'prumo make:page livros --query livros',
      'prumo make:page livro --query livros --path /livros/:id',
      'prumo make:page livros --query livros --dry-run',
    ],
    'prumo-makepage',
  )
}
