import { generatePage } from '../generators/page.ts'
import { testCommandFor } from '../lib/pnpm.ts'
import { locateProject } from '../lib/project.ts'
import { documentCommand } from './help-text.ts'
import { DRY_RUN_ENDING, DRY_RUN_OPTION, formatWarnings, nonEmpty, ROOT_OPTION, runPlan } from './shared.ts'
import type { RegisterCommand } from './index.ts'

type MakePageOptions = {
  query?: string
  path?: string
  root?: string
  dryRun?: boolean
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
    .argument('<nome>', 'O nome da tela, em kebab-case (por exemplo, clientes). Com ponto ou barra, vira subpasta (auth.login ou auth/login).')
    .option(
      '--query <domínio>',
      'O domínio cuja query a tela usa (por exemplo, clientes): lista, ou detalhe com um caminho com parâmetro. Padrão: nenhum.',
      nonEmpty('--query'),
    )
    .option(
      '--path <caminho>',
      'O caminho da rota, com um parâmetro opcional (por exemplo, /clientes/:id). Padrão: /<nome>, com a barra no lugar do ponto (/auth/login).',
      nonEmpty('--path'),
    )
    .option(...ROOT_OPTION)
    .option(...DRY_RUN_OPTION)
    .action((name: string, options: MakePageOptions) => {
      const project = locateProject(io.cwd, options.root)
      const { plan, names, query, route, warnings } = generatePage(project, {
        name,
        query: options.query,
        route: options.path,
      })
      const run = runPlan(plan, options)
      const heading = `prumo make:page: ${names.path} (rota ${route}${query ? `, query ${query.kebab}` : ''})${run.mark}.`
      const ending = run.dryRun ? DRY_RUN_ENDING : `Edite o model (src/pages/${names.path}/model.ts), a view (view.tsx) e os textos (src/messages/<idioma>/${names.kebab}.json); o teste acompanha.\n\nPara rodar os testes da tela nova:\n  ${testCommandFor(project, io.cwd, `src/pages/${names.path}`)}\n`
      io.out(`${heading}\n\n${run.files}\n${formatWarnings(warnings)}${ending}`)
    })
  documentCommand(command, {
    examples: [
      'prumo make:page sobre',
      'prumo make:page auth.login',
      'prumo make:page livros --query livros',
      'prumo make:page livro --query livros --path /livros/:id',
    ],
    anchor: 'prumo-makepage',
    agentDetail:
      "Cria src/pages/<nome>/ com index.tsx (liga o model à view), model.ts (dados e textos, sem JSX), view.tsx (só tags nativas, recebe tudo por props) e index.test.tsx, as mensagens em src/messages/<idioma>/<nome>.json, o namespace nos índices de mensagens e a rota (padrão /<nome>) no src/App.tsx. O <nome> é o da tela, em kebab-case. Com ponto ou barra (auth.login ou auth/login, a mesma coisa), a tela fica numa subpasta (src/pages/auth/login/), a rota padrão é /auth/login, o componente é AuthLoginPage e as mensagens ficam em auth-login.json. Cada segmento segue as regras de nome. Uma tela não fica dentro de outra, uma pasta que agrupa telas não vira tela, e auth/login e auth-login não coexistem (dariam o mesmo arquivo de mensagens e o mesmo componente).\n\nSem query, a tela só tem o título. Com query=<domínio>, o model lê a lista do domínio (use<Domínio>List, de @/queries, criado por make_query, que precisa existir antes) e a view mostra o carregando, o erro e a lista, com o primeiro campo de texto de cada registro; sem campo de texto, mostra o id e avisa.\n\nCom path, a rota é a do caminho (por exemplo, /clientes/:id). O caminho começa com /, tem segmentos fixos e, no máximo, um parâmetro (:param, como :id; sem ?, * nem +), e não pode repetir nem conflitar com uma rota do App.tsx. Com parâmetro, o model lê o valor com o useParams do wouter e a view o mostra. Com query e parâmetro, é a tela de detalhe: o model busca o registro com o use<Entidade>Detail do domínio. Só com parâmetro (sem query), a tela mostra o valor lido da rota.\n\nValida tudo antes de escrever e nunca sobrescreve. São erro de uso: nome inválido ou reservado; tela que já existe; caminho inválido, repetido ou que conflita com uma rota; query que falta (a dica é make_query); App.tsx ou índice de mensagens que falta. dry_run só lista. No fim, o resultado traz os avisos e o comando dos testes da tela.",
  })
}
