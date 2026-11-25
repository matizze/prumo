# Primeiros passos

Neste tutorial você cria um app com o Prumo, gera as camadas de um domínio de dados (schema e use cases), uma tela que lista os registros e um formulário que cria um, muda os textos, cria um componente à mão e vê a verificação da arquitetura em ação. No fim, você terá passado por todas as camadas que o Prumo organiza: **telas → use cases → http e schemas**.

Tempo estimado: 20 minutos.

## Antes de começar

Você precisa do **Node.js 24** ou mais novo e do **pnpm 10** ou mais novo:

```bash
node --version   # v24.x ou mais novo
pnpm --version   # 10.x ou mais novo
```

Se o pnpm não estiver instalado: `npm install -g pnpm` (no Node 24, também dá para usar o Corepack, que vem com ele: `corepack enable`).

## 1. Crie o app

```bash
pnpm dlx @matizze/prumo-cli new loja
```

O comando cria a pasta `loja`, roda `git init` (sem commit: o primeiro commit é seu) e `pnpm install`. A saída lista os arquivos criados, mostra o andamento do `pnpm install` e termina com os próximos passos:

```text
prumo new: loja.
Destino: /home/voce/loja

Criados (33):
  .gitignore
  .mcp.json
  AGENTS.md
  README.md
  eslint.config.js
  ...
  src/pages/home/index.tsx
  src/pages/home/model.ts
  src/pages/home/view.tsx
  ...

Pacotes do Prumo: do registry, pela versão (^<versão>) no package.json.

Instalando as dependências (pnpm install)...
...

Próximos passos:
  cd loja
  pnpm verify                                   # typecheck, lint, test e check
  pnpm dev                                      # o app em http://localhost:5173
  pnpm exec prumo make:page <tela>              # uma tela, com a rota e as mensagens

A documentação (tutorial, conceitos e guias): https://docs.prumo.matizze.com.br
```

> Para ver o que seria criado sem escrever nada, use `--dry-run`. Para escolher outra pasta, `--dir <pasta>`. Todas as opções estão na [referência da CLI](reference/cli.md).

Entre na pasta e suba o app:

```bash
cd loja
pnpm dev
```

Em `http://localhost:5173` aparece a tela inicial, com o título "Home". Ela não tem estilo nenhum, e é de propósito: o Prumo não traz CSS nem design system. A interface é do seu produto (veja o guia [Design system](guides/design-system.md)).

## 2. Conheça o que foi criado

```text
loja/
  src/
    App.tsx              as rotas (wouter)
    main.tsx             monta o app com os provedores
    i18n.ts              o i18n tipado pelas mensagens
    pages/home/          a tela inicial: index, model, view e o teste
    messages/pt-BR/      os textos em português (um JSON por tela)
    messages/en/         os textos em inglês
    providers/           TanStack Query, i18n e use cases
    http/                a instância da API (createHttp), a camada de baixo
    use-cases/           o registro dos use cases e as rotas de mock (vazio por enquanto)
    schemas/             o índice dos schemas (vazio por enquanto)
    test/                o renderWithProviders e o setup do Vitest
  AGENTS.md              o guia do projeto para agentes de IA
  eslint.config.js       com o plugin de arquitetura do Prumo
```

Abra a tela inicial. Ela tem três arquivos, e cada um tem um papel:

```tsx
// src/pages/home/index.tsx: liga o model à view
export default function HomePage() {
  const model = useHomeModel()
  return <HomeView {...model} />
}
```

```ts
// src/pages/home/model.ts: dados e textos, sem JSX
export function useHomeModel() {
  const t = useTranslations('home')
  return { title: t('title') }
}

export type HomeModel = ReturnType<typeof useHomeModel>
```

```tsx
// src/pages/home/view.tsx: apresentação, recebe tudo por props
export function HomeView(m: HomeModel) {
  return (
    <main>
      <h1>{m.title}</h1>
    </main>
  )
}
```

Essa separação é o centro da arquitetura: a view pode ser trocada inteira (por outra biblioteca visual, por exemplo) sem tocar nos dados, e o model pode ser testado sem se preocupar com o visual. O detalhe de cada arquivo está em [Anatomia do app gerado](concepts/generated-app.md).

## 3. Rode a verificação

```bash
pnpm verify
```

O `verify` roda, em sequência, o `tsc`, o ESLint (com as regras do Prumo), os testes do Vitest e, por último, o `prumo check` (a análise da arquitetura do projeto inteiro). Os testes vêm antes do `check` para que uma violação dele não os esconda, mas o `verify` continua falhando se o `check` falhar. Nada disso precisa de navegador. Use-o antes de dar qualquer tarefa por pronta.

## 4. Gere um domínio de dados

Um domínio é um conjunto de dados do produto: clientes, pedidos, produtos. Cada camada dele tem o seu comando, e a ordem vai de baixo para cima: o schema e os use cases. Comece pelo schema de clientes, com os campos do produto:

```bash
pnpm exec prumo make:schema clientes --fields "nome:string,email:string,ativo:boolean,plano:enum(basico|pro),telefone?:string"
```

```text
prumo make:schema: clientes (entidade cliente).
Entidade: cliente (derivada de clientes; use --entity para trocar).
Campos: nome (string), email (string), ativo (boolean), plano (enum(basico|pro)), telefone (string, opcional).

Criados (1):
  src/schemas/entities/cliente.ts

Alterados (1):
  src/schemas/index.ts

Próximo passo: prumo make:usecase clientes --crud
```

O nome do domínio vai no plural; a entidade (`cliente`) sai dele, tirando o `s` (quando a regra erra, o `--entity` informa o singular). Os campos são `nome:tipo` separados por vírgula, e o `?` torna o campo opcional (todos os tipos estão em [Use cases](guides/use-cases.md#os-campos-do-schema---fields)). Sem `--fields`, a entidade tem só o campo `name`. O schema zod tem o `id`, os campos e o `createdAt`, mais os tipos de entrada e de consulta.

Agora os use cases. O que o app faz com os clientes (listar, ler, criar, editar e remover) são cinco ações, e o `--crud` as gera de uma vez. Elas leem os campos do schema que acabou de nascer, então não precisam de `--fields`:

```bash
pnpm exec prumo make:usecase clientes --crud
```

```text
prumo make:usecase: clientes --crud (entidade cliente).
Campos (lidos do schema): nome (string), email (string), ativo (boolean), plano (enum(basico|pro)), telefone (string, opcional).
Use cases (listClientes, getCliente, createCliente, updateCliente, removeCliente):
  listClientes  GET /clientes
  getCliente  GET /clientes/:id
  createCliente  POST /clientes
  updateCliente  PATCH /clientes/:id
  removeCliente  DELETE /clientes/:id

Criados (22):
  src/use-cases/clientes/collection.mock.ts
  src/use-cases/clientes/create-cliente.mock.ts
  ...

Alterados (3):
  src/messages/en/errors.json
  src/messages/pt-BR/errors.json
  src/use-cases/index.ts

Próximo passo: prumo make:page clientes --usecase clientes.list-clientes
```

O comando criou, para cada ação, os quatro arquivos de um use case:

- os **tipos** (`.types.ts`): o endereço (`ENDPOINT`), o Input e o Output em zod e, na leitura, a chave de cache;
- a **classe** (`.usecase.ts`), com o `execute`, que valida o Input, chama a API e valida o Output;
- o **mock** (`.mock.ts`): a resposta de mentira do endereço, sobre uma coleção em memória com três registros de exemplo (as fixtures);
- o **teste** (`.usecase.test.ts`), que roda o contrato contra o mock;

e registrou o domínio no registro de use cases e o texto de `CLIENTE_NOT_FOUND` nos `errors.json`. Rode os testes deles:

```bash
pnpm test src/use-cases/clientes
```

Abra o `list-clientes.usecase.ts` para ver o que é um use case: uma classe com um `execute`, que valida o Input, chama o `http`, valida o Output com zod e traduz o erro da API num `UIError` com código (que a interface traduz para a pessoa):

```ts
// src/use-cases/clientes/list-clientes.usecase.ts
export class ListClientesUseCase implements IUseCase<ListClientesInput, ListClientesOutput> {
  readonly #http: Http

  constructor(http: Http) {
    this.#http = http
  }

  /** Um erro da API vira `UIError` LIST_CLIENTES_FAILED. */
  async execute(input: ListClientesInput): Promise<ListClientesOutput> {
    const { sort, ...rest } = ListClientesInput.parse(input)
    const query = { ...rest, sort: sort && `${sort.key}:${sort.direction}` }
    try {
      const response = await this.#http(ENDPOINT.path, { method: ENDPOINT.method, query })
      return ListClientesOutput.parse(response)
    } catch (error) {
      if (error instanceof HttpError) throw new UIError('LIST_CLIENTES_FAILED', error.message)
      throw error
    }
  }
}
```

O mock vale enquanto a API não existe: o código dos use cases é o mesmo, e só a rede é de mentira. Quando a API existir, `VITE_DATA_SOURCE=http` liga os use cases a ela e o resto do app não muda. O guia [Ligar uma API real](guides/real-api.md) mostra como.

## 5. Gere uma tela que lista o domínio

```bash
pnpm exec prumo make:page clientes --usecase clientes.list-clientes
```

```text
prumo make:page: clientes (rota /clientes, use case clientes.list-clientes, lista).

Criados (6):
  src/messages/en/clientes.json
  src/messages/pt-BR/clientes.json
  src/pages/clientes/index.test.tsx
  src/pages/clientes/index.tsx
  src/pages/clientes/model.ts
  src/pages/clientes/view.tsx

Alterados (3):
  src/App.tsx
  src/messages/en/index.ts
  src/messages/pt-BR/index.ts

Edite o model (src/pages/clientes/model.ts), a view (view.tsx) e os textos (src/messages/<idioma>/clientes.json); o teste acompanha.

Para rodar os testes da tela nova:
  pnpm test src/pages/clientes
```

Com o `pnpm dev` rodando, abra `http://localhost:5173/clientes`: aparece "Carregando…" por um instante (a latência simulada do mock) e depois a lista com os três exemplos. A view mostra o primeiro campo de texto do schema (aqui, o `nome`); com `--usecase clientes.get-cliente --path /clientes/:id`, o `make:page` gera a tela de detalhe do registro, e com um use case de escrita (`clientes.create-cliente`), o formulário.

Veja o model que o comando gerou. Ele chama o use case de listar pelo `useQuery` e entrega à view só o que ela precisa:

```ts
// src/pages/clientes/model.ts
export function useClientesModel() {
  const t = useTranslations('clientes')
  const { listClientes } = useUseCases()
  const input = {}
  const list = useQuery({ queryKey: listClientesKey(input), queryFn: () => listClientes.execute(input) })
  return {
    title: t('title'),
    loadingText: t('loading'),
    failedText: t('failed'),
    items: list.data?.items ?? [],
    loading: list.isPending,
    failed: list.isError,
  }
}
```

## 6. Gere um formulário que cria um cliente

Um use case de escrita vira um formulário. Gere a tela de "cliente novo" a partir do `clientes.create-cliente`, com a rota `/clientes/novo`:

```bash
pnpm exec prumo make:page cliente-novo --usecase clientes.create-cliente --path /clientes/novo
```

```text
prumo make:page: cliente-novo (rota /clientes/novo, use case clientes.create-cliente, formulário).

Criados (6):
  src/messages/en/cliente-novo.json
  src/messages/pt-BR/cliente-novo.json
  src/pages/cliente-novo/index.test.tsx
  src/pages/cliente-novo/index.tsx
  src/pages/cliente-novo/model.ts
  src/pages/cliente-novo/view.tsx

Alterados (3):
  src/App.tsx
  src/messages/en/index.ts
  src/messages/pt-BR/index.ts

Edite o model (src/pages/cliente-novo/model.ts), a view (view.tsx) e os textos (src/messages/<idioma>/cliente-novo.json); o teste acompanha.

Para rodar os testes da tela nova:
  pnpm test src/pages/cliente-novo
```

O formulário sai com um campo por campo do Input do use case (`nome`, `email`, um checkbox para `ativo`, um `<select>` para `plano` e `telefone`, sem `required` porque é opcional), só com elementos nativos. O model usa o `useMutation` com o `createCliente`, desabilita o botão enquanto envia, mostra o erro traduzido e, no sucesso, invalida as consultas do domínio (`['clientes']`):

```ts
// src/pages/cliente-novo/model.ts (trecho)
const { createCliente } = useUseCases()
const mutation = useMutation({
  mutationFn: (input: CreateClienteInput) => createCliente.execute(input),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
})
```

Com o `pnpm dev`, abra `http://localhost:5173/clientes/novo`, envie o formulário e volte para `/clientes`: o cliente novo está na lista, porque os mocks dos cinco use cases dividem uma coleção em memória (ela volta ao começo quando a página recarrega). O teste da tela preenche os campos e envia o formulário contra o mock; rode-o com `pnpm test src/pages/cliente-novo`.

## 7. Mude os textos e veja a verificação agir

Os textos da tela moram em `src/messages/<idioma>/clientes.json`. Acrescente um texto novo, **só em português** por enquanto:

```json
// src/messages/pt-BR/clientes.json
{
  "title": "Clientes",
  "loading": "Carregando…",
  "failed": "Não foi possível carregar a lista.",
  "empty": "Nada por aqui ainda.",
  "subtitle": "Os clientes da loja."
}
```

Rode a análise da arquitetura:

```bash
pnpm check
```

```text
src/messages/en/clientes.json  [messages]  A chave 'clientes.subtitle' existe em 'pt-BR' e falta em 'en'.

prumo check: 1 violação.
```

O `prumo check` compara os idiomas e acusa o texto que falta. Acrescente a mesma chave em inglês:

```json
// src/messages/en/clientes.json
{
  "title": "Clientes",
  "loading": "Loading…",
  "failed": "Could not load the list.",
  "empty": "Nothing here yet.",
  "subtitle": "The store's customers."
}
```

> O `make:page` escreve o título em inglês igual ao nome da tela, para você traduzir. Se traduzir o título, atualize também o teste da tela (`index.test.tsx`), que procura o título pelo texto. O guia [Testes](guides/test.md#o-idioma-dos-testes) explica em que idioma os testes rodam.

Agora use o texto. No model, acrescente-o ao `return`:

```ts
// src/pages/clientes/model.ts (dentro do return)
    subtitle: t('subtitle'),
```

A chave `'subtitle'` é tipada: o `useTranslations('clientes')` só aceita chaves que existem nas mensagens em português, e um erro de digitação não compila.

Na view, mostre o texto abaixo do título:

```tsx
// src/pages/clientes/view.tsx
      <h1>{m.title}</h1>
      <p>{m.subtitle}</p>
```

Repare que a view não sabe de onde os dados vêm nem como os textos são traduzidos: recebe tudo pronto por props.

## 8. Crie um componente da tela

O Prumo não tem comando de componente: os de interface (botão, tabela, diálogo) vêm do design system do produto, por exemplo o shadcn em `src/components/ui`, e os componentes do produto se criam à mão. Componentes usados só por uma tela moram na pasta dela. Crie um resumo para a tela de clientes, em `src/pages/clientes/components/resumo.tsx`:

```tsx
export interface ResumoProps {
  title: string
}

export function Resumo({ title }: ResumoProps) {
  return (
    <section>
      <h2>{title}</h2>
    </section>
  )
}
```

Use-o na view: `import { Resumo } from './components/resumo'`.

Um componente que duas ou mais telas usam vai para `src/components/shared`. O `prumo check` confere que ele é mesmo compartilhado: se você mover o resumo para `shared` e só a tela de clientes o usar, ele acusa:

```text
src/components/shared/resumo.tsx  [shared-usage]  O módulo é usado só pela tela 'clientes', e o que está em src/components/shared precisa de 2 ou mais telas: mova-o para a tela que o usa.
```

Também acusa uma pasta nova em `src/components` fora de `ui`, `shared` e `layout`. Deixe o resumo na pasta da tela.

## 9. Veja a arquitetura protegendo o projeto

Tente importar a view da tela inicial dentro da tela de clientes:

```ts
// src/pages/clientes/view.tsx
import { HomeView } from '@/pages/home/view'
```

O editor (com a extensão do ESLint) e o `pnpm lint` acusam na hora:

```text
A tela 'clientes' não importa da pasta da tela 'home' ('@/pages/home/view'): o que as duas usam vai para a pasta de componentes compartilhados.
```

Telas isoladas podem ser mudadas, movidas ou apagadas sem efeito colateral nas outras. Desfaça o import.

As camadas de baixo também são cobradas. Tente, no model da tela, importar o `http` direto:

```ts
// src/pages/clientes/model.ts
import { api } from '@/http/api'
```

```text
A tela não importa de 'src/http' ('@/http/api'): ela chama um use case, e é o use case que usa o http.
```

A tela chama o use case, e só o use case fala com a API. O contrário também vale: um use case que importa de `react`, do TanStack ou de uma tela é acusado (o `useQuery` e o `useMutation` ficam no model). Desfaça o import.

As outras regras funcionam do mesmo jeito: uma tela sem `model.ts`, uma pasta nova em `src/components` fora das permitidas, um componente compartilhado que ninguém compartilha, um `.usecase.ts` sem o teste ao lado. A lista completa está em [Arquitetura](concepts/architecture.md#as-regras).

## 10. Feche com a verificação

```bash
pnpm verify
```

Typecheck, lint, `prumo check` e testes verdes: o app tem um domínio com use cases testados, uma tela de lista com estados de carregamento, erro e lista vazia, um formulário, textos completos em dois idiomas e um componente.

## Próximos passos

- Ligue uma API no lugar do mock (`VITE_DATA_SOURCE=http`): [Ligar uma API real](guides/real-api.md).
- Crie use cases que não são CRUD (um `auth.sign-in`, um `cart.add-item --local`): [Use cases](guides/use-cases.md).
- Faça o login: [Login e sessão](guides/auth.md).
- Ponha a interface do produto: [Design system](guides/design-system.md).
- Teste os estados da tela: [Testes](guides/test.md).
- Veja o que o projeto já tem, a qualquer hora, com `pnpm exec prumo list` (ou `--json`, para outras ferramentas lerem).
- Deixe um agente de IA gerar as camadas: o app já traz o `.mcp.json`, que liga o agente ao servidor `prumo mcp`. Veja [Agentes de IA](guides/ai-agents.md).
- Veja todos os comandos e opções: [Referência da CLI](reference/cli.md).
