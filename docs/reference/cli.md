# Referência da CLI

O comando `prumo`, do pacote [`@matizze/prumo-cli`](https://www.npmjs.com/package/@matizze/prumo-cli).

```text
prumo <comando> [opções]
```

| Comando                                     | Resumo                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`new`](#prumo-new)                         | Cria um app React mínimo do Prumo, sem CSS e sem design system                          |
| [`make:page`](#prumo-makepage)              | Gera uma tela: index, model, view, teste, mensagens e rota                              |
| [`make:domain`](#prumo-makedomain)          | Gera um domínio de dados: schema, repositório com mock, queries e teste de contrato     |
| [`make:component`](#prumo-makecomponent)    | Gera um componente, só com elementos HTML, e o teste dele                               |
| [`move:component`](#prumo-movecomponent)    | Promove um componente de uma tela a compartilhado, com o teste e os imports              |
| [`check`](#prumo-check)                     | Analisa o projeto e lista as violações da arquitetura                                   |
| [`doctor`](#prumo-doctor)                   | Confere o ambiente e o projeto: Node, pnpm, pacotes do Prumo e `.mcp.json`              |

## Como rodar

Num app criado pelo `prumo new`, a CLI é dependência de desenvolvimento:

```bash
pnpm exec prumo <comando>
```

Fora de um app (para criar um), sem instalar nada:

```bash
pnpm dlx @matizze/prumo-cli new meu-app
```

A ajuda, em português, mostra a sintaxe, a descrição completa e as opções de cada comando:

```bash
pnpm exec prumo --help
pnpm exec prumo make:page --help
```

## Comportamento comum

**Nomes.** Telas, domínios, componentes e apps são nomeados em **kebab-case**: letras minúsculas, números e hífen, começando por letra (`pedidos-recentes`, `relatorio-2026`). O Prumo deriva os outros nomes:

| Forma      | Exemplo de `pedidos-recentes` | Onde aparece                                 |
| ---------- | ----------------------------- | -------------------------------------------- |
| kebab-case | `pedidos-recentes`            | Pastas, arquivos, rota, JSON de mensagens    |
| PascalCase | `PedidosRecentes`             | Componentes, tipos, hooks (`usePedidosRecentesModel`) |
| camelCase  | `pedidosRecentes`             | Namespace de textos, variáveis               |

Um nome que vira palavra reservada do JavaScript (`new`, `class`, `default`, `delete`...) é recusado. Para domínios e componentes, também um nome que esconderia um global do JavaScript ou do TypeScript (`date`, `record`, `promise`, `map`...).

**Validação antes de escrever.** Todo gerador confere o nome, o projeto e os conflitos antes de escrever qualquer coisa, e monta as mudanças em memória: um erro no meio do caminho não deixa o projeto pela metade.

**Nunca sobrescreve.** Uma tela, um domínio ou um componente que já existe é recusado.

**`--dry-run`.** Todo gerador lista o que seria criado e alterado, sem escrever nada.

**`--root <pasta>`.** Os comandos que agem num projeto aceitam a pasta dele (a que tem `package.json` e `src`). O padrão é a pasta atual. Uma pasta que não existe, não é pasta ou não tem `package.json` e `src` é erro de uso (o `doctor` exige só o `package.json`).

**`prumo check` no fim.** Os geradores `make:*` rodam a análise da arquitetura depois de escrever e mostram o resultado, seguido do próximo passo e do comando dos testes do que foi gerado. O comando só falha (código 1) pelas violações que **ele** causou: antes de escrever, ele roda o `check` e guarda o resultado, e a violação que já existia (a mesma regra, arquivo e mensagem) aparece rotulada como **preexistente** (`Preexistentes (N; já estavam no projeto antes deste comando...)`) e não muda o código de saída. Sem violação nova, a primeira linha é `prumo check: nenhuma violação nova.` O `prumo check` em si não muda: ele lista tudo.

### Códigos de saída

| Código | Significado                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| `0`    | Sucesso                                                                                                        |
| `1`    | O `check` achou violação (no fim de um `make:*`, só a violação nova, causada pelo comando, com os arquivos já gerados), o `doctor` achou erro, o `pnpm install` do `new` falhou, ou erro inesperado |
| `2`    | Uso errado: comando ou opção desconhecidos, argumento que falta, nome inválido, pasta que não é projeto, arquivo que já existe, ponto de registro que falta |

A mensagem de erro vai para o stderr; no erro de uso, seguida da ajuda do comando.

---

## `prumo new`

Cria um app React mínimo do Prumo.

```text
prumo new <nome> [--dir <pasta>] [--packages <pasta>] [--no-install] [--dry-run]
```

| Argumento ou opção  | Descrição                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `<nome>`            | O nome do app, em kebab-case: a pasta e o `name` do `package.json`. No máximo 214 caracteres.                    |
| `--dir <pasta>`     | A pasta onde criar `<nome>`. Padrão: a pasta atual.                                                             |
| `--packages <pasta>` | Uma pasta com os tarballs dos cinco pacotes `@matizze/prumo-*`, instalados no lugar do registry (veja abaixo). |
| `--no-install`      | Não roda o `pnpm install`: só cria os arquivos.                                                                 |
| `--dry-run`         | Só lista o que seria criado.                                                                                    |

**O que faz:**

1. Valida o nome, o destino (`<dir>/<nome>` não pode existir com conteúdo; uma pasta vazia serve) e, com `--packages`, os tarballs.
2. Monta o app numa pasta temporária e só o leva ao destino se tudo deu certo.
3. Roda `git init`, sem commit (o primeiro commit é seu). Se o git falhar, só avisa.
4. Roda `pnpm install`, a não ser com `--no-install`. Se a instalação falhar, sai com 1, mantém o app criado e diz como seguir.
5. Mostra os próximos passos (o `verify`, o `dev`, os geradores com `<domínio>` e `<tela>` no lugar do nome e o endereço da documentação).

**O app criado** tem Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next; os cinco pacotes do Prumo; a estrutura de pastas; os provedores; a tela inicial `home` na rota `/`; ESLint com o plugin do Prumo; Vitest com jsdom; o tratamento de erro ligado (o namespace `errors` nos dois idiomas, o `src/errors.ts` com o `getErrorMessage` e o `providers/app.tsx` usando-o); o `src/test/setup.ts` com o idioma padrão fixado; o `AGENTS.md`, o `README.md` e o `.mcp.json`. Os scripts são `dev`, `build`, `typecheck`, `lint`, `check`, `test` e `verify` (`typecheck && lint && test && check`: os testes rodam antes do `check`, que pode falhar por causa de um componente `shared` recém-gerado). O detalhe de cada arquivo está em [Anatomia do app gerado](../concepts/generated-app.md).

**Versões.** As bibliotecas de terceiros entram com as versões fixadas nos modelos da CLI. Os pacotes do Prumo entram como `^<versão>`, cada um com a própria versão, registrada na CLI a cada lançamento (os pacotes versionam separados). O `packageManager` do `package.json` recebe a versão do pnpm que rodou o comando (pelo `npm_config_user_agent`, ou por `pnpm --version`); sem nenhuma das duas, o campo fica de fora.

**`--packages`.** Para testar versões ainda não publicadas: a pasta precisa ter os tarballs dos cinco pacotes (os que o `pnpm pack:all` gera no monorepo do Prumo), e o `package.json` do app ganha `pnpm.overrides` com `file:` para cada um.

**Exemplos:**

```bash
pnpm dlx @matizze/prumo-cli new loja
pnpm dlx @matizze/prumo-cli new loja --dir ~/projetos --no-install
pnpm dlx @matizze/prumo-cli new loja --dry-run
```

---

## `prumo make:page`

Gera uma tela.

```text
prumo make:page <nome> [--domain <domínio>] [--path <caminho>] [--root <pasta>] [--dry-run]
```

| Argumento ou opção    | Descrição                                                                 |
| --------------------- | ------------------------------------------------------------------------- |
| `<nome>`              | O nome da tela, em kebab-case.                                             |
| `--domain <domínio>`  | Um domínio cuja lista a tela mostra. Padrão: nenhum.                       |
| `--path <caminho>`    | O caminho da rota, com no máximo um parâmetro (`/clientes/:id`). Padrão: `/<nome>`. |
| `--root <pasta>`      | A pasta do projeto. Padrão: a atual.                                       |
| `--dry-run`           | Só lista o que seria criado e alterado.                                    |

**Cria:**

| Arquivo                               | Conteúdo                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/pages/<nome>/index.tsx`          | `<Nome>Page`: chama o model e entrega à view                                                     |
| `src/pages/<nome>/model.ts`           | `use<Nome>Model` e o tipo `<Nome>Model`: o título (e, com `--domain`, a lista e os estados)       |
| `src/pages/<nome>/view.tsx`           | `<Nome>View`: HTML semântico, recebe o model por props                                           |
| `src/pages/<nome>/index.test.tsx`     | Renderiza com o `renderWithProviders` e confere o título (e, com `--domain`, a lista)             |
| `src/messages/<idioma>/<nome>.json`   | Em cada idioma do projeto: `title` (e, com `--domain`, `loading` e `failed`)                      |

Os idiomas do projeto são as pastas de `src/messages` que têm `index.ts`. Os idiomas `pt*` recebem os textos em português; os outros, em inglês, para traduzir.

**Altera:**

- `src/messages/<idioma>/index.ts`: o import do JSON e o namespace (`<nome>` em camelCase) no `export default`, em ordem alfabética.
- `src/App.tsx`: o import da tela (na ordem dos imports de `@/pages`) e a rota (`/<nome>`, ou a de `--path`), depois da última `<Route>` com `path` do `<Switch>` mais externo. Uma rota curinga continua por último.

**Com `--domain <domínio>`**, o model lê a lista com `use<Domínio>List()` de `@/queries/<domínio>` e devolve `{ title, loadingText, failedText, items, loading, failed }`, e a view mostra o carregando, o erro (`role="alert"`) e a lista (`<ul>`), com o **primeiro campo de texto** de cada registro. O comando confere antes que `src/queries/<domínio>.ts` existe e tem o hook.

O campo vem do schema que o projeto tem hoje (`src/schemas/entities/<entidade>.ts`; o app pode tê-lo editado depois do `make:domain`): o primeiro `z.string()` obrigatório, fora `id` e `createdAt`; se todos os de texto são opcionais, o primeiro deles. Sem campo de texto, ou se o schema não for encontrado, a tela mostra o `id` e o comando avisa na saída (`Aviso: ...`).

**Com `--path <caminho>`**, a rota é a do caminho, em vez de `/<nome>`. O caminho começa com `/`, tem segmentos fixos (letras, números, `-`, `_`, `.`, `~`) e **no máximo um parâmetro** `:nome` (um identificador; sem `?`, `*` nem `+`). Sem parâmetro, só a rota muda. Com parâmetro (`/livros/:id`):

- o model lê o valor com o `useParams` do wouter e devolve `{ title, params: { id } }`, e a view o mostra;
- o teste renderiza a tela dentro de `<Route path="/livros/:id">`, com o caminho inicial `/livros/exemplo`, e confere que o valor chega à tela (veja [Testes](../guides/test.md#rotas-com-parâmetro));
- junto de `--domain`, a tela é de **detalhe**: o model busca o registro com o `use<Entidade>Detail(id)` do domínio e devolve `{ title, loadingText, failedText, item, loading, failed }`; a view mostra o carregando, o erro e esse mesmo campo de texto; os textos `loading` e `failed` entram nos JSONs; o teste usa o id do primeiro registro do mock (`<entidade>-1`) e espera o valor desse campo no primeiro registro das fixtures (lido de `src/repositories/<domínio>/fixtures.ts`; num domínio sem `--fields`, `Exemplo 1`). O comando confere antes que `src/queries/<domínio>.ts` tem o hook `use<Entidade>Detail`.

**Recusa (código 2):** nome inválido ou reservado; `--path` inválido (sem `/` no começo, com barra no fim ou `//`, segmento com caracteres fora dos permitidos, parâmetro com modificador ou nome inválido, mais de um parâmetro), ou que repete ou conflita com uma rota do `App.tsx`; tela que já existe; domínio que não existe ou sem o hook de lista; projeto sem `src/messages` ou sem idioma; `index.ts` de mensagens sem `export default { ... }`; namespace já registrado com outro arquivo; `App.tsx` sem `<Switch>`; rota que repete ou conflita com outra.

**Exemplos:**

```bash
pnpm exec prumo make:page relatorios
pnpm exec prumo make:page clientes --domain clientes
pnpm exec prumo make:page livro --path /livros/:id
pnpm exec prumo make:page cliente --domain clientes --path /clientes/:id
pnpm exec prumo make:page pedidos-recentes --dry-run
```

---

## `prumo make:domain`

Gera um domínio de dados.

```text
prumo make:domain <nome> [--entity <singular>] [--fields <campos>] [--root <pasta>] [--dry-run]
```

| Argumento ou opção     | Descrição                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `<nome>`               | O nome do domínio, **no plural** e em kebab-case.                                    |
| `--entity <singular>`  | A entidade, no singular. Padrão: o nome sem o `s` final.                             |
| `--fields <campos>`    | Os campos da entidade, `nome:tipo` separados por vírgula. Padrão: só `name:string`.  |
| `--root <pasta>`       | A pasta do projeto. Padrão: a atual.                                                 |
| `--dry-run`            | Só lista o que seria criado e alterado.                                              |

**A entidade.** Sem `--entity`, o singular é o nome sem o `s` final (`clientes` → `cliente`). O comando recusa, pedindo `--entity`, o nome que não termina em `s` e os plurais em que a regra erra: os terminados em `ies`, `sses`, `xes`, `ches` e `shes` (com o singular provável na mensagem: `categories` sugere `--entity category`) e os terminados em `us` e `ss`, que parecem singulares (`status`, `address`). A entidade precisa diferir do nome do domínio.

**Os campos (`--fields`).** Uma lista `nome:tipo` separada por vírgula, entre aspas: `"titulo:string,ano:number,apelido?:string"`. O nome é camelCase (letra minúscula primeiro; só letras e números); o tipo é `string`, `number`, `int` (inteiro), `boolean`, `date` (`AAAA-MM-DD`), `datetime` (ISO com hora) ou `enum(a|b|c)` (um valor da lista: no mínimo dois, sem repetir, cada um com letras, números e `_`, começando por letra; as aspas do `--fields` protegem o `|` e os parênteses do shell); um `?` depois do nome torna o campo opcional. Sem `--fields`, a entidade tem só `name`, de texto, e a saída é a de sempre.

| Tipo       | Schema (zod)         | Valor de exemplo nas fixtures        |
| ---------- | -------------------- | ------------------------------------ |
| `string`   | `z.string()`         | `Titulo 1`, `Titulo 2`, `Titulo 3`   |
| `number`   | `z.number()`         | `10`, `20`, `30`                     |
| `int`      | `z.number().int()`   | `10`, `20`, `30`                     |
| `boolean`  | `z.boolean()`        | `true`, `false`, `true`              |
| `date`     | `z.iso.date()`       | `2026-01-05`, `2026-01-14`, ...      |
| `datetime` | `z.iso.datetime()`   | `2026-01-05T12:00:00.000Z`, ...      |
| `enum(a\|b\|c)` | `z.enum(['a', 'b', 'c'])` | `a`, `b`, `c` (os valores da lista, em ordem) |

Com os campos, saem coerentes: o schema e o `...InputSchema` (todos os campos, sem `id` nem `createdAt`); a `...SortKey` (os campos que ordenam, todos menos `boolean`, e `createdAt`; o `enum` entra, mas o teste de ordem do contrato usa outro campo, porque o enum repete valores); as fixtures; o mock (a busca nos campos de texto, ou no `id` se não há texto; a ordem por cada campo que ordena; `create` e `update` com todos os campos); e o teste de contrato. O `make:page --domain` lê o schema que existe e mostra o primeiro campo de texto obrigatório, e o `enum` não conta como texto: um domínio só com enums mostra o `id`, com um aviso (veja [`make:page`](#prumo-makepage)). Com muitos campos, o código gerado quebra o `pick` do schema de entrada, a busca do mock e a entrada do teste de contrato em várias linhas (2 espaços, vírgula no fim) quando a linha passaria de cerca de 100 colunas; o `prumo make:*` não formata o resto, e vale rodar o formatador do projeto. Recusa (código 2), sem escrever nada: lista vazia, item fora do formato `nome:tipo`, nome que não é camelCase, `id` e `createdAt` (reservados), nome repetido, tipo desconhecido e `enum` mal formado (sem valores, com menos de dois, com valor repetido ou com valor que não é identificador simples).

**Cria** (para `clientes`, entidade `cliente`):

| Arquivo                                                  | Conteúdo                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/schemas/entities/cliente.ts`                        | `clienteSchema` (zod: `id`, `name`, `createdAt`), `ClienteSchema`, `clienteInputSchema`, `ClienteInput`, `ClienteSortKey` e `ClienteListQuery` |
| `src/repositories/clientes/repository.contract.ts`       | `IClientesRepository`: `list`, `get`, `create`, `update`, `remove`                                          |
| `src/repositories/clientes/repository.mock.ts`           | `MockClientesRepository` (latência padrão de 300 ms) e `MockClientesRepositoryOptions`                       |
| `src/repositories/clientes/fixtures.ts`                  | `MOCK_CLIENTES`, três registros de exemplo                                                                  |
| `src/repositories/clientes/index.ts`                     | `createClientesRepository` e os exports do domínio                                                          |
| `src/repositories/clientes/repository.contract.test.ts`  | O contrato com `defineContractSuite` e `runContractSuite`, contra o mock                                    |
| `src/queries/clientes.ts`                                | `clienteKeys`, `clienteQueries`, `useClientesList`, `useClienteDetail`, `useCreateCliente`, `useUpdateCliente`, `useRemoveCliente` |

**Altera:**

- `src/schemas/index.ts`: `export * from './entities/cliente'`.
- `src/repositories/index.ts`: o import da fábrica, o `export * from './clientes'` e a entrada `clientes: createClientesRepository` no mapa `factories`, em ordem alfabética.
- `src/queries/index.ts`: o export das keys, das queries e dos hooks.

Os três índices podem começar vazios, como os de um app novo.

**Textos de erro.** Acrescenta `<ENTIDADE>_NOT_FOUND` (para `cliente`, `CLIENTE_NOT_FOUND`: o código que o mock lança) ao `src/messages/<idioma>/errors.json` de cada idioma, com "Registro não encontrado." nos idiomas `pt*` e "Record not found." nos outros, para você ajustar. A chave que já existe não é trocada. Num app criado antes de o `new` gerar o namespace de erros (sem `errors.json`), o comando avisa e segue, sem falhar.

**Aviso:** se o projeto não tem `src/providers/repository` (de onde as queries importam o `useRepositories`), o comando gera o domínio e avisa como criar o provedor.

**Recusa (código 2):** nome ou entidade inválidos ou reservados; singular que não dá para derivar; entidade igual ao nome; domínio que já existe; índice que falta; mapa `factories` que falta; export que já existe.

**Exemplos:**

```bash
pnpm exec prumo make:domain clientes
pnpm exec prumo make:domain categories --entity category
pnpm exec prumo make:domain pedidos-recentes --entity pedido-recente
pnpm exec prumo make:domain livros --fields "titulo:string,autor:string,ano:number,disponivel:boolean,publicadoEm:date,apelido?:string"
```

---

## `prumo make:component`

Gera um componente e o teste dele.

```text
prumo make:component <nome> (--page <tela> | --shared) [--root <pasta>] [--dry-run]
```

| Argumento ou opção  | Descrição                                                          |
| ------------------- | ------------------------------------------------------------------ |
| `<nome>`            | O nome do componente, em kebab-case.                               |
| `--page <tela>`     | A tela dona do componente: vai para `src/pages/<tela>/components/`. |
| `--shared`          | O componente é de uso comum: vai para `src/components/shared/`.    |
| `--root <pasta>`    | A pasta do projeto. Padrão: a atual.                               |
| `--dry-run`         | Só lista o que seria criado.                                       |

Use exatamente um de `--page` e `--shared`.

**Cria** `<pasta>/<nome>.tsx`, com `<Nome>Props` (`title: string`) e o componente `<Nome>` (uma `<section>` com um `<h2>`), e `<pasta>/<nome>.test.tsx`, que renderiza o componente e confere o título. Não altera nenhum arquivo.

**O `prumo check` e o `--shared`.** A análise cobra que o que está em `shared` seja usado por duas telas ou mais. Um componente compartilhado recém-gerado ainda não é usado, e a violação `shared-usage` dele é **esperada**: o comando a mostra, explica que ela some quando duas telas o importarem e sai com 0. Qualquer outra violação nova sai com 1.

**Aviso de nome repetido.** Se já existe um componente com o mesmo nome em outra tela ou em `shared`, o comando gera mesmo assim e escreve `Aviso: ...` (também no `--dry-run`), sugerindo o [`move:component`](#prumo-movecomponent) quando o outro é de uma tela. Não é recusa; o mesmo nome no mesmo lugar é.

**Recusa (código 2):** nome inválido ou reservado; nem `--page` nem `--shared`, ou os dois; tela que não existe; componente que já existe.

**Exemplos:**

```bash
pnpm exec prumo make:component resumo --page clientes
pnpm exec prumo make:component cartao-de-metrica --shared
```

---

## `prumo move:component`

Promove um componente de uma tela a compartilhado.

```text
prumo move:component <nome> --from <tela> --shared [--root <pasta>] [--dry-run]
```

| Argumento ou opção | Descrição                                                                   |
| ------------------ | --------------------------------------------------------------------------- |
| `<nome>`           | O nome do componente, em kebab-case.                                        |
| `--from <tela>`    | A tela de onde ele sai (`src/pages/<tela>/components/`).                    |
| `--shared`         | O destino: `src/components/shared/`. É o único destino que existe.          |
| `--root <pasta>`   | A pasta do projeto. Padrão: a atual.                                        |
| `--dry-run`        | Só lista o que seria movido e alterado.                                     |

**Move** `<nome>.tsx` e `<nome>.test.tsx` (se houver) de `src/pages/<tela>/components/` para `src/components/shared/` e **reescreve** para `@/components/shared/<nome>` todo import que apontava para o componente, em qualquer arquivo de `src`: na tela de origem, em outra tela, em testes, em `export ... from`, `import()` e `vi.mock`. O conteúdo do componente e do teste não muda, a não ser nos imports relativos que saíam da pasta (viram `@/...`). Se a pasta `components` da tela fica vazia, some.

**O `prumo check`.** Logo depois da mudança o componente ainda é de uma tela só, e a violação `shared-usage` dele é **esperada**: o comando a mostra, explica que ela some quando uma segunda tela o importar e sai com 0. Qualquer outra violação nova sai com 1 (a mudança já foi feita); a que já existia antes aparece como preexistente.

**Recusa (código 2), sem mexer em nada:** nome inválido ou reservado; falta `--shared`; tela que não existe; componente que não existe na tela; já existe um componente (ou teste) de mesmo nome em `shared`; o componente importa algo de uma tela (o que está em `shared` não pode depender de tela).

O caminho inverso, de `shared` para uma tela, não existe: um componente que duas telas usam é compartilhado, e tirá-lo de lá é uma decisão que o `prumo check` já cobra.

**Exemplo:**

```bash
pnpm exec prumo move:component formulario-de-livro --from livros --shared
```

---

## `prumo check`

Analisa o projeto e lista as violações da arquitetura.

```text
prumo check [--root <pasta>]
```

Roda as quatro verificações do [`@matizze/prumo-rules`](rules.md#análise-do-projeto): `components-folders`, `shared-usage`, `page-structure` e `messages`, com as opções padrão. Escreve uma linha por violação, com o arquivo, a verificação e a mensagem, e um resumo:

```text
src/components/widgets  [components-folders]  A pasta 'widgets' não é permitida em src/components: só 'layout', 'shared', 'ui'.
src/messages/en/clientes.json  [messages]  A chave 'clientes.empty' existe em 'pt-BR' e falta em 'en'.

prumo check: 2 violações.
```

Sem violação: `prumo check: nenhuma violação.` e código 0. Com violação, código 1.

O `prumo check` usa a estrutura padrão (telas em `src/pages`, idiomas `pt-BR` e `en`, alias `@/`) e ainda não lê arquivo de configuração. Para outras opções, use a [API `check`](rules.md#análise-do-projeto).

---

## `prumo doctor`

Confere o ambiente e o projeto.

```text
prumo doctor [--root <pasta>]
```

Escreve uma linha por item, com `ok`, `aviso` ou `erro`, e um resumo. Não escreve nada no projeto e não usa a rede.

```text
ok     Node: 24.7.0 (mínimo do Prumo: 24; engines: >=24).
ok     pnpm: 10.0.0 (packageManager: pnpm@10.0.0).
ok     @matizze/prumo-core: 0.2.0 (esperado: >=0.1.0 <0.3.0).
ok     @matizze/prumo-rules: 0.2.3 (esperado: >=0.2.0 <0.3.0).
ok     @matizze/prumo-testing: 0.3.0 (esperado: >=0.2.0 <0.4.0).
ok     @matizze/prumo-mcp: 0.2.0 (esperado: >=0.1.0 <0.3.0).
ok     @matizze/prumo-cli: 0.6.0 (esperado: >=0.6.0 <0.7.0).
ok     .mcp.json: existe, com o servidor prumo.

prumo doctor: tudo certo.
```

Com avisos ou erros, o resumo os conta (`prumo doctor: 2 avisos.`, `prumo doctor: 1 erro.`).

| Item                   | Erro                                         | Aviso                                                                                                   |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Node                   | Versão abaixo de 24                          | O `.nvmrc` (do projeto ou de uma pasta acima) ou o `engines.node` pedem outra versão                      |
| pnpm                   | O pnpm não foi encontrado                    | Sem `packageManager` no `package.json` (nem num `package.json` acima, como num monorepo); `packageManager` que não é pnpm; pnpm instalado de outra major ou mais antigo |
| Pacotes `@matizze/prumo-*` | Declarado no `package.json` e não instalado | Versão fora da faixa que esta CLI espera (atrás: atualize o pacote; à frente: atualize a CLI); nenhum pacote do Prumo no projeto |
| `.npmrc`               |                                              | O escopo `@matizze` ainda aponta para o GitHub Packages (os pacotes estão no npm público). Nunca lê nem mostra token |
| `.mcp.json`            |                                              | Não existe, não é um JSON de objeto ou não tem o servidor `prumo` (mostra o trecho a acrescentar)        |

Os pacotes do Prumo versionam separados, então a comparação é por **faixa compatível**, não por igualdade. A faixa da própria CLI é a da versão que está rodando.

**Códigos:** 0 sem erro (avisos não falham), 1 com erro, 2 se a pasta não é um projeto.

---

## API em processo

O pacote também exporta, em `@matizze/prumo-cli/api`, funções para rodar e descrever os comandos sem subprocesso, que o servidor MCP usa:

```ts
import { runInProcess } from '@matizze/prumo-cli/api'

const { exitCode, stdout, stderr } = await runInProcess(['check'], { cwd: '/caminho/do/app' })
```

| Função                               | Descrição                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `runInProcess(argv, { cwd, env? })`  | Roda um comando e devolve `{ exitCode, stdout, stderr }`, sem escrever no stdout do processo nem encerrá-lo. O `argv` não inclui `prumo`. Nada é lido de `process.cwd()` nem de `process.env`, e duas chamadas não compartilham estado. |
| `describeCommands(root)`             | A árvore de comandos como dado: cada comando com `name`, `path`, `toolName`, `summary`, `description` e `options`.                   |
| `createRoot(runtime)`                | A árvore de comandos (citty), ligada a um `Runtime` (`out`, `err`, `cwd`, `env`).                                                    |
| `runCli(root, argv, io)`             | Roda a árvore e devolve o código de saída.                                                                                           |
| `toolNameOf(nome)`                   | O nome de ferramenta MCP de um comando (`make:page` → `make_page`).                                                                  |
| `toArgv(command, input)`             | Converte os campos de uma chamada (um por argumento) em linha de comando. Campo desconhecido ou de tipo errado lança `UsageError`.   |

Importar o módulo não tem efeito colateral.
