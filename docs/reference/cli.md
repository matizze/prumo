# Referência da CLI

O comando `prumo`, do pacote [`@matizze/prumo-cli`](https://www.npmjs.com/package/@matizze/prumo-cli).

```text
prumo [opções] [comando]
```

| Comando                            | O que faz                                             |
| ---------------------------------- | ----------------------------------------------------- |
| [`new <nome>`](#prumo-new)         | Cria um app React organizado em camadas               |
| [`make:schema <domínio>`](#prumo-makeschema) | Cria o schema (zod) de uma entidade, com os campos |
| [`make:usecase <domínio.ação>`](#prumo-makeusecase) | Cria um use case (tipos, classe, mock e teste): o caminho novo para o que o app faz com dados; com `--crud`, os cinco do CRUD de uma entidade |
| [`make:page <nome>`](#prumo-makepage) | Cria uma tela (index, model, view, teste), os textos e a rota; com `--usecase`, lista, detalhe ou formulário de um use case |
| [`check`](#prumo-check)            | Confere a arquitetura do projeto                      |
| [`list`](#prumo-list)              | Mostra o que o projeto tem (schemas, use cases, telas, idiomas) |
| [`mcp`](#prumo-mcp)                | Abre o servidor MCP do projeto, por stdio, para agentes de IA |

## Como rodar

Num app do Prumo, a CLI é dependência de desenvolvimento:

```bash
pnpm exec prumo --help
```

Sem instalar nada:

```bash
pnpm dlx @matizze/prumo-cli --help
```

## A busca do projeto

Os comandos que trabalham num projeto (`make:*`, `check`, `list` e `mcp`) o procuram a partir da pasta atual, subindo: o projeto é a primeira pasta que tem `src` e um `package.json` com alguma dependência `@matizze/prumo-*` (em `dependencies` ou `devDependencies`), como o git acha o `.git`. Por isso `prumo make:page sobre` funciona de dentro de `src/pages`, e o projeto mais perto ganha do que está acima (um monorepo com vários apps). Uma pasta com `package.json` e `src` que não é do Prumo (o `website` do repositório, por exemplo) não conta: a busca segue para cima.

Com `--root <pasta>`, não há busca: o projeto é aquela pasta exata, e uma pasta sem `package.json` ou sem `src` sai com 2 e o motivo (`a pasta '...' não tem package.json: aponte --root para a raiz do projeto.`). Sem `--root` e sem achar nenhum projeto até a raiz do disco, sai com 2 dizendo de que pasta partiu a busca e sugerindo o `--root`. O `new` não procura: cria `<dir>/<nome>`.

## `prumo new`

```text
prumo new <nome> [--dir <pasta>] [--no-install] [--dry-run]
```

Cria `<dir>/<nome>`: um app com Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next, os pacotes do Prumo (`core`, `rules`, `testing` e `cli`), a estrutura de pastas das camadas, os provedores (query, i18n e use cases), a tela inicial `home` (a mesma que o `make:page` gera, na rota `/`), o `src/vite-env.d.ts` (com `VITE_DATA_SOURCE` e `VITE_API_URL`, opcionais), o ESLint com o plugin do Prumo, o Vitest com jsdom, o `AGENTS.md` e o `.mcp.json` (que registra o servidor [`prumo mcp`](#prumo-mcp) para agentes de IA). A fonte de dados padrão é `mock`. Veja o app criado em [Anatomia do app gerado](../concepts/generated-app.md).

| Argumento ou opção  | O que faz                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `<nome>`            | O nome do app, em kebab-case (`meu-app`): a pasta e o `name` do `package.json`                                               |
| `--dir <pasta>`     | A pasta onde criar `<nome>` (padrão: a pasta atual; a que falta é criada)                                                    |
| `--no-install`      | Não roda o `pnpm install`: só cria os arquivos                                                                               |
| `--dry-run`         | Lista o que seria criado e não escreve nada                                                                                  |

A opção `--packages <pasta>` serve ao portão do monorepo (`pnpm verify:new`) e a quem contribui com o Prumo, e por isso não aparece na ajuda: ela instala os tarballs dos pacotes `@matizze/prumo-*` da pasta (os do `pnpm pack:all`) no lugar do registry, por `pnpm.overrides` com `file:`. A pasta precisa ter o tarball dos quatro pacotes.

O que o comando faz, nesta ordem:

1. Confere tudo antes de escrever: o nome (kebab-case, até 214 caracteres), a pasta de destino (`<dir>/<nome>` não pode existir com conteúdo; uma pasta vazia serve) e os tarballs de `--packages`, se foi dada. Qualquer problema sai com código `2`, sem deixar nada pela metade.
2. Monta o plano do app inteiro e só então o grava.
3. Roda `git init` (sem commit: o primeiro commit é seu).
4. Roda `pnpm install`, a não ser com `--no-install`. Se o `pnpm install` falha, o comando sai com `1` e o app fica criado.
5. Escreve os próximos passos (`pnpm verify`, `pnpm dev`, `prumo make:page`).

O `package.json` do app tem os scripts `dev`, `build`, `typecheck`, `lint`, `check`, `test` e `verify`, e fixa o pnpm em `packageManager` (`pnpm@<versão>`, lida do pnpm que rodou o comando; sem versão, o campo fica de fora). Os pacotes do Prumo entram como `^<versão>`.

## `prumo make:schema`

```text
prumo make:schema <domínio> [--entity <singular>] [--fields <campos>] [--root <pasta>] [--dry-run]
```

Cria o schema zod de uma entidade e o registra:

- `src/schemas/entities/<entidade>.ts`, com o `<entidade>Schema` (`id`, os campos e `createdAt`), o `<Entidade>Schema` (o tipo), o `<entidade>InputSchema` e o `<Entidade>Input` (o que se envia para criar ou editar), o `<Entidade>SortKey` e o `<Entidade>ListQuery`;
- `export * from './entities/<entidade>'` no fim de `src/schemas/index.ts`.

O `<domínio>` é o nome do domínio, no plural e em kebab-case (`clientes`, `pedidos-recentes`). A entidade é o singular, que sai do nome (tira o `s` final). Só o `s` final sai: `fornecedores` dá `fornecedore`, e `paes` dá `pae`. A saída mostra a entidade derivada, e o `--entity` a troca (`--entity fornecedor`, `--entity pao`). Onde a regra erra (o plural termina em `ies`, `us`, `ss`, `xes`, `ches`, `shes` ou `sses`), o comando recusa e pede o `--entity`: `categories` daria `categorie`, e o certo é `--entity category`.

| Opção                 | O que faz                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `--entity <singular>` | A entidade, no singular (`paes` com `--entity pao`). Padrão: o nome sem o `s` final                   |
| `--fields <campos>`   | Os campos da entidade (formato abaixo). Padrão: só `name:string`                                      |
| `--root <pasta>`      | A pasta do projeto, a que tem o `src`. Padrão: [a busca](#a-busca-do-projeto) a partir da pasta atual |
| `--dry-run`           | Lista o que seria criado e alterado, sem escrever nada                                                |

### O formato do `--fields`

`nome:tipo` separados por vírgula:

```bash
prumo make:schema livros --fields "titulo:string,ano:int,situacao:enum(lido|lendo|desejado),lidoEm?:datetime,apelido?:string"
```

| Tipo           | Vira no schema          | Observação                                                      |
| -------------- | ----------------------- | --------------------------------------------------------------- |
| `string`       | `z.string()`            | Texto                                                           |
| `number`       | `z.number()`            | Número qualquer                                                 |
| `int`          | `z.number().int()`      | Número inteiro                                                  |
| `boolean`      | `z.boolean()`           |                                                                 |
| `date`         | `z.iso.date()`          | Data, `AAAA-MM-DD`                                              |
| `datetime`     | `z.iso.datetime()`      | Data e hora em ISO, `2026-01-05T12:00:00.000Z`                  |
| `enum(a\|b\|c)` | `z.enum(['a', 'b', 'c'])` | Um valor da lista: dois ou mais, letras, números e `_`, começando por letra |

- O nome do campo é camelCase: começa com letra minúscula e tem só letras e números.
- O `?` depois do nome torna o campo opcional (`apelido?:string` vira `z.string().optional()`).
- `id` e `createdAt` são reservados (o repositório os dá a todo registro), e um nome repetido é recusado. O nome junto (`auth-login`) é que não pode ser palavra reservada: `auth.new` passa, e `new` sozinho não.
- Espaços em volta dos nomes e dos tipos são aceitos.

O comando valida tudo antes de escrever: o nome (kebab-case, no plural, sem palavra reservada do JavaScript nem nome global como `Date`), a entidade, cada campo e o schema que já existe (nunca sobrescreve). Qualquer erro sai com 2, em português, sem deixar nada pela metade. No fim, mostra o que criou e alterou e o próximo passo: `prumo make:usecase <domínio> --crud`.

Quem lê os campos depois é o `make:usecase --crud`, direto do schema gerado. O leitor lê a árvore do arquivo (o enum pode ter várias linhas e vírgula no fim) e exige o que o `--fields` geraria: `id` e `createdAt` como `z.string()`, nomes de campo em camelCase sem aspas e enum com dois valores ou mais, simples e sem repetição. Um campo que o Prumo não reconhece (o schema foi editado à mão com outro tipo, como `z.string().min(3)`) é erro de uso, com o arquivo, a linha e o nome do campo.

## `prumo make:usecase`

```text
prumo make:usecase <domínio.ação> [--input <campos>] [--output <campos|entidade>] [--endpoint "<MÉTODO> <caminho>"] [--read | --write] [--local] [--root <pasta>] [--dry-run]
prumo make:usecase <domínio> --crud [--entity <singular>] [--root <pasta>] [--dry-run]
```

Cria um **use case**: uma ação do app com nome de verbo (`get-stores`, `sign-in`, `add-item`), com um Input, um Output e um `execute`. É o caminho novo para tudo o que o app faz com dados. Veja [as camadas](../concepts/architecture.md#use-cases).

O nome é `<domínio>.<ação>` (ou `<domínio>/<ação>`, como no `make:page`), cada parte em kebab-case: `auth.sign-in`, `stores/get-stores`. O domínio dá a pasta em `src/use-cases`, e a ação dá a classe (`GetStoresUseCase`) e a **chave no registro** (`getStores`, o que a tela lê de `useUseCases()`). As chaves são únicas no app: `stores.get-stores` e `orders.get-stores` dão conflito, e o comando recusa o segundo com a mensagem dizendo de quem é a chave. A ação não pode virar palavra reservada do JavaScript (`delete`).

Precisa do app com `src/use-cases/index.ts`, que o `prumo new` cria. Um app de antes dos use cases não tem a camada; veja o [guia de agentes](../guides/ai-agents.md) e a [anatomia do app](../concepts/generated-app.md#os-use-cases) para o que ela traz.

| Opção                          | O que faz                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `--input <campos>`             | Os campos do Input, na sintaxe do [`--fields`](#o-formato-do---fields). Padrão: `z.object({})`                        |
| `--output <campos\|entidade>`  | Os campos do Output, ou o nome de uma entidade que já tem schema (`store`, ou `store[]` para a lista). Padrão: `z.unknown()` |
| `--endpoint "<MÉTODO> <caminho>"` | O endereço da API (`PATCH /livros/:id`). Padrão: `GET /<domínio>/<ação>` na leitura e `POST /<domínio>/<ação>` na escrita |
| `--read`, `--write`            | Forçam o tipo, no lugar do verbo da ação                                                                            |
| `--local`                      | Use case sem API: recebe o `storage` (o `localStorage`), sem `ENDPOINT` nem mock                                     |
| `--crud`                       | Gera os cinco use cases do CRUD de uma entidade, a partir do schema ([veja abaixo](#o---crud)). O nome é só o domínio, no plural |
| `--entity <singular>`          | Com `--crud`, a entidade, no singular, a mesma do `make:schema`. Padrão: o nome sem o `s` final                       |
| `--root <pasta>`               | A pasta do projeto, a que tem o `src`. Padrão: [a busca](#a-busca-do-projeto) a partir da pasta atual                |
| `--dry-run`                    | Lista o que seria criado e alterado, sem escrever nada                                                               |

### Leitura ou escrita

O verbo no começo da ação decide: `get`, `list`, `search`, `find`, `check` e `count` são **leitura** (a tela usa com `useQuery`); o resto é **escrita** (`useMutation`). `--read` e `--write` forçam o tipo. Na leitura, o Input vai como `query` da chamada, e o use case ganha a chave de cache; na escrita, o Input vai como `body`. Uma escrita não pode usar `GET`, que não leva corpo.

### O que o comando cria

```text
src/use-cases/auth/
  index.ts                 createAuthUseCases(deps) e as rotas de mock do domínio (criado com o primeiro use case)
  sign-in.types.ts         ENDPOINT, SignInInput e SignInOutput (e, na leitura, a chave de cache)
  sign-in.usecase.ts       SignInUseCase
  sign-in.mock.ts          a rota de mock do ENDPOINT
  sign-in.usecase.test.ts  o teste, contra o mock e, com API_TEST_URL, contra a API real
```

- **`<ação>.types.ts`**: o `ENDPOINT` (`{ method, path }`, editável), o Input e o Output em zod (cada um com o tipo de mesmo nome: `SignInInput` é o schema e o tipo) e, na leitura, a função `<ação>Key(input)`, a chave de cache da consulta, com o domínio no prefixo (`['stores', 'get-stores', input]`): o model a usa no `queryKey`, e uma escrita invalida `['stores']`.
- **`<ação>.usecase.ts`**: `export class SignInUseCase implements IUseCase<SignInInput, SignInOutput>`, com o `http` no construtor (campo `#http`). O `execute` valida o Input, chama a API e valida a resposta com o Output. Um `HttpError` vira `UIError` com o código `<AÇÃO>_FAILED` (`SIGN_IN_FAILED`), e o comando acrescenta o texto ao `src/messages/<idioma>/errors.json` dos dois idiomas (a chave que já existe fica; num app sem o `errors.json`, o comando avisa e segue). O corpo da resposta de erro (`HttpError.body`, o 422 com os erros de validação) fica no `HttpError`; o `UIError` ainda não tem onde carregá-lo.
- **`<ação>.mock.ts`**: a rota de mock do `ENDPOINT`, com uma resposta de exemplo feita dos campos do Output (de uma entidade, um registro com `id` e `createdAt`; de uma lista, dois). O `createMockHttp` do core a usa: o mesmo código do use case roda no mock e em produção, e só o transporte muda.
- **`<ação>.usecase.test.ts`**: o contrato do use case (`defineContractSuite` do `@matizze/prumo-testing`), que roda contra o mock e, com `API_TEST_URL`, contra a API real, mais um teste do `UIError`.
- **`index.ts` do domínio** e **`src/use-cases/index.ts`**: o use case entra em `create<Domínio>UseCases(deps)` e a rota em `<domínio>Routes`; o domínio entra no registro geral (`createUseCases(deps)` e `mockRoutes`), tudo em ordem alfabética. Veja o [registro](../concepts/generated-app.md#os-use-cases).

### O `--endpoint`

`--endpoint "<MÉTODO> <caminho>"`, com `GET`, `POST`, `PUT`, `PATCH` ou `DELETE` e o caminho começando por `/`, sem `?` nem `#` (o que vai na query sai do Input). Cada `:parâmetro` do caminho sai do campo do Input de mesmo nome, que fica fora da query e do corpo e entra no caminho com `encodeURIComponent`:

```bash
prumo make:usecase livros.update-livro --endpoint "PATCH /livros/:id" --input "id:string,title?:string" --output livro
```

O comando recusa um endpoint cujo `:parâmetro` não é um campo do Input, é opcional, é palavra reservada do JavaScript ou não é `string`, `number`, `int`, `boolean` ou `enum`, e dois parâmetros em que um é o começo do nome do outro. Não combina com `--local`.

### `--input` e `--output`

Os dois usam a sintaxe do [`--fields`](#o-formato-do---fields), e aceitam também `id` e `createdAt`. O `--output` aceita ainda o nome de uma entidade que já tem schema (`prumo make:schema`): `--output store` usa o `storeSchema`, e `--output store[]` uma lista dele (`z.array(storeSchema)`). Sem eles, o Input é um objeto vazio e o Output é `z.unknown()` (a API real pode devolver corpo, e um `z.void()` falharia no `parse`), e o comando **avisa**, sem falhar, para a pessoa preencher o `.types.ts`.

### A fonte de dados

O registro lê a `VITE_DATA_SOURCE`: `http` usa a API (`src/http/api.ts`), e `mock` (o padrão, sem a variável) usa o `http` de mentira. **Qualquer outro valor é erro**, com a mensagem `Invalid VITE_DATA_SOURCE "x". Expected one of: mock, http.`

### `--local`

Um use case sem API, como o carrinho do pratigo: a classe recebe o `storage` (a Web Storage API, o `localStorage`, que entra nas `deps` do registro) e não tem `ENDPOINT`, mock nem erro de API. O `execute` valida o Input, tem o lugar da regra marcado num comentário (o exemplo guarda o Input no `storage`, ou lê dele na leitura) e devolve o Output validado. O teste roda com o `localStorage` do jsdom.

### O `--crud`

```bash
prumo make:schema livros --fields "title:string,author:string,year:int"
prumo make:usecase livros --crud
```

Gera os cinco use cases do CRUD de uma entidade de uma vez, num plano só. O nome é o domínio, no plural (`livros`), e o schema precisa existir: os campos (busca, ordem, dados de exemplo e testes) saem dele, e o `--entity` troca o singular quando a regra de tirar o `s` erra (`--entity pao` para `paes`). Não combina com `--input`, `--output`, `--endpoint`, `--read`, `--write` nem `--local`.

| Chave no registro | Endereço             | Input                                             | Output                  |
| ----------------- | -------------------- | ------------------------------------------------- | ----------------------- |
| `listLivros`      | `GET /livros`        | o `LivroListQuery` do schema: `search`, `sort`, `page` e `page_size` | `Page<LivroSchema>` (`{ items, total }`) |
| `getLivro`        | `GET /livros/:id`    | `{ id }`                                          | `LivroSchema`           |
| `createLivro`     | `POST /livros`       | o `LivroInput` do schema                          | `LivroSchema`           |
| `updateLivro`     | `PATCH /livros/:id`  | o `id` e o `LivroInput` com todos os campos opcionais | `LivroSchema`       |
| `removeLivro`     | `DELETE /livros/:id` | `{ id }`                                          | `void`                  |

Cada use case tem os arquivos de sempre (`list-livros.types.ts`, `.usecase.ts`, `.mock.ts` e `.usecase.test.ts`, e assim por diante). A leitura (`list` e `get`) ganha a chave de cache `<ação>Key(input)`, com o domínio no prefixo. O `sort` do `listLivros` vai na query como `<campo>:<asc|desc>`. O 404 de `getLivro`, `updateLivro` e `removeLivro` vira `UIError('LIVRO_NOT_FOUND')`, e os outros erros da API viram o `<AÇÃO>_FAILED` de cada um. O comando acrescenta o texto de `LIVRO_NOT_FOUND` e dos cinco `_FAILED` ao `errors.json` dos dois idiomas.

Os mocks dos cinco dividem **uma coleção em memória**, `src/use-cases/livros/collection.mock.ts`: as fixtures do domínio (três registros, no formato do schema) e um `createMockCollection` do core. Assim, `createLivro` e depois `listLivros` mostra o item novo, e `updateLivro` e `removeLivro` mudam o que o resto lê. Os testes dos cinco cobrem o que o contrato do repositório cobre (lista com ids únicos, busca sem diferenciar maiúsculas e acentos, ordem e página com o total de antes da página, busca por id, criação com `id` e data, edição só dos campos enviados, remoção e o `LIVRO_NOT_FOUND`), contra o mock e, com `API_TEST_URL`, contra a API.

O comando recusa, com 2 e sem escrever nada, quando algum dos cinco já existe, dizendo qual (`o use case 'livros.get-livro' já existe`), ou quando a chave de um deles já é de outro use case. A tela de cada um sai do [`make:page --usecase`](#prumo-makepage).

### O resultado

Como os outros `make:*`, o comando valida tudo antes de escrever e nunca sobrescreve: um use case que já existe, uma chave repetida, um nome sem domínio ou sem ação, uma entidade sem schema ou um endpoint inválido saem com 2, sem deixar nada pela metade. Mostra o que criou e alterou, os avisos e o próximo passo, que diz como a tela usa o use case:

```text
prumo make:usecase: stores.get-stores (leitura, GET /stores/get-stores).

Criados (5):
  src/use-cases/stores/get-stores.mock.ts
  src/use-cases/stores/get-stores.types.ts
  src/use-cases/stores/get-stores.usecase.test.ts
  src/use-cases/stores/get-stores.usecase.ts
  src/use-cases/stores/index.ts

Alterados (3):
  src/messages/en/errors.json
  src/messages/pt-BR/errors.json
  src/use-cases/index.ts

Aviso: sem --input, o Input é um objeto vazio: descreva os campos em src/use-cases/stores/get-stores.types.ts.

Próximo passo: no model da tela, const { getStores } = useUseCases() e useQuery({ queryKey: getStoresKey(input), queryFn: () => getStores.execute(input) }).
```

## `prumo make:page`

```text
prumo make:page <nome> [--usecase <domínio.ação>] [--path <caminho>] [--root <pasta>] [--dry-run]
```

Cria uma tela: `src/pages/<nome>/` com `index.tsx` (liga o model à view), `model.ts` (dados e textos, sem JSX), `view.tsx` (só tags nativas, recebe tudo por props) e `index.test.tsx` (renderiza com o `renderWithProviders` de `@/test/render` e confere o título), e as mensagens em `src/messages/<idioma>/<nome>.json`, nos idiomas do projeto. Registra o namespace nos índices de mensagens de cada idioma e a rota no `src/App.tsx`. O `<nome>` vai em kebab-case (`clientes`, `pedidos-recentes`).

Para agrupar telas em subpastas, separe os segmentos do nome com ponto ou barra, as duas formas com o mesmo resultado:

```bash
prumo make:page auth.login      # o mesmo que auth/login
```

Cria `src/pages/auth/login/` (a tela comum, com `index.tsx`, `model.ts`, `view.tsx` e o teste), a rota padrão `/auth/login` (o `--path` continua valendo), o componente `AuthLoginPage` e as mensagens em `src/messages/<idioma>/auth-login.json`, com o namespace `authLogin`: o componente, as mensagens e o namespace saem dos segmentos juntos. Cada segmento segue o formato do nome (kebab-case) e a mensagem de erro diz qual é o inválido, e segmento vazio (`auth..login`, `/login`, `auth/`) é recusado. O `prumo list` e as ferramentas MCP mostram o nome com barra (`auth/login`). Uma tela é a primeira pasta, a partir de `src/pages`, que tem `index.tsx`; a pasta sem ele (`auth`) só agrupa telas.

| Opção               | O que faz                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `--usecase <domínio.ação>` | O use case que a tela usa (`livros.list-livros`): lista, detalhe ou formulário, conforme ele ([veja abaixo](#make-page-usecase)). Padrão: nenhum |
| `--path <caminho>`  | O caminho da rota, com um parâmetro opcional (`/clientes/:id`). Padrão: `/<nome>`, com a barra no lugar do ponto (`/auth/login`) |
| `--root <pasta>`    | A pasta do projeto, a que tem o `src`. Padrão: [a busca](#a-busca-do-projeto) a partir da pasta atual |
| `--dry-run`         | Só lista o que seria criado e alterado, sem escrever nada                                             |

As variações:

| `--usecase` | Parâmetro no `--path` | A tela                                                                                                                         |
| ----------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| não         | não                   | Só o título                                                                                                                    |
| não         | sim                   | O model lê o parâmetro com o `useParams` do wouter e a view o mostra; o teste renderiza a tela dentro da `<Route>`              |
| sim         | conforme o use case   | A lista, o detalhe ou o formulário do use case ([veja abaixo](#make-page-usecase))                                               |

O `--path` começa com `/`, tem segmentos fixos (letras, números, `-`, `_`, `.` e `~`) e **no máximo um parâmetro** `:nome` (sem `?`, `*` nem `+`). A rota entra no `<Switch>` do `App.tsx` depois da última rota com `path` e antes da curinga, porque o wouter mostra a primeira que casa. Uma tela de detalhe que continua montada depois do use case de remover recebe `<ENTIDADE>_NOT_FOUND`: saia da tela ao remover.

<a id="make-page-usecase"></a>

### `--usecase`

```bash
prumo make:page livros --usecase livros.list-livros
prumo make:page livro --usecase livros.get-livro --path /livros/:id
prumo make:page livro-novo --usecase livros.create-livro
prumo make:page auth.login --usecase auth.sign-in
```

A tela usa um use case que já existe (`prumo make:usecase`). O model pega o use case de `useUseCases()` e chama `useQuery` (a chave é `<ação>Key(input)`) ou `useMutation`; uma escrita invalida o prefixo do domínio no `onSuccess`. O que a tela mostra depende do use case:

| Use case                                                                  | A tela                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| leitura que devolve lista (`z.array(<entidade>Schema)` ou `pageSchema(<entidade>Schema)`) | A **lista**, com carregando, erro e vazio, e um campo de texto de cada registro                |
| leitura com `:id` no endereço e o mesmo parâmetro no `--path`             | O **detalhe**: o model lê o parâmetro com o `useParams` e a view mostra o registro                      |
| escrita                                                                   | O **formulário** com os campos do Input, o envio, o texto do erro e um aviso de sucesso                 |

```ts
// src/pages/livros/model.ts (livros.list-livros)
const { listLivros } = useUseCases()
const input = {}
const list = useQuery({ queryKey: listLivrosKey(input), queryFn: () => listLivros.execute(input) })
```

O formulário lê os campos do Input do `.types.ts` do use case, pela árvore (`z.object({ ... })`, ou o `<entidade>InputSchema` do `--crud`, com `.partial()` e `.extend({ ... })`), e usa só elementos nativos, sem biblioteca de formulário: um `<input>` por campo (`type` pelo tipo: `text`, `number`, `checkbox`, `date`, `datetime-local`, e `email` e `password` pelo nome do campo), um `<select>` no enum, e `required` nos obrigatórios. O model lê o `FormData` no formato do Input, desabilita o botão enquanto envia e mostra o erro com o `getErrorMessage` de `@/errors` (o `UIError` pelo `errors.json`: `LIVRO_NOT_FOUND`, `SIGN_IN_FAILED`); o teste da tela preenche os campos e envia o formulário contra o mock. Os textos (título, rótulos, envio, sucesso, carregando, erro e vazio) entram nas mensagens dos dois idiomas, e os rótulos saem do nome do campo, para a pessoa traduzir. Funciona com tela em subpasta (`auth.login`).

Limitações de hoje:

- O formulário de **update** não lê o `:id` da rota nem carrega o registro: o `id` é um campo do formulário, como os outros, e os campos começam vazios.
- O checkbox desmarcado envia `false` (o campo `boolean` sempre vai no Input).
- A **lista** exige o Output `<entidade>[]` (`z.array(<entidade>Schema)`) ou `Page` (`pageSchema(<entidade>Schema)`); outro formato é erro de uso.
- Os rótulos de um `enum` mostram o valor (`lido`, `lendo`), sem tradução: troque na view.
- Depois de um envio com sucesso o formulário volta ao começo, e editar um campo tira o aviso.

São erro de uso: um use case que não existe; uma leitura que não devolve lista de entidade e não tem `:parâmetro` (a mensagem diz como ajustar o Output); um `--path` com parâmetro que o endereço do use case não tem, ou o contrário; um `--path` com parâmetro numa escrita; e, na lista e no detalhe, um Input com campo obrigatório que a tela não preenche.

O comando valida tudo antes de escrever e nunca sobrescreve. Saem com 2, sem deixar nada pela metade: nome inválido ou reservado (ou com segmento vazio); tela que já existe; tela dentro de outra tela (`auth/login` com `src/pages/auth/index.tsx`); pasta que já agrupa telas (`auth` com `src/pages/auth/login/index.tsx`); nome que dá o mesmo componente e as mesmas mensagens de outra tela (`auth/login` e `auth-login`, e a mensagem diz o conflito); `--path` inválido, com rota repetida ou que conflita com uma do `App.tsx`; `App.tsx` ou índice de mensagens que falta. No fim, mostra o que fez, os avisos e o comando dos testes da tela nova.

## `prumo check`

```text
prumo check [--root <pasta>]
```

Analisa o projeto com o `@matizze/prumo-rules/check` e escreve uma violação por linha, no stderr:

```text
src/components/widgets  [components-folders]  A pasta 'widgets' não é permitida em src/components
```

Confere as pastas de `src/components`, o uso de `components/shared` pelas telas, a estrutura de cada tela e os textos completos nos idiomas. Sem violação, escreve `prumo check: nenhuma violação.`.

| Opção            | O que faz                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `--root <pasta>` | A pasta do projeto, a que tem o `src`. Padrão: [a busca](#a-busca-do-projeto) a partir da pasta atual |

| Código | Quando                                                                          |
| ------ | ------------------------------------------------------------------------------- |
| `0`    | Nenhuma violação                                                                |
| `1`    | Há violação                                                                     |
| `2`    | Nenhum projeto achado, ou o `--root` não existe ou não é um projeto (sem `package.json` e `src`) |

## `prumo list`

```text
prumo list [--root <pasta>] [--json]
```

Mostra o que o projeto tem, lendo os arquivos. Nunca escreve. Sai com 2 se não acha um projeto (sem `package.json` e `src`), como o `check`. Sem `--json`, escreve uma seção por tipo, em português, com uma linha por item; a seção vazia diz `nenhum`:

```text
Schemas (1):
  Livro  src/schemas/entities/livro.ts  title: string, year?: int

Use cases (3):
  auth.sign-in  signIn  escrita  POST /auth/sign-in
  cart.add-item  addItem  local
  stores.get-stores  getStores  leitura  GET /stores/get-stores

Telas (3):
  livro  rota: /livros/:id  detalhe  use case: livros.get-livro
  livro-novo  rota: /livro-novo  formulário  use case: livros.create-livro
  sobre  rota: nenhuma  título

Idiomas (2):
  en
  pt-BR
```

Na linha da tela, a variação tem rótulo em português (`título`, `lista`, `parâmetro`, `detalhe` ou `formulário`; o `--json` traz os valores em inglês, abaixo). `rota: curinga` é a `<Route>` sem `path` (ou com `path="*"`), `rota: {expressão} (expressão)` é um `path` que não é literal e `rota: nenhuma` é a tela que nenhuma `<Route>` usa. Um schema que o leitor do Prumo recusa (editado à mão com algo fora dos tipos do `--fields`) aparece como `editado à mão (<motivo>)`, com a primeira linha da mensagem do leitor (no máximo 160 caracteres).

| Opção            | O que faz                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `--root <pasta>` | A pasta do projeto, a que tem o `src`. Padrão: [a busca](#a-busca-do-projeto) a partir da pasta atual |
| `--json`         | Escreve o levantamento em JSON, no formato abaixo                                                     |

### A saída `--json`

Um objeto com quatro listas, sempre presentes (vazias quando não há nada), ordenadas pelo nome do arquivo ou da pasta (comparação fixa, a mesma em qualquer máquina). Os tipos estão no `ProjectListing` (exportado por `@matizze/prumo-cli`).

```json
{
  "schemas": [
    {
      "entity": "Livro",
      "file": "src/schemas/entities/livro.ts",
      "fields": [{ "name": "title", "type": "string", "optional": false }],
      "problem": null
    }
  ],
  "useCases": [
    {
      "domain": "livros",
      "name": "get-livros",
      "key": "getLivros",
      "kind": "read",
      "endpoint": "GET /livros/get-livros"
    }
  ],
  "pages": [
    {
      "name": "livro",
      "route": "/livros/:id",
      "routeKind": "literal",
      "routePartial": false,
      "variation": "detail",
      "useCase": "livros.get-livro"
    }
  ],
  "languages": ["en", "pt-BR"]
}
```

| Lista          | Campo       | Valor                                                                                                                                  |
| -------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `schemas`      | `entity`    | A entidade, em PascalCase                                                                                                              |
|                | `file`      | O arquivo, relativo à raiz                                                                                                             |
|                | `fields`    | Os campos que o leitor reconhece (`name`, `type`, `optional` e, no `enum`, `values`), sem `id` e `createdAt`; `null` se o schema foi editado à mão e o leitor o recusa |
|                | `problem`   | O motivo curto da recusa; `null` quando `fields` foi lido                                                                              |
| `useCases`     | `domain`    | O nome da pasta em `src/use-cases`                                                                                                     |
|                | `name`      | A ação, em kebab-case (o arquivo `<ação>.usecase.ts`)                                                                                  |
|                | `key`       | A chave no registro (`useUseCases().<chave>`): a ação em camelCase                                                                     |
|                | `kind`      | `read` (o `.types.ts` tem a chave de cache `<chave>Key`), `write` (tem `ENDPOINT`, sem a chave) ou `local` (sem `ENDPOINT`: usa o `storage`) |
|                | `endpoint`  | O `ENDPOINT` do `.types.ts`, como `GET /stores/get-stores`; `null` no `local`                                                          |
| `pages`        | `name`      | O caminho da tela a partir de `src/pages`, com barra nas subpastas (`auth/login`)                                                      |
|                | `route`     | A rota da tela no `src/App.tsx`: o `path` da `<Route>` mais interna que a usa, composto com os `<Route nest>` de fora (`/admin` + `/usuarios` vira `/admin/usuarios`); `*` para a curinga (sem `path`, ou `path="*"`); o texto da expressão de um `path={...}` que não é literal (por exemplo, `{ROUTES.lenta}`); `null` só quando nenhuma `<Route>` usa a tela. A tela pode vir de um `import` padrão ou de um `lazy(() => import('@/pages/<nome>'))` |
|                | `routeKind` | `literal`, `catchAll` ou `expression`; `null` quando `route` é `null`                                                                  |
|                | `routePartial` | `true` quando um `<Route nest>` de fora não tem `path` literal e não deu para compor: `route` é só o caminho da `<Route>` de dentro |
|                | `variation` | `title` (só o título), `list` (use case de leitura), `param` (rota com parâmetro), `detail` (use case de leitura com parâmetro) ou `form` (use case de escrita) |
|                |                | `useCase`   | O use case que o model chama de `useUseCases()`, como `livros.list-livros`; `null` se não chama                                         |
| `languages`    |             | As pastas de `src/messages`, em ordem                                                                                                  |

## `prumo mcp`

```text
prumo mcp [--root <pasta>]
```

Abre o servidor MCP do projeto, por stdio, para um agente de IA usar o Prumo sem passar pelo terminal. Acha o projeto como o `check` (sai com 2 se não acha um com `package.json` e `src`) e só então carrega o SDK do MCP, que fica fora dos outros comandos. O servidor se anuncia como `prumo`, com a versão da CLI, e só termina quando o cliente fecha.

O stdout é do protocolo: nada além dele sai ali com o servidor no ar (o `console.log` vai para o stderr). Por isso, não rode o comando à mão: ligue-o ao agente. Num projeto que não saiu do `prumo new`, cole no `.mcp.json` da raiz:

```json
{
  "mcpServers": {
    "prumo": { "command": "pnpm", "args": ["exec", "prumo", "mcp"] }
  }
}
```

| Opção            | O que faz                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `--root <pasta>` | A pasta do projeto, a que tem o `src`. Padrão: [a busca](#a-busca-do-projeto) a partir da pasta atual |

### As ferramentas

Uma ferramenta por comando, menos `new` e `mcp`. Elas saem da árvore de comandos da CLI: um comando novo vira ferramenta sem outra lista para manter.

- **Nome:** o do comando, com `:` trocado por `_` (`make:schema` vira `make_schema`).
- **Descrição:** o resumo do comando, o detalhe que a ajuda do terminal deixa para esta página (formatos, regras e pré-requisitos, para o agente não precisar da documentação) e o link da referência.
- **Entrada:** os argumentos posicionais (obrigatórios) e as opções, com nomes em snake_case sem acento: `<domínio>` vira `dominio`, `--dry-run` vira `dry_run`. Opção com valor é `string` (com `enum` quando o comando lista os valores); opção sem valor é `boolean`; `--no-<x>` vira `<x>: boolean`, com `true` de padrão. O posicional não pode começar com `-`. Campo fora do esquema é recusado.
- **Fora da entrada:** `--root`, `--help` e `--version`. Nenhuma ferramenta recebe a pasta: o agente só escreve no projeto onde o servidor abriu. No `list`, o `--json` também não é campo: a ferramenta sempre o passa.

| Ferramenta        | Parâmetros                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `make_schema`     | `dominio` (obrigatório), `entity`, `fields`, `dry_run`                                   |
| `make_usecase`    | `nome` (obrigatório), `input`, `output`, `endpoint`, `read`, `write`, `local`, `crud`, `entity`, `dry_run` |
| `make_page`       | `nome` (obrigatório), `usecase`, `path`, `dry_run`                              |
| `check`           | nenhum                                                                                   |
| `list`            | nenhum                                                                                   |

Os parâmetros têm o significado das opções do comando de mesmo nome (veja as seções acima).

### O resultado

A entrada vira a linha de comando (`['make:schema', '--fields=...', '--', 'livros']`: a opção de valor vai como `--opção=valor` e os posicionais depois de `--`, para nenhum valor ser lido como opção) e roda em processo, na pasta do projeto, com a saída capturada. O resultado é o texto da saída: o stdout e, se houver, o stderr. A ferramenta `list` devolve o JSON do `prumo list --json`.

- `isError` é verdadeiro quando o código de saída não é 0, com a mensagem em português (o erro de uso traz o `prumo: ...`, com a linha de uso quando o erro é de opção ou argumento). O erro inesperado volta sempre com a pilha, como se `PRUMO_DEBUG` estivesse ligado: o agente não tem como rodar de novo com a variável.
- O `check` com violação (código 1) não é erro: volta com `isError` falso e as violações no texto, para o agente corrigir.
- As chamadas rodam uma de cada vez, numa fila, para duas escritas no mesmo projeto não se cruzarem.

## Opções globais

| Opção             | O que faz           |
| ----------------- | ------------------- |
| `-v, --version`   | Mostra a versão.    |
| `-h, --help`      | Mostra esta ajuda.  |

`prumo` sem argumentos mostra a ajuda.

## A ajuda

A ajuda é toda em português, com os cabeçalhos `Uso:`, `Argumentos:`, `Opções:` e `Comandos:`. A da raiz termina com o link desta documentação:

```text
Uso: prumo [opções] [comando]

Prumo, a ferramenta da Matizze que cria e confere a arquitetura de apps React.

Opções:
  -v, --version                       Mostra a versão.
  -h, --help                          Mostra esta ajuda.

Comandos:
  new [opções] <nome>                 Cria um app React mínimo do Prumo, sem CSS
                                      e sem design system.
  make:schema [opções] <domínio>      Cria o schema (zod) de uma entidade, com
                                      os campos.
  make:usecase [opções] <nome>        Cria um use case (uma ação do app:
                                      tipos, classe, mock e teste) e o
                                      registra.
  make:page [opções] <nome>           Cria uma tela: index, model, view, teste,
                                      mensagens e rota.
  check [opções]                      Analisa o projeto e lista as violações da
                                      arquitetura.
  list [opções]                       Mostra o que o projeto tem: schemas, use
                                      cases, telas e idiomas.
  mcp [opções]                        Abre o servidor MCP do projeto, por stdio.
  help [comando]                      Mostra a ajuda de um comando.

Documentação: https://docs.prumo.matizze.com.br/reference/cli
```

A ajuda de cada comando é enxuta: uma ou duas linhas de descrição, as opções, uma seção `Exemplos:` com usos reais e a linha `Referência:` com o link da seção dele nesta página. O detalhe (o que cada comando cria, o que valida) está aqui.

`prumo help <comando>` mostra a ajuda do comando, o mesmo que `prumo <comando> --help`, e sai com 0. O `help` existe só na raiz: `prumo help make:page`.

O trecho do `.mcp.json` que `prumo mcp --help` mostra sai inteiro, sem quebra de linha, em qualquer largura de terminal, para copiar e colar.

## Códigos de saída

| Código | Quando                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------- |
| `0`    | Sem erro, inclusive `--help`, `--version`, `help` e `prumo` sem argumentos                               |
| `1`    | Erro inesperado ou, nos comandos que o definem, o resultado do comando (`check` com violação; `new` com o `pnpm install` que falhou) |
| `2`    | Uso errado: comando ou opção desconhecidos, argumento que falta ou a mais, opção sem valor, valor inválido, nome inválido, projeto ou domínio que não existe |

Os comandos que escrevem (`new` e os `make:*`) também saem com 2, sem escrever nada, quando um arquivo que iam gravar leva para fora do projeto por um link simbólico (o próprio `src`, uma pasta dentro dele ou um arquivo como o `App.tsx` sendo link para fora) ou passa por um link quebrado: antes de gravar, eles conferem o caminho real de cada arquivo, como o sistema o resolve, e a mensagem diz qual é o link. O `--dry-run` faz a mesma conferência. Link dentro do projeto que aponta para dentro dele continua valendo; link físico (hard link) não é detectado.

### Mensagens de erro

Todo erro começa com `prumo: ` e vai para o stderr. Há três formas.

**Erro de opção ou de argumento** (opção desconhecida, argumento que falta, valor inválido): a mensagem, a linha de uso do comando e como pedir a ajuda, sem a ajuda inteira:

```text
$ prumo make:page
prumo: falta o argumento <nome>.

Uso: prumo make:page [opções] <nome>
Veja 'prumo make:page --help'.
```

Na raiz, sem comando, o fim é `Veja 'prumo --help'.`. Quando há um nome parecido, a mensagem sugere: `prumo: comando desconhecido: 'make:pag'. Você quis dizer make:page?`.

**Erro do comando** (domínio que não existe, nome inválido, pasta que não é projeto): só a mensagem, que já diz o que fazer.

```text
$ prumo make:page livros --usecase livros.list-livros
prumo: o use case 'livros.list-livros' não existe.
```

**Erro inesperado** (um defeito, não um uso errado): sai com 1, a mensagem e como ver a pilha. A pilha só aparece com `PRUMO_DEBUG` ligado: qualquer valor que não seja vazio, `0` ou `false` (`PRUMO_DEBUG=1`, por exemplo):

```text
$ prumo list
prumo: erro inesperado: EACCES: permission denied
Rode de novo com PRUMO_DEBUG=1 para ver a pilha.

$ PRUMO_DEBUG=1 prumo list
prumo: erro inesperado: EACCES: permission denied
Error: EACCES: permission denied
    at ...
```

Se você abrir uma issue de um erro inesperado, rode antes com `PRUMO_DEBUG=1` e anexe a pilha.
