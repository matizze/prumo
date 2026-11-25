import { generatePage } from '../generators/page.ts'
import { testCommandFor } from '../lib/pnpm.ts'
import { locateProject } from '../lib/project.ts'
import { documentCommand } from './help-text.ts'
import { DRY_RUN_ENDING, DRY_RUN_OPTION, formatWarnings, nonEmpty, ROOT_OPTION, runPlan } from './shared.ts'
import type { RegisterCommand } from './index.ts'

/** O que a tela de um use case é, no cabeçalho da saída. */
const USE_CASE_KIND_LABELS = { list: 'lista', detail: 'detalhe', form: 'formulário' } as const

type MakePageOptions = {
  usecase?: string
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
      'Cria uma tela nova: index, model, view, teste, mensagens e rota.\n\nSem --usecase, a tela só tem o título; com --usecase, lista, detalhe ou formulário de um use case.',
    )
    .argument('<nome>', 'O nome da tela, em kebab-case (por exemplo, clientes). Com ponto ou barra, vira subpasta (auth.login ou auth/login).')
    .option(
      '--usecase <domínio.ação>',
      'O use case que a tela usa (por exemplo, livros.list-livros): lista (leitura que devolve lista), detalhe (leitura com :id no endereço, com o mesmo parâmetro no --path) ou formulário (escrita).',
      nonEmpty('--usecase'),
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
      const { plan, names, useCase, route, warnings } = generatePage(project, {
        name,
        useCase: options.usecase,
        route: options.path,
      })
      const run = runPlan(plan, options)
      const heading = `prumo make:page: ${names.path} (rota ${route}${useCase ? `, use case ${useCase.model.names.domain.kebab}.${useCase.model.names.action.kebab}, ${USE_CASE_KIND_LABELS[useCase.kind]}` : ''})${run.mark}.`
      const ending = run.dryRun ? DRY_RUN_ENDING : `Edite o model (src/pages/${names.path}/model.ts), a view (view.tsx) e os textos (src/messages/<idioma>/${names.kebab}.json); o teste acompanha.\n\nPara rodar os testes da tela nova:\n  ${testCommandFor(project, io.cwd, `src/pages/${names.path}`)}\n`
      io.out(`${heading}\n\n${run.files}\n${formatWarnings(warnings)}${ending}`)
    })
  documentCommand(command, {
    examples: [
      'prumo make:page sobre',
      'prumo make:page livro-detalhe --usecase livros.get-livro --path /livros/:id',
      'prumo make:page livros --usecase livros.list-livros',
      'prumo make:page auth.login --usecase auth.sign-in',
    ],
    anchor: 'prumo-makepage',
    agentDetail:
      "Cria src/pages/<nome>/ com index.tsx (liga o model à view), model.ts (dados e textos, sem JSX), view.tsx (só tags nativas, recebe tudo por props) e index.test.tsx, as mensagens em src/messages/<idioma>/<nome>.json, o namespace nos índices de mensagens e a rota (padrão /<nome>) no src/App.tsx. O <nome> é o da tela, em kebab-case. Com ponto ou barra (auth.login ou auth/login, a mesma coisa), a tela fica numa subpasta (src/pages/auth/login/), a rota padrão é /auth/login, o componente é AuthLoginPage e as mensagens ficam em auth-login.json. Cada segmento é kebab-case, e só o nome junto não pode ser palavra reservada (auth.new passa). Uma tela não fica dentro de outra, uma pasta que agrupa telas não vira tela, e auth/login e auth-login não coexistem (dariam o mesmo arquivo de mensagens e o mesmo componente).\n\nSem usecase, a tela só tem o título.\n\nCom usecase=<domínio>.<ação> (por exemplo, livros.list-livros), a tela usa um use case que já existe (make_usecase): o model chama const { listLivros } = useUseCases() com useQuery (a chave é <ação>Key(input)) ou useMutation, e uma escrita invalida o prefixo do domínio no onSuccess. A tela depende do use case. Leitura que devolve uma lista (o Output é z.array(<entidade>Schema) ou pageSchema(<entidade>Schema)): lista com carregando, erro e vazio, com o primeiro campo de texto de cada registro. Leitura com :parâmetro no endereço (livros.get-livro, GET /livros/:id), com path com o mesmo parâmetro (/livros/:id): detalhe, que lê o parâmetro com o useParams do wouter e mostra o registro. Escrita: formulário com os campos do Input (lidos do .types.ts do use case), com inputs nativos, envio, botão desabilitado enquanto envia, o texto do erro (o UIError pelo errors.json) e um aviso de sucesso; o teste da tela envia o formulário contra o mock. Os textos entram nos dois idiomas. É erro de uso: use case que não existe, leitura que não devolve lista de entidade nem tem :parâmetro, path com parâmetro que o endereço não tem (ou o contrário), escrita com path com parâmetro, Input com campo obrigatório que a tela não preenche (lista e detalhe).\n\nCom path, a rota é a do caminho (por exemplo, /clientes/:id). O caminho começa com /, tem segmentos fixos e, no máximo, um parâmetro (:param, como :id; sem ?, * nem +), e não pode repetir nem conflitar com uma rota do App.tsx. Com parâmetro, o model lê o valor com o useParams do wouter e a view o mostra. Só com parâmetro (sem usecase), a tela mostra o valor lido da rota.\n\nValida tudo antes de escrever e nunca sobrescreve. São erro de uso: nome inválido ou reservado; tela que já existe; caminho inválido, repetido ou que conflita com uma rota; App.tsx ou índice de mensagens que falta. dry_run só lista. No fim, o resultado traz os avisos e o comando dos testes da tela.",
  })
}
