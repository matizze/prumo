# Referência da CLI

O comando `prumo`, do pacote [`@matizze/prumo-cli`](https://www.npmjs.com/package/@matizze/prumo-cli).

```text
prumo [opções] [comando]
```

| Comando                            | O que faz                                             |
| ---------------------------------- | ----------------------------------------------------- |
| [`new <nome>`](#prumo-new)         | Cria um app React organizado em camadas               |
| [`make:schema <domínio>`](#prumo-makeschema) | Cria o schema (zod) de uma entidade, com os campos |
| [`make:repository <domínio>`](#prumo-makerepository) | Cria o repositório de um domínio (contrato, mock e teste de contrato) e acrescenta fontes (`http`, `storage`) |
| [`make:query <domínio>`](#prumo-makequery) | Cria as queries e mutations de um domínio (chaves e hooks de lista, detalhe e escrita) |
| [`make:page <nome>`](#prumo-makepage) | Cria uma tela (index, model, view, teste), os textos e a rota |
| [`check`](#prumo-check)            | Confere a arquitetura do projeto                      |
| [`list`](#prumo-list)              | Mostra o que o projeto tem (schemas, repositórios, queries, telas, idiomas) |
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

Cria `<dir>/<nome>`: um app com Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next, os pacotes do Prumo (`core`, `rules`, `testing` e `cli`), a estrutura de pastas das camadas, os provedores (query, i18n e repositórios), a tela inicial `home` (a mesma que o `make:page` gera, na rota `/`), o `src/vite-env.d.ts` (com `VITE_DATA_SOURCE` e `VITE_API_URL`, opcionais), o ESLint com o plugin do Prumo, o Vitest com jsdom, o `AGENTS.md` e o `.mcp.json` (que registra o servidor [`prumo mcp`](#prumo-mcp) para agentes de IA). A fonte de dados padrão é `mock`. Veja o app criado em [Anatomia do app gerado](../concepts/generated-app.md).

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
- `id` e `createdAt` são reservados (o repositório os dá a todo registro), e um nome repetido é recusado.
- Espaços em volta dos nomes e dos tipos são aceitos.

O comando valida tudo antes de escrever: o nome (kebab-case, no plural, sem palavra reservada do JavaScript nem nome global como `Date`), a entidade, cada campo e o schema que já existe (nunca sobrescreve). Qualquer erro sai com 2, em português, sem deixar nada pela metade. No fim, mostra o que criou e alterou e o próximo passo: `prumo make:repository <domínio>`.

Quem lê os campos depois é o `make:repository`, direto do schema gerado. O leitor lê a árvore do arquivo (o enum pode ter várias linhas e vírgula no fim) e exige o que o `--fields` geraria: `id` e `createdAt` como `z.string()`, nomes de campo em camelCase sem aspas e enum com dois valores ou mais, simples e sem repetição. Um campo que o Prumo não reconhece (o schema foi editado à mão com outro tipo, como `z.string().min(3)`) é erro de uso, com o arquivo, a linha e o nome do campo.

## `prumo make:repository`

```text
prumo make:repository <domínio> [--entity <singular>] [--data-source <mock|http|storage>] [--root <pasta>] [--dry-run]
```

Cria o repositório do domínio com a fonte `mock` e o registra; com `--data-source http` ou `storage`, acrescenta também uma fonte de dados (veja [Fontes de dados](#fontes-de-dados)). Precisa do schema (`prumo make:schema`): os campos (busca, ordem, dados de exemplo e teste de contrato) saem do schema gerado, lido da árvore do arquivo, e por isso o comando não tem `--fields`. Um campo que o Prumo não reconhece (veja o fim da seção do `make:schema`) é erro de uso, com a linha do campo.

O comando também lê, do mesmo arquivo, o `.pick` do `<entidade>InputSchema` e os membros do `<Entidade>SortKey`: o `create`, o `update` e os dados de entrada do teste usam só os campos do `pick`, e os acessores de ordem e o teste de ordem só os da `SortKey`. Assim, um campo acrescentado à mão só ao `z.object` (ou tirado do `pick`, como um campo calculado pelo backend) gera um repositório que compila; o campo fora do `pick` recebe um valor de exemplo no mock. Só o `.pick({ campo: true, ... })` é aceito: um `<entidade>InputSchema` escrito com `.omit({ ... })` é erro de uso, e se reescreve listando no `.pick` os campos que sobram. A `SortKey` não pode ter campo booleano (o `--fields` também não ordena por booleano). Um `pick` ou uma `SortKey` que o comando não lê, ou com nome que não é campo, é erro de uso, com a linha.

- `src/repositories/<domínio>/repository.contract.ts`: o `I<Domínio>Repository`, o contrato único de todas as fontes (`list`, `get`, `create`, `update` e `remove`; id que não existe rejeita com `UIError('<ENTIDADE>_NOT_FOUND')`);
- `repository.mock.ts`: o `Mock<Domínio>Repository`, em memória, com latência simulada (300 ms; o teste usa 0). A busca olha os campos de texto, e a ordem aceita todos os campos, menos os booleanos, e o `createdAt`;
- `fixtures.ts`: três registros de exemplo, com valores coerentes com o tipo de cada campo;
- `repository.contract.test.ts`: o teste de contrato, que roda contra o mock;
- `index.ts`: a fábrica `create<Domínio>Repository`, que devolve o mock.

Também altera:

- `src/repositories/index.ts` (o container): o `import` da fábrica, o `export *` da pasta e a entrada no mapa `factories`, cada um em ordem alfabética;
- `src/messages/<idioma>/errors.json` de cada idioma: o texto de `<ENTIDADE>_NOT_FOUND` (`CLIENTE_NOT_FOUND`), para a tela mostrar a mensagem do erro e não a genérica. A chave que já existe não é trocada, e num app sem o `errors.json` o comando avisa e segue.

O `<domínio>` e o `--entity` são os do `make:schema`: se o schema saiu com `--entity pao`, o repositório também leva `--entity pao`.

| Opção                   | O que faz                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `--entity <singular>`   | A entidade, no singular, a mesma do `make:schema`. Padrão: o nome sem o `s` final                     |
| `--data-source <fonte>` | `mock` (padrão), `http` ou `storage`. Outro valor sai com 2                                           |
| `--root <pasta>`        | A pasta do projeto, a que tem o `src`. Padrão: [a busca](#a-busca-do-projeto) a partir da pasta atual |
| `--dry-run`             | Lista o que seria criado e alterado, sem escrever nada                                                |

O comando valida tudo antes de escrever e nunca sobrescreve. Saem com 2, sem deixar nada pela metade: a fonte que não existe (`--data-source graphql`), a fonte que o repositório já tem, o schema que falta (a mensagem traz o `prumo make:schema` com o `--entity` certo e, se há schemas sem repositório, lembra de repetir o `--entity` e lista os nomes deles), o repositório que já existe (sem `--data-source`, ou com `mock`), um campo do schema que não se lê e um container (`src/repositories/index.ts`) sem o mapa `factories`. No fim, mostra o que criou e alterou e o próximo passo: `prumo make:query <domínio>`.

### Fontes de dados

O contrato (`I<Domínio>Repository`) é o formato único, e todas as fontes o implementam; o teste de contrato prova que elas se comportam igual. O app escolhe a fonte pela variável `VITE_DATA_SOURCE` (`mock` quando falta; um valor fora de `DATA_SOURCES` lança erro na inicialização), e a fábrica do domínio devolve a implementação da fonte, ou o mock quando o domínio não tem a fonte.

- Sem `--data-source` (ou com `mock`): o comportamento de cima. O repositório que já existe sai com 2.
- Com `http` ou `storage`: se o repositório não existe, o comando cria o repositório completo (com o mock) e acrescenta a fonte; se já existe, acrescenta só a fonte. A fonte que já existe (`repository.<fonte>.ts`) sai com 2.

Cada fonte acrescentada:

- cria `repository.<fonte>.ts`;
- acrescenta a fonte ao `DATA_SOURCES` de `src/repositories/options.ts`, se ainda não está lá;
- acrescenta à fábrica `src/repositories/<domínio>/index.ts` o import, o export da classe e a linha `if (dataSource === '<fonte>') return new ...`, antes do `return` do mock (a fábrica passa a receber `{ dataSource, latencyMs }`);
- acrescenta ao `repository.contract.test.ts` uma chamada do `runContractSuite` para a fonte.

| Fonte     | Arquivo                 | Como funciona                                                                                                                                                                                       |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mock`    | `repository.mock.ts`    | Em memória, com as fixtures e latência simulada. É a padrão e a dos testes.                                                                                                                         |
| `storage` | `repository.storage.ts` | A classe `Storage<Domínio>Repository`: o mock gravando no `localStorage`, com a chave `<nome do app>:<domínio>` (o nome é o `name` do `package.json`). Começa com as fixtures, aceita `latencyMs` e usa a mesma busca, ordem e paginação do mock. O teste de contrato limpa a chave antes de cada repositório novo. |
| `http`    | `repository.http.ts`    | A classe `Http<Domínio>Repository`: `fetch` na API pelo cliente `src/repositories/http.ts`. O backend responde no formato do app (`{ items, total }`, com os campos do schema) e o repositório só valida cada resposta com o schema, sem traduzir formato. A lista envia `search`, `sort=<campo>:<asc\|desc>`, `page` e `page_size`; o id vai codificado na URL; o `update` é `PATCH` (o contrato aceita `Partial<Input>`); o 404 vira `UIError('<ENTIDADE>_NOT_FOUND')`. |

Na primeira fonte `http` do app, o comando cria também `src/repositories/http.ts` (o cliente, com `createHttp`, `HttpError` e o tipo `Http`), `src/repositories/api.ts` (a instância, com `import.meta.env.VITE_API_URL || '/api'` e o lugar comentado do token da sessão) e `src/vite-env.d.ts`, se faltar. Das vezes seguintes, reaproveita os que já existem. Em qualquer fonte que não é o mock, o comando também cria o `src/vite-env.d.ts` se faltar e troca, no container, o `resolveDataSource(undefined, DATA_SOURCES, 'mock')` de um app antigo pela versão que lê a `VITE_DATA_SOURCE` (container com outra forma fica como está, e o comando avisa como ligar). O cliente HTTP só lê o corpo quando ele é JSON (`content-type` com `json`, ou texto que começa com `{` ou `[`; corpo vazio ou outro texto vira `undefined`), tira a barra do fim do endereço e trata a `VITE_API_URL` vazia como ausente. O storage confere cada registro com o schema na leitura (descarta só o inválido, com aviso) e antes de gravar (rejeita com `UIError('<ENTIDADE>_INVALID')`, cujo texto o comando acrescenta ao `errors.json`). O contrato do `http` só roda com uma API de teste (`API_TEST_URL`); sem ela fica pulado, com o motivo no título. O guia [Ligar uma API real](../guides/real-api.md) mostra o `.env`, o token e o teste contra uma API de teste.

## `prumo make:query`

```text
prumo make:query <domínio> [--entity <singular>] [--root <pasta>] [--dry-run]
```

Cria as queries e as mutations de um domínio, em cima do repositório dele. Precisa do repositório (`prumo make:repository`); sem ele, sai com 2 e diz o comando a rodar (`rode prumo make:repository <domínio>`, com `--entity` quando a entidade não é a automática).

Cria `src/queries/<domínio>.ts` com:

| Nome                          | O que é                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `<entidade>Keys`              | As chaves do cache (`all`, `lists`, `list(consulta)` e `detail(id)`), por `createQueryKeys` do core      |
| `<entidade>Queries`           | As opções (`queryOptions`) de `list` e `detail`, que recebem o repositório                               |
| `use<Domínio>List`            | A lista, com a consulta (busca, ordem, página) e as opções do `useQuery`; mantém a consulta anterior na tela até a nova chegar |
| `use<Entidade>Detail`         | O detalhe de um registro pelo id                                                                         |
| `useCreate<Entidade>`         | Cria; invalida tudo do domínio                                                                           |
| `useUpdate<Entidade>`         | Atualiza (`{ id, input }`, com `Partial` da entrada); invalida tudo do domínio                           |
| `useRemove<Entidade>`         | Remove; tira o detalhe do cache e invalida só as listas. Uma tela de detalhe que continua montada busca de novo e recebe `<ENTIDADE>_NOT_FOUND`: depois de remover, saia da tela |
| `<Domínio>ListOptions`        | O tipo das opções do `useQuery` que a lista aceita                                                        |

E registra o domínio em `src/queries/index.ts`, com um `export { ... } from './<domínio>'` em ordem alfabética (com os mesmos nomes, o tipo `<Domínio>ListOptions` entre eles como `type`, de modo que `@/queries` e `@/queries/<domínio>` servem). Os hooks usam só o contrato do repositório, pelo `useRepositories()`: valem para qualquer fonte (mock, storage ou http) e o comando não lê os campos do schema. O `--entity` é o mesmo do `make:schema` e do `make:repository`.

O comando valida tudo antes de escrever e nunca sobrescreve: repositório que falta, arquivo do schema que falta (só a existência, os campos não são lidos), repositório de outra entidade (o `repository.contract.ts` usa outro `<Entidade>Schema`: o `--entity` esquecido ou a mais; a mensagem diz o `--entity` certo), query que já existe (o arquivo) ou só o export que sobrou no índice, e índice que falta saem com 2, sem deixar nada pela metade. `--dry-run` lista o que seria criado e alterado, sem escrever. No fim, mostra o que fez e o próximo passo: `prumo make:page <domínio> --query <domínio>`.

## `prumo make:page`

```text
prumo make:page <nome> [--query <domínio>] [--path <caminho>] [--root <pasta>] [--dry-run]
```

Cria uma tela: `src/pages/<nome>/` com `index.tsx` (liga o model à view), `model.ts` (dados e textos, sem JSX), `view.tsx` (só tags nativas, recebe tudo por props) e `index.test.tsx` (renderiza com o `renderWithProviders` de `@/test/render` e confere o título), e as mensagens em `src/messages/<idioma>/<nome>.json`, nos idiomas do projeto. Registra o namespace nos índices de mensagens de cada idioma e a rota no `src/App.tsx`. O `<nome>` vai em kebab-case (`clientes`, `pedidos-recentes`).

Para agrupar telas em subpastas, separe os segmentos do nome com ponto ou barra, as duas formas com o mesmo resultado:

```bash
prumo make:page auth.login      # o mesmo que auth/login
```

Cria `src/pages/auth/login/` (a tela comum, com `index.tsx`, `model.ts`, `view.tsx` e o teste), a rota padrão `/auth/login` (o `--path` continua valendo), o componente `AuthLoginPage` e as mensagens em `src/messages/<idioma>/auth-login.json`, com o namespace `authLogin`: o componente, as mensagens e o namespace saem dos segmentos juntos. Cada segmento segue as regras de nome (kebab-case, sem palavra reservada), a mensagem de erro diz qual é o inválido, e segmento vazio (`auth..login`, `/login`, `auth/`) é recusado. O `prumo list` e as ferramentas MCP mostram o nome com barra (`auth/login`). Uma tela é a primeira pasta, a partir de `src/pages`, que tem `index.tsx`; a pasta sem ele (`auth`) só agrupa telas.

| Opção               | O que faz                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `--query <domínio>` | O domínio cuja query a tela usa (`clientes`). Precisa de `src/queries/<domínio>.ts`. Padrão: nenhum   |
| `--path <caminho>`  | O caminho da rota, com um parâmetro opcional (`/clientes/:id`). Padrão: `/<nome>`, com a barra no lugar do ponto (`/auth/login`) |
| `--root <pasta>`    | A pasta do projeto, a que tem o `src`. Padrão: [a busca](#a-busca-do-projeto) a partir da pasta atual |
| `--dry-run`         | Só lista o que seria criado e alterado, sem escrever nada                                             |

As quatro variações:

| `--query` | Parâmetro no `--path` | A tela                                                                                                                         |
| --------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| não       | não                   | Só o título                                                                                                                    |
| sim       | não                   | A lista: o model usa `use<Domínio>List` e a view mostra o carregando, o erro e a lista                                          |
| não       | sim                   | O model lê o parâmetro com o `useParams` do wouter e a view o mostra; o teste renderiza a tela dentro da `<Route>`              |
| sim       | sim                   | O detalhe: o model busca o registro com `use<Entidade>Detail` e a view mostra o carregando, o erro e o registro                 |

Com `--query`, a query precisa existir; sem ela, sai com 2 e diz o comando (`rode prumo make:query <domínio>`). A entidade sai do contrato do repositório (`repository.contract.ts`), sem `--entity`. A lista e o detalhe mostram um campo de texto do registro, lido do schema que o projeto tem hoje: o primeiro campo `string` obrigatório (ou, sem ele, o primeiro opcional). Sem campo de texto, ou sem conseguir ler o schema, a tela mostra o `id` e o comando avisa, sem falhar; na tela de detalhe, um campo sem valor no primeiro registro das fixtures também cai no `id`. Com `--query`, as mensagens ganham os textos `loading` e `failed`.

O `--path` começa com `/`, tem segmentos fixos (letras, números, `-`, `_`, `.` e `~`) e **no máximo um parâmetro** `:nome` (sem `?`, `*` nem `+`). A rota entra no `<Switch>` do `App.tsx` depois da última rota com `path` e antes da curinga, porque o wouter mostra a primeira que casa. Uma tela de detalhe que continua montada depois do `useRemove<Entidade>` recebe `<ENTIDADE>_NOT_FOUND`: saia da tela ao remover.

O comando valida tudo antes de escrever e nunca sobrescreve. Saem com 2, sem deixar nada pela metade: nome inválido ou reservado (ou com segmento vazio); tela que já existe; tela dentro de outra tela (`auth/login` com `src/pages/auth/index.tsx`); pasta que já agrupa telas (`auth` com `src/pages/auth/login/index.tsx`); nome que dá o mesmo componente e as mesmas mensagens de outra tela (`auth/login` e `auth-login`, e a mensagem diz o conflito); `--path` inválido, com rota repetida ou que conflita com uma do `App.tsx`; query que falta, ou sem o `use<Domínio>List` (ou, no detalhe, sem o `use<Entidade>Detail`); `App.tsx` ou índice de mensagens que falta. No fim, mostra o que fez, os avisos e o comando dos testes da tela nova.

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

Repositórios (1):
  livros  Livro  fontes: mock, http, storage

Queries (1):
  livros  Livro  useLivrosList, useLivroDetail, useCreateLivro, useUpdateLivro, useRemoveLivro

Telas (2):
  livro  rota: /livros/:id  detalhe  query: livros
  sobre  rota: nenhuma  título

Idiomas (2):
  en
  pt-BR
```

Na linha da tela, a variação tem rótulo em português (`título`, `lista`, `parâmetro` ou `detalhe`; o `--json` traz os valores em inglês, abaixo). `rota: curinga` é a `<Route>` sem `path` (ou com `path="*"`), `rota: {expressão} (expressão)` é um `path` que não é literal e `rota: nenhuma` é a tela que nenhuma `<Route>` usa. Um schema que o leitor do Prumo recusa (editado à mão com algo fora dos tipos do `--fields`) aparece como `editado à mão (<motivo>)`, com a primeira linha da mensagem do leitor (no máximo 160 caracteres).

| Opção            | O que faz                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `--root <pasta>` | A pasta do projeto, a que tem o `src`. Padrão: [a busca](#a-busca-do-projeto) a partir da pasta atual |
| `--json`         | Escreve o levantamento em JSON, no formato abaixo                                                     |

### A saída `--json`

Um objeto com cinco listas, sempre presentes (vazias quando não há nada), ordenadas pelo nome do arquivo ou da pasta (comparação fixa, a mesma em qualquer máquina). Os tipos estão no `ProjectListing` (exportado por `@matizze/prumo-cli`).

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
  "repositories": [{ "domain": "livros", "entity": "Livro", "sources": ["mock", "http", "storage"] }],
  "queries": [
    {
      "domain": "livros",
      "file": "src/queries/livros.ts",
      "entity": "Livro",
      "hooks": ["useLivrosList", "useLivroDetail"]
    }
  ],
  "pages": [
    {
      "name": "livro",
      "route": "/livros/:id",
      "routeKind": "literal",
      "routePartial": false,
      "variation": "detail",
      "query": "livros"
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
| `repositories` | `domain`    | O nome da pasta em `src/repositories`                                                                                                  |
|                | `entity`    | A entidade lida do contrato (`repository.contract.ts`); `null` se o contrato não existe ou não diz                                     |
|                | `sources`   | As fontes que existem, em ordem: `mock`, `http`, `storage`. Uma fonte conta quando o arquivo `repository.<fonte>.ts` existe e a fábrica (`index.ts`) a escolhe |
| `queries`      | `domain`    | O nome do arquivo (ou pasta) em `src/queries`                                                                                          |
|                | `file`      | O arquivo, relativo à raiz                                                                                                             |
|                | `entity`    | A entidade (do contrato do repositório, ou do hook `use<Entidade>Detail`); `null` se nenhum diz                                        |
|                | `hooks`     | Os hooks (`use...`) que o arquivo exporta, na ordem do arquivo                                                                         |
| `pages`        | `name`      | O nome da pasta em `src/pages`                                                                                                         |
|                | `route`     | A rota da tela no `src/App.tsx`: o `path` da `<Route>` mais interna que a usa, composto com os `<Route nest>` de fora (`/admin` + `/usuarios` vira `/admin/usuarios`); `*` para a curinga (sem `path`, ou `path="*"`); o texto da expressão de um `path={...}` que não é literal (por exemplo, `{ROUTES.lenta}`); `null` só quando nenhuma `<Route>` usa a tela. A tela pode vir de um `import` padrão ou de um `lazy(() => import('@/pages/<nome>'))` |
|                | `routeKind` | `literal`, `catchAll` ou `expression`; `null` quando `route` é `null`                                                                  |
|                | `routePartial` | `true` quando um `<Route nest>` de fora não tem `path` literal e não deu para compor: `route` é só o caminho da `<Route>` de dentro |
|                | `variation` | `title` (só o título), `list` (com query), `param` (rota com parâmetro) ou `detail` (query e parâmetro)                                  |
|                | `query`     | O domínio da query que o model da tela importa de `@/queries`; `null` se não usa                                                        |
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
- **Entrada:** os argumentos posicionais (obrigatórios) e as opções, com nomes em snake_case sem acento: `<domínio>` vira `dominio`, `--data-source` vira `data_source`, `--dry-run` vira `dry_run`. Opção com valor é `string` (com `enum` quando o comando lista os valores); opção sem valor é `boolean`; `--no-<x>` vira `<x>: boolean`, com `true` de padrão. O posicional não pode começar com `-`. Campo fora do esquema é recusado.
- **Fora da entrada:** `--root`, `--help` e `--version`. Nenhuma ferramenta recebe a pasta: o agente só escreve no projeto onde o servidor abriu. No `list`, o `--json` também não é campo: a ferramenta sempre o passa.

| Ferramenta        | Parâmetros                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `make_schema`     | `dominio` (obrigatório), `entity`, `fields`, `dry_run`                                   |
| `make_repository` | `dominio` (obrigatório), `entity`, `data_source` (`mock`, `http` ou `storage`), `dry_run` |
| `make_query`      | `dominio` (obrigatório), `entity`, `dry_run`                                             |
| `make_page`       | `nome` (obrigatório), `query`, `path`, `dry_run`                                         |
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
  make:repository [opções] <domínio>  Cria o repositório de um domínio
                                      (contrato, mock e teste de contrato) ou
                                      acrescenta uma fonte.
  make:query [opções] <domínio>       Cria as queries e mutations de um domínio
                                      (chaves, hooks de lista, detalhe e
                                      escrita).
  make:page [opções] <nome>           Cria uma tela: index, model, view, teste,
                                      mensagens e rota.
  check [opções]                      Analisa o projeto e lista as violações da
                                      arquitetura.
  list [opções]                       Mostra o que o projeto tem: schemas,
                                      repositórios, queries, telas e idiomas.
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
$ prumo make:query livros
prumo: falta o repositório livros (src/repositories/livros); rode prumo make:repository livros.
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
