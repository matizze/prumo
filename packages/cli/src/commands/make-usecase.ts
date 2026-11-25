import { generateUseCase, READ_VERBS } from '../generators/usecase.ts'
import { generateCrudUseCases } from '../generators/usecase-crud.ts'
import { UsageError } from '../errors.ts'
import { describeField } from '../lib/fields/index.ts'
import { locateProject } from '../lib/project.ts'
import { documentCommand } from './help-text.ts'
import { DRY_RUN_ENDING, DRY_RUN_OPTION, formatWarnings, nonEmpty, ROOT_OPTION, runPlan } from './shared.ts'
import type { RegisterCommand } from './index.ts'

type MakeUseCaseOptions = {
  input?: string
  output?: string
  endpoint?: string
  read?: boolean
  write?: boolean
  local?: boolean
  crud?: boolean
  entity?: string
  root?: string
  dryRun?: boolean
}

const KIND_LABELS = { read: 'leitura', write: 'escrita', local: 'local' } as const

/** As opções que descrevem um use case só e não valem com `--crud`, que gera os cinco com o que o schema diz. */
const SINGLE_OPTIONS = ['input', 'output', 'endpoint', 'read', 'write', 'local'] as const

/**
 * `prumo make:usecase <domínio>.<ação>`: cria um use case em `src/use-cases/<domínio>/` (tipos, classe,
 * rota de mock e teste) e o registra no índice do domínio e no registro geral. O gerador valida tudo
 * e monta o plano antes de escrever, então um erro de uso (saída 2) não deixa nada pela metade;
 * `--dry-run` só mostra o plano.
 */
export const registerMakeUseCase: RegisterCommand = (program, io) => {
  const command = program
    .command('make:usecase')
    .summary('Cria um use case (uma ação do app: tipos, classe, mock e teste) e o registra.')
    .description(
      `Cria um use case: uma ação com nome de verbo (get-stores, sign-in), um Input e um Output validados com zod e um execute.\n\nLeitura (${READ_VERBS.join(', ')} no começo da ação) ou escrita (o resto); --read e --write forçam. Com --local, o use case não chama a API e usa o localStorage. Com --crud, gera os cinco use cases do CRUD de uma entidade.`,
    )
    .argument('<nome>', 'O domínio e a ação, em kebab-case, separados por ponto ou barra (por exemplo, auth.sign-in ou stores/get-stores). Com --crud, só o domínio, no plural (livros).')
    .option(
      '--input <campos>',
      'Os campos do Input, como no --fields do make:schema (por exemplo, "email:string,password:string"). Padrão: objeto vazio.',
      nonEmpty('--input'),
    )
    .option(
      '--output <campos>',
      'Os campos do Output (como no --fields), ou o nome de uma entidade que já tem schema (store, ou store[] para a lista). Padrão: unknown.',
      nonEmpty('--output'),
    )
    .option(
      '--endpoint <método caminho>',
      'O endereço da API, como "PATCH /livros/:id": cada :parâmetro sai do campo do Input de mesmo nome. Padrão: GET /<domínio>/<ação> na leitura e POST /<domínio>/<ação> na escrita.',
      nonEmpty('--endpoint'),
    )
    .option('--read', 'Trata como leitura (o Input vai na query), mesmo que o verbo da ação não seja de leitura.')
    .option('--write', 'Trata como escrita (o Input vai no corpo), mesmo que o verbo da ação seja de leitura.')
    .option('--local', 'Use case sem API: recebe o storage (localStorage), sem ENDPOINT nem mock.')
    .option(
      '--crud',
      'Gera os cinco use cases do CRUD de uma entidade (list, get, create, update e remove), com mock e testes. O nome é o domínio, no plural (livros), e o schema precisa existir.',
    )
    .option(
      '--entity <singular>',
      'Com --crud, a entidade, no singular (por exemplo, livro). Padrão: o nome sem o s final. A mesma do make:schema.',
      nonEmpty('--entity'),
    )
    .option(...ROOT_OPTION)
    .option(...DRY_RUN_OPTION)
    .action((name: string, options: MakeUseCaseOptions) => {
      const project = locateProject(io.cwd, options.root)
      if (options.crud) return makeCrud(name, options, project)
      if (options.entity !== undefined) throw new UsageError("'--entity' só vale com '--crud'.")
      const { plan, names, access, kind, endpoint, key, warnings } = generateUseCase(project, { name, ...options })
      const run = runPlan(plan, options)
      const where = endpoint ? `${KIND_LABELS[kind]}, ${endpoint.method} ${endpoint.path}` : KIND_LABELS[kind]
      const heading = `prumo make:usecase: ${names.domain.kebab}.${names.action.kebab} (${where})${run.mark}.`
      const use =
        access === 'read'
          ? `useQuery({ queryKey: ${key}Key(input), queryFn: () => ${key}.execute(input) })`
          : `useMutation({ mutationFn: (input) => ${key}.execute(input) })`
      const ending = run.dryRun
        ? DRY_RUN_ENDING
        : `Próximo passo: no model da tela, const { ${key} } = useUseCases() e ${use}.\n`
      io.out(`${heading}\n\n${run.files}\n${formatWarnings(warnings)}${ending}`)
    })
  /** `--crud`: os cinco use cases do domínio, num plano só. */
  function makeCrud(name: string, options: MakeUseCaseOptions, project: ReturnType<typeof locateProject>) {
    const used = SINGLE_OPTIONS.filter((option) => options[option] !== undefined)
    if (used.length > 0) {
      throw new UsageError(`'--crud' gera os cinco use cases a partir do schema: tire ${used.map((option) => `'--${option}'`).join(', ')}.`)
    }
    const { plan, names, fields, useCases, warnings } = generateCrudUseCases(project, { name, entity: options.entity })
    const run = runPlan(plan, options)
    const heading = `prumo make:usecase: ${names.plural.kebab} --crud (entidade ${names.singular.kebab})${run.mark}.`
    const list = useCases.map(({ key, endpoint }) => `  ${key}  ${endpoint.method} ${endpoint.path}`).join('\n')
    const keys = useCases.map(({ key }) => key).join(', ')
    const ending = run.dryRun
      ? DRY_RUN_ENDING
      : `Próximo passo: prumo make:page ${names.plural.kebab} --usecase ${names.plural.kebab}.${useCases[0]!.names.action.kebab}\n`
    io.out(`${heading}\nCampos (lidos do schema): ${fields.map(describeField).join(', ')}.\nUse cases (${keys}):\n${list}\n\n${run.files}\n${formatWarnings(warnings)}${ending}`)
  }
  documentCommand(command, {
    examples: [
      'prumo make:usecase livros --crud',
      'prumo make:usecase stores.get-stores --output store[]',
      'prumo make:usecase auth.sign-in --input "email:string,password:string" --output "token:string"',
      'prumo make:usecase livros.update-livro --endpoint "PATCH /livros/:id" --input "id:string,title?:string"',
      'prumo make:usecase cart.add-item --local --input "productId:string,quantity:int"',
    ],
    anchor: 'prumo-makeusecase',
    agentDetail: [
      "O nome é <domínio>.<ação> (ou <domínio>/<ação>), em kebab-case: stores.get-stores, auth.sign-in. O domínio dá a pasta em src/use-cases, e a ação dá a classe (GetStoresUseCase) e a chave no registro (getStores, que a tela lê de useUseCases()). As chaves são únicas no app: o comando recusa uma ação que repete a chave de outro domínio (stores.get-stores e orders.get-stores). Chame list antes de gerar.",
      "Leitura ou escrita, pelo verbo no começo da ação: get, list, search, find, check e count são leitura (a tela usa com useQuery); o resto é escrita (useMutation). read ou write forçam o tipo.",
      "Cria src/use-cases/<domínio>/<ação>.types.ts (o ENDPOINT { method, path }; o Input e o Output em zod, cada um com o tipo de mesmo nome; na leitura, a chave de cache <ação>Key(input), com o domínio no prefixo), <ação>.usecase.ts (a classe, que implementa IUseCase e recebe o http no construtor: o execute valida o Input, chama a API e valida a resposta com o Output; um erro da API vira UIError com o código <AÇÃO>_FAILED), <ação>.mock.ts (a rota de mock do ENDPOINT, com uma resposta de exemplo no formato do Output) e <ação>.usecase.test.ts (roda contra o mock e, com API_TEST_URL, contra a API real). Registra o use case no índice do domínio (index.ts, criado com o primeiro use case dele) e no registro geral src/use-cases/index.ts, e acrescenta o texto de <AÇÃO>_FAILED ao errors.json de cada idioma. O app precisa ter src/use-cases/index.ts (o prumo new cria).",
      "input e output usam a sintaxe do fields do make_schema (\"email:string,password:string\"; tipos string, number, int, boolean, date, datetime e enum(a|b|c); ? depois do nome torna o campo opcional), e aceitam id e createdAt. O output aceita também o nome de uma entidade que já tem schema (make_schema): output store usa o storeSchema, e output store[] uma lista dele. Sem input, o Input é z.object({}); sem output, o Output é z.unknown(), porque a API real pode devolver corpo. O comando avisa, sem falhar, para preencher o que ficou no padrão em <ação>.types.ts.",
      "O endereço padrão é GET /<domínio>/<ação> na leitura (o Input vai como query) e POST /<domínio>/<ação> na escrita (o Input vai como corpo). endpoint troca o padrão, no formato \"<MÉTODO> <caminho>\" (GET, POST, PUT, PATCH ou DELETE; o caminho começa com / e não leva ? nem #), como \"PATCH /livros/:id\". Cada :parâmetro do caminho sai do campo do Input de mesmo nome (obrigatório, e declarado em input: \"id:string,title?:string\"), é codificado com encodeURIComponent e não vai na query nem no corpo; o comando recusa um endpoint cujo :parâmetro não está no Input, é opcional, é palavra reservada ou não é string, number, int, boolean ou enum. Uma escrita não pode usar GET.",
      "Com local, o use case não chama a API: a classe recebe o storage (o localStorage, nas dependências do registro), e não há ENDPOINT, rota de mock nem endpoint. O execute valida o Input, deixa a regra marcada num comentário (o exemplo guarda o Input no storage, ou lê dele na leitura) e devolve o Output validado; o teste roda com o localStorage do jsdom. Não combina com endpoint.",
      "Com crud, o nome é só o domínio, no plural (livros), e o comando gera os cinco use cases do CRUD de uma entidade: listLivros (GET /livros, Input <Entidade>ListQuery com search, sort, page e page_size, Output Page do schema), getLivro (GET /livros/:id), createLivro (POST /livros, Input <Entidade>Input), updateLivro (PATCH /livros/:id, o id e o Partial do Input) e removeLivro (DELETE /livros/:id). O 404 de um registro vira UIError <ENTIDADE>_NOT_FOUND. Precisa do schema (make_schema), de onde saem os campos (o entity informa o singular, como no make_schema). Os mocks dos cinco dividem uma coleção em memória com as fixtures do domínio (src/use-cases/<domínio>/collection.mock.ts), então criar e depois listar mostra o item novo, e os testes dos cinco cobrem lista, busca, ordem, página, busca por id, criação, edição e remoção, contra o mock e, com API_TEST_URL, contra a API. Acrescenta <ENTIDADE>_NOT_FOUND e os cinco _FAILED ao errors.json de cada idioma. Não combina com input, output, endpoint, read, write nem local. Recusa quando algum dos cinco já existe, dizendo qual. Depois, a tela: make_page com usecase=livros.list-livros (lista), usecase=livros.get-livro com path /livros/:id (detalhe) ou usecase=livros.create-livro (formulário).",
      "Valida tudo antes de escrever e nunca sobrescreve: use case que já existe, chave repetida, nome sem domínio ou sem ação, entidade sem schema ou endpoint inválido saem como erro de uso, sem deixar nada pela metade. dry_run só lista. Na tela, o model usa o use case: const { getStores } = useUseCases() com useQuery({ queryKey: getStoresKey(input), queryFn: () => getStores.execute(input) }) na leitura, ou useMutation({ mutationFn: (input) => signIn.execute(input) }) na escrita.",
    ].join('\n\n'),
  })
}
