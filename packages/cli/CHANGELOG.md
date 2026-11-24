# @matizze/prumo-cli

## 0.8.0

### Minor Changes

- 0289151: O Prumo ganha o servidor MCP e um comando para ver o que o projeto tem.
  
  - **`prumo list [--root <pasta>] [--json]`:** mostra o que o projeto já tem (schemas com os campos que o Prumo reconhece, repositórios com as fontes `mock`, `http` e `storage`, queries com os hooks, telas com rota, variação e query, e idiomas), só lendo os arquivos. Com `--json`, escreve um objeto estável (`schemas`, `repositories`, `queries`, `pages`, `languages`), tipado em `ProjectListing`. Sai com 2 se a pasta não é um projeto.
  - **`prumo mcp [--root <pasta>]`:** abre o servidor MCP do projeto, por stdio, para agentes de IA usarem o Prumo. Há uma ferramenta por comando (`make_schema`, `make_repository`, `make_query`, `make_page`, `check` e `list`), com os mesmos parâmetros do comando em snake_case sem acento (`dominio`, `nome`, `entity`, `fields`, `data_source`, `query`, `path` e `dry_run`) e a descrição da ajuda. As chamadas rodam em processo, uma de cada vez, na pasta do projeto, e nenhuma ferramenta escreve fora dele. O resultado é o texto da saída, com `isError` para código diferente de 0 (menos o `check` com violação, que é um resultado). O `--help` mostra o trecho do `.mcp.json` para colar num projeto que não saiu do `prumo new`.
  - **O app novo já vem ligado:** o `prumo new` cria o `.mcp.json`, que registra o servidor `prumo` (`pnpm exec prumo mcp`), e o `AGENTS.md` e o `README.md` do app passam a citar o servidor, as ferramentas e os parâmetros.
  - **Substitui o `@matizze/prumo-mcp`:** o pacote antigo (até a 0.2.0) não volta. Quem o usava passa a usar o `prumo mcp`, que vem no `@matizze/prumo-cli`.
  
  O SDK do MCP só é carregado dentro do `prumo mcp`: os outros comandos não pagam por ele.

## 0.7.0

### Minor Changes

- 3d9c4d2: A CLI foi reescrita do zero com o commander. A arquitetura do app gerado é a mesma; mudam os comandos, as opções e as mensagens, agora todas em português, com os códigos de saída `0` (sem erro), `1` (erro inesperado, ou violação no `check`) e `2` (uso errado: comando, opção ou argumento que não existe, nome inválido, camada que falta). Todo comando que escreve valida tudo antes e nunca sobrescreve arquivo; `new` e os `make:*` aceitam `--dry-run`, e os `make:*` e o `check` aceitam `--root <pasta>` (o `new` tem `--dir`).
  
  **Os comandos da v1**
  
  - `prumo new <nome>`: cria o app (Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next, os pacotes do Prumo, a estrutura em camadas e a tela `home`). Opções `--dir`, `--no-install` e `--packages`. O app sai sem `.mcp.json` e sem `@matizze/prumo-mcp`, com a fonte de dados `mock`, o `src/vite-env.d.ts` e o `AGENTS.md` e o `README.md` descrevendo os comandos da v1.
  - `prumo make:schema <domínio>`: cria o schema zod de uma entidade e o registra. `--entity <singular>` dá o singular quando o automático erra (`paes` com `--entity pao`); `--fields` define os campos (`titulo:string,ano:int,situacao:enum(lido|lendo),apelido?:string`), com os tipos `string`, `number`, `int`, `boolean`, `date`, `datetime` e `enum(a|b|c)` e o `?` para campo opcional.
  - `prumo make:repository <domínio>`: cria o contrato, o repositório `mock`, as fixtures, o teste de contrato e a fábrica, e registra o domínio no container e o texto de `<ENTIDADE>_NOT_FOUND` nos `errors.json`. Precisa do schema e lê os campos dele (busca, ordem, fixtures e teste de contrato), sem `--fields`; um campo que o comando não reconhece, num schema editado à mão, é erro de uso, com a linha. `--entity` como no `make:schema`.
  - `prumo make:query <domínio>`: cria `src/queries/<domínio>.ts` (chaves, `use<Domínio>List`, `use<Entidade>Detail`, `useCreate<Entidade>`, `useUpdate<Entidade>` e `useRemove<Entidade>`) e o registra. Precisa do repositório.
  - `prumo make:page <nome>`: cria a tela (`index`, `model`, `view` e o teste), os textos em cada idioma e a rota. `--query <domínio>` gera a lista (ou, com parâmetro no caminho, o detalhe) usando a query; `--path <caminho>` define a rota, com um parâmetro opcional (`/clientes/:id`).
  - `prumo check`: confere a arquitetura do projeto, uma violação por linha, e sai com 1 se houver.
  
  Cada camada usa a de baixo, então a ordem é `make:schema`, `make:repository`, `make:query` e `make:page --query`. Se uma camada falta, o comando sai com 2, sem criar nada, e diz o que rodar.
  
  **Fontes de dados**
  
  `make:repository --data-source <mock|http|storage>` (padrão `mock`) acrescenta uma fonte ao mesmo contrato, e cria o repositório inteiro se ele ainda não existe. O `storage` é o mock gravando no `localStorage` (chave `<nome do app>:<domínio>`). O `http` usa `fetch` por um cliente em `src/repositories/http.ts`: o backend responde no formato do app (`{ items, total }`), o repositório só valida a resposta com o schema, envia `search`, `sort=<campo>:<asc|desc>`, `page` e `page_size`, usa `PATCH` no `update` e transforma o 404 em `<ENTIDADE>_NOT_FOUND`. O app escolhe a fonte por `VITE_DATA_SOURCE` (`mock` quando falta), e o teste de contrato do `http` só roda com `API_TEST_URL`.
  
  **O que saiu**
  
  - `make:domain` saiu, e o substituto são os três comandos: `make:schema`, `make:repository` e `make:query`.
  - `make:page --domain` virou `make:page --query`.
  - A fonte de dados `memory` virou `mock`.
  - Saíram sem substituto: o servidor MCP e o pacote `@matizze/prumo-mcp`, o `doctor`, o `make:component` e o `move:component` (os componentes de interface vêm do design system do produto, e os do produto se criam à mão), e a API em processo (`@matizze/prumo-cli/api`).

## 0.6.0

### Minor Changes

- 7565ccd: Achados da revalidação do app de exemplo:
  
  - O `--fields` do `make:domain` (e o campo `fields` da ferramenta MCP) ganha os tipos `int` (`z.number().int()`, fixtures com inteiros) e `enum(a|b|c)` (`z.enum([...])`, fixtures com os valores da lista, na ordem). Os valores precisam ser identificadores simples (letras, números e `_`, começando por letra), sem repetir, e são no mínimo dois; o resto é recusado com código 2. O enum entra na `SortKey` e na ordem do mock, mas o teste de ordem do contrato usa outro campo, porque o enum repete valores. O `make:page --domain` não trata o enum como texto de exibição (sem outro campo de texto, mostra o `id`, com o aviso de sempre). Sem os tipos novos, o `--fields` se comporta como antes.
  - O código gerado pelo `make:domain` quebra em várias linhas (2 espaços, vírgula no fim) o `pick` do schema de entrada, a busca do mock e a entrada do teste de contrato quando a linha passaria de cerca de 100 colunas, e a frase da busca vira "pelos campos de texto" quando listar os campos estouraria a linha. Domínios pequenos saem iguais aos de antes.
  - A mensagem da regra `shared-usage` do `prumo check` passa a dizer "O módulo não é usado por nenhuma tela" (antes, "O módulo é usado por nenhuma tela") e "O módulo é usado só pela tela 'x'".
- 857c809: Correções do `new` e dos `make:*`, vindas de um app real:
  
  - Os `make:page`, `make:domain` e `make:component` só saem com código 1 pelas violações do `prumo check` que **eles** causaram. O `check` roda antes de escrever, e a violação que já existia (a `shared-usage` de um componente `--shared` anterior, por exemplo) aparece como "Preexistentes" e não muda o código de saída. O `prumo check` em si não muda.
  - O `verify` do app novo passa a ser `typecheck && lint && test && check`: os testes rodam mesmo quando o `check` falha, e o `verify` continua falhando se o `check` falhar. Apps já criados não mudam sozinhos; troque a ordem no `package.json` se quiser.
  - O `new` gera o tratamento de erro ligado: o namespace `errors` nos dois idiomas, o `src/errors.ts` com o `getErrorMessage`, o `i18n` exportado e o `providers/app.tsx` usando o `getErrorMessage` (antes, o texto técnico do erro).
  - O `make:domain` acrescenta o texto de `<ENTIDADE>_NOT_FOUND` ao `errors.json` de cada idioma. Num app criado antes, sem o `errors.json`, avisa e segue, sem falhar.
  - O `src/test/setup.ts` do app novo fixa o idioma padrão (`pt-BR`), em vez de rodar os testes em inglês no jsdom.
  - Os "Próximos passos" do `new` usam `<domínio>` e `<tela>` no lugar de um nome inventado e apontam para a documentação.
- 375644a: Modelos de domínio corrigidos, vindos de um app real. Vale para os domínios gerados daqui em diante; um domínio já gerado não muda sozinho (o contrato dele continua o mesmo e nada quebra):
  
  - `use<Domínio>List(query, options)` aceita as opções do `useQuery` (`enabled`, `staleTime`, `select`...) e mantém por padrão os dados da consulta anterior enquanto a nova carrega (`placeholderData: keepPreviousData`): ao buscar, filtrar ou paginar, a tela não volta para "Carregando…". Num domínio antigo, acrescente o segundo parâmetro e o `placeholderData` ao hook.
  - `useRemove<Entidade>` tira do cache o detalhe do registro removido e invalida só as listas (nova chave `<entidade>Keys.lists`), em vez de buscar o detalhe de novo e notificar "não encontrado". Num domínio antigo, troque o `onSuccess` do remove por `removeQueries({ queryKey: keys.detail(id) })` e `invalidateQueries({ queryKey: keys.lists })` (com `lists: ['list']` nas keys).
  - `update` do contrato, do mock e do hook passa a aceitar entrada parcial (`Partial<Input>`): só os campos enviados mudam, e o teste de contrato ganha o caso. Para mudar um ou dois campos não é mais preciso reenviar o registro. Num domínio antigo, troque o tipo do `input` por `Partial<...Input>` no contrato, no mock (`{ ...item, ...input }`) e no hook; a implementação HTTP passa a usar `PATCH`.
  - A tela de detalhe gerada com `--domain` já fica certa com isso (ela só lê o registro).
  - Documentação: o guia de domínios ganha as seções "Onde o `name` aparece", "Filtros na consulta da lista" e "Consultas que dependem de hoje", e a "Mudar a forma do dado" lista todos os pontos que citam o `name`.
- eccafa4: `make:domain --fields` gera o domínio com os campos da entidade, em vez de só `name`:
  
  ```sh
  pnpm exec prumo make:domain livros --fields "titulo:string,autor:string,ano:number,disponivel:boolean,publicadoEm:date,apelido?:string"
  ```
  
  - Sintaxe `nome:tipo` separados por vírgula: nome em camelCase; tipos `string`, `number`, `boolean`, `date` (`AAAA-MM-DD`) e `datetime` (ISO); `?` depois do nome torna o campo opcional. `id` e `createdAt` (reservados), nomes repetidos, tipos desconhecidos e listas mal formadas são recusados (código 2), sem escrever nada.
  - O schema, o schema de entrada, as fixtures (três registros), o mock (busca nos campos de texto, ordem pelos campos, `create` e `update` com todos os campos) e o teste de contrato saem coerentes com os campos. Datas viram `z.iso.date()` e `z.iso.datetime()`.
  - `make:page --domain` (lista e detalhe) mostra o primeiro campo de texto obrigatório do schema que existe no projeto (o app pode tê-lo editado depois), no lugar de `name`, e o teste da tela de detalhe espera o valor desse campo na primeira fixture. Sem campo de texto, ou sem achar o schema, a tela mostra o `id` e o comando avisa na saída. Num domínio sem `--fields` (só `name`), o resultado é o de antes.
  - Sem `--fields`, o `make:domain` gera exatamente o que gerava. O servidor MCP ganha o campo `fields` na ferramenta `make_domain`.
- ef60741: `make:page` ganha `--path <caminho>` (e a ferramenta `make_page` do MCP, o campo `path`): a rota da tela deixa de ser sempre `/<nome>`. O caminho é validado (começa com `/`, segmentos válidos, no máximo um parâmetro `:nome`, sem `?`, `*` nem `+`) e recusado se repete ou conflita com uma rota do `App.tsx`. Com parâmetro (`--path /livros/:id`), o model gerado lê o valor com o `useParams` do wouter, a view o mostra e o teste renderiza a tela dentro de `<Route path="...">` com um valor de exemplo, então um descompasso entre a rota e a tela passa a falhar. Junto de `--domain`, a tela é de detalhe: o model busca o registro com o `use<Entidade>Detail` do domínio. Sem `--path`, nada muda.
- d8312c8: Promover um componente de tela a compartilhado agora é um comando:
  
  - `prumo move:component <nome> --from <tela> --shared` (ferramenta MCP `move_component`) move o componente e o teste dele de `src/pages/<tela>/components/` para `src/components/shared/` e reescreve para `@/components/shared/<nome>` todo import que apontava para ele (na tela de origem e em qualquer outro arquivo de `src`, inclusive `vi.mock` e `import()`). Aceita `--dry-run`. Recusa, sem mexer em nada, o nome inválido, a tela ou o componente que não existe, o homônimo já em `shared` e o componente que importa algo de uma tela. No fim roda o `prumo check`: a `shared-usage` do componente movido, ainda de uma tela só, é mostrada como esperada e não faz o comando falhar. O caminho inverso (de `shared` para uma tela) não existe.
  - `make:component` avisa (`Aviso: ...`, sem recusar) quando já existe um componente de mesmo nome em outra tela ou em `shared`, e sugere o `move:component`. O mesmo nome no mesmo lugar continua recusado.
  - O `AGENTS.md` do app novo lista o comando novo, e `docs/reference/cli.md`, `docs/reference/mcp.md` e o guia de telas descrevem o caminho "o componente passou a ser usado por duas telas".
- 1b79171: O `@matizze/prumo-testing` ganha `createRenderHookWithProviders`, que cria o `renderHookWithProviders` do app: o `renderHook` do Testing Library com os mesmos provedores, repositórios, `QueryClient` e rota em memória do `renderWithProviders`, para testar um hook de query ou de mutation sem montar um componente de mentira (devolve também `queryClient`, `repositories`, `history`, `navigate` e `currentPath`). O `createRenderWithProviders` (e o novo `createRenderHookWithProviders`) aceita um segundo parâmetro de tipo com as opções extras de cada teste, passadas na opção `providerProps` e repassadas aos `Providers` do app (a sessão de cada teste, por exemplo), tipadas pelo app. Sem o segundo parâmetro, nada muda para quem já usa. O `src/test/render.tsx` que o `prumo new` gera passa a exportar o `renderHookWithProviders` e traz, comentado, o passo a passo para acrescentar um provedor do app.

### Patch Changes

- 0eb8d2b: O README de cada pacote, que é a página dele no npm, foi reescrito: instalação, uso essencial e links para a documentação completa do Prumo (tutorial, guias e referência). A descrição do `@matizze/prumo-cli` no npm passa a citar todos os comandos.
- Updated dependencies [7565ccd]
- Updated dependencies [0eb8d2b]
  - @matizze/prumo-rules@0.2.3

## 0.5.2

### Patch Changes

- O README publicado no npm deixa de dizer que o pacote não foi publicado e ganha a seção Instalação.
- Updated dependencies
  - @matizze/prumo-rules@0.2.2

## 0.5.1

### Patch Changes

- bf849f4: O app criado pelo `prumo new` fixa a versão do pnpm em `packageManager` no `package.json`, e o `prumo doctor` não avisa mais que falta o campo.

## 0.5.0

### Minor Changes

- 3e763de: O `prumo new` deixa de criar o `.npmrc` (os pacotes `@matizze/prumo-*` vêm do npm público, sem token), e o `AGENTS.md` e o `README.md` do app não falam mais de GitHub Packages. O `prumo doctor` passa a avisar quando o `.npmrc` ainda manda o escopo `@matizze` para o GitHub Packages: a linha pode sair.

### Patch Changes

- Updated dependencies [3e763de]
  - @matizze/prumo-rules@0.2.1

## 0.4.0

### Minor Changes

- O Prumo passa a ser uma ferramenta sem frontend. Saem os comandos `add`, `promote`, `catalog`, `patterns` e `agents`, o `--like`, os dez padrões de tela e o `--menu`, e os geradores deixam de copiar telas: passam a usar os modelos do próprio pacote (`templates/`).
- `prumo new <nome> [--dir <pasta>] [--packages <pasta>] [--no-install] [--dry-run]`: cria um app React mínimo, sem CSS e sem design system (Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next), com os pacotes do Prumo, a estrutura de pastas, a tela inicial `home`, o `AGENTS.md`, o `README.md`, o `.mcp.json` com o servidor `prumo` e o `.npmrc` que aponta o escopo `@matizze` para o GitHub Packages (o token vem de `NODE_AUTH_TOKEN` e nunca é escrito no arquivo).
- `prumo make:page <nome> [--domain <domínio>]`: gera `index`, `model`, `view` (só com HTML), o teste, as mensagens nos dois idiomas e a rota. Com `--domain`, o model lê a lista do domínio e a view mostra o carregando, o erro e a lista.
- `prumo make:domain <nome> [--entity <singular>]`: gera o schema zod, o contrato do repositório, o mock com fixtures, o teste de contrato e as queries, registrados nos índices.
- `prumo make:component <nome> (--page <tela> | --shared)`: gera o componente, só com HTML, e o teste dele.
- Os geradores validam o nome, recusam sobrescrever, têm `--root` e `--dry-run` e rodam o `prumo check` no fim.
- `prumo doctor` avisa quando o `.npmrc` do projeto aponta o escopo `@matizze` para o GitHub Packages e falta `NODE_AUTH_TOKEN`, sem nunca mostrar o valor. Sai a conferência do registry de UI.

### Patch Changes

- Updated dependencies
  - @matizze/prumo-rules@0.2.0

## 0.3.0

### Minor Changes

- 13c77b7: Novo comando `prumo add <item>...`, que instala no projeto blocos, telas e domínios do catálogo do Prumo, com os itens de que eles dependem. Ele lê o índice (`catalog/index.json`) e os arquivos de uma origem (`--from <pasta>`, um checkout do `matizze/prumo`, ou o clone em cache do repositório), copia os arquivos e faz as costuras: as mensagens nos dois idiomas e os `index.ts` delas, o `<Route>` da tela no `src/App.tsx` (clonado da origem, com o layout), os índices de um domínio e o barrel de schemas, que só ganha os exports que faltam. Valida tudo antes de escrever (item que não existe, idioma, item de UI ausente, arquivo diferente da origem, que sai com código 2), avisa as dependências npm que faltam sem instalá-las, tem `--diff`, `--dry-run` e `--overwrite` e roda o `prumo check` ao terminar.
- 565c112: Novo comando `prumo doctor [--root <pasta>]`: confere o Node (mínimo 24, e o `.nvmrc` do projeto), o pnpm (contra o `packageManager`), a versão de cada `@matizze/prumo-*` instalado contra a faixa que a CLI espera (aviso quando o projeto está atrás ou à frente), o registry de UI do `components.json` (`@mads` ou `@<cliente>-ds`) com as variáveis dele, lidas do ambiente e do `.env.local`, e a presença do `.mcp.json` e do `.env.local`. Uma linha por item com ok, aviso ou erro; sai com 0 (tudo certo ou só avisos), 1 (erro) ou 2 (uso errado). Não escreve nada, não usa a rede e nunca imprime o valor do token.
- ccfe716: O `prumo add` instala itens de UI do design system: `prumo add @mads/<item>` (ou `@<cliente>-ds/<item>`) chama o `shadcn` do próprio projeto, depois de conferir o `components.json`, as variáveis do registry (`MADS_REGISTRY_URL` e `MADS_REGISTRY_TOKEN`, que nunca aparecem na saída) e o shadcn instalado, e recusa com o que fazer quando algo falta. Dá para misturar itens de UI e do catálogo no mesmo pedido. Quando um bloco precisa de um item de UI que falta, o comando oferece instalá-lo num terminal e, sem terminal, diz o comando que resolve. O `prumo new --ds <cliente>` troca o registry de UI do produto (`@mads` por `@<cliente>-ds`), as variáveis do `.env.local` e o que o `AGENTS.md` e o `README.md` dizem sobre de onde vem a UI.
- c130466: O `prumo make:domain` gera o teste de contrato no formato do `@matizze/prumo-testing`: o `defineContractSuite` declara os casos e o `runContractSuite` os roda contra o mock, importados de `src/test/contract.ts`, a ligação do projeto com o pacote. Para rodar o mesmo contrato contra outra implementação, basta acrescentar um `runContractSuite` no mesmo arquivo. O comando avisa no fim se o projeto não tem o `src/test/contract.ts`, e a renomeação do domínio cobre o título do contrato e o nome da implementação.
- 2f0d96b: Novo comando `prumo new <nome>`, que cria um produto a partir do starter do Prumo: baixa o `starter/` (clone raso do repositório, ou um checkout local com `--from`), copia para `<dir>/<nome>` sem `node_modules`, `dist` e `scripts/`, troca o nome do app (`package.json`, título do `index.html`, `AGENTS.md` e `README.md`), troca o `workspace:*` dos pacotes do Prumo pela versão, cria o `.npmrc` (registry do escopo `@matizze`, com o token em `NODE_AUTH_TOKEN` e fora do arquivo), o `.env.local` e o `.mcp.json`, roda `git init` (sem commit) e `pnpm install`. Com `--packages <pasta>`, os pacotes `@matizze/prumo-*` vêm de tarballs locais (`pnpm.overrides` com `file:`), o que permite provar a instalação fora do monorepo antes da publicação. Valida o nome, a pasta de destino, a origem e os tarballs antes de escrever (saída 2), e tem `--dir`, `--no-install` e `--dry-run`. A ajuda passa a mostrar `--no-install` para a opção que já vem ligada.
- 6b3296f: Novo comando `prumo promote <componente> --from <tela>`, que move um componente de `src/pages/<tela>/components` para `src/components/shared`, com a story, o teste e o `.mdx` que vão ao lado dele. Ele troca os imports de todo arquivo que usa o componente (telas, layout, testes, stories, `vi.mock`, `import()` dinâmico), ajusta os imports relativos do próprio componente, muda o título da story de `Pages/<Tela>/<X>` para `Patterns/<Tela>/<X>` e, num projeto com `registry.json`, registra o componente como bloco. Recusa com código 2, sem escrever, o que quebraria o `prumo check`: componente usado por uma tela só (a mensagem diz o que fazer), que depende da pasta da tela de origem, nome repetido em `shared` ou título de story repetido. Tem `--dry-run`, `--root` e roda o `prumo check` ao terminar. Por baixo, o plano em memória do codemod ganha `moveFile`, e o resumo lista os arquivos movidos.

### Patch Changes

- 7a58c82: O pacote passa a sair com `dist/` (`.js` e `.d.ts`), compilado com o `tsc`, pronto para a publicação: o `pnpm pack` troca o `exports`, o `types` e o `bin` para o `dist/`, e o tarball não leva código-fonte nem testes. No workspace nada muda.
- 254b41c: O `prumo add` deixa de brigar com o que o produto já editou. A camada de app (`app-i18n`, `app-core`, `schemas`), quando entra só como dependência de um item, vira semeadura: cria o que falta, pula o que é igual e mantém o que difere, sem recusar e sem sobrescrever, nem com `--overwrite`, e a saída lista os arquivos mantidos com o `--diff` que os compara; pedida explicitamente, ela segue as regras de sempre. O bloco que o starter deixou numa tela não é mais criado de novo em `src/components/shared`: se uma tela nova do pedido o usa, o `add` o promove (como o `prumo promote`, junto com os blocos que se importam entre si), e sem tela nova ele fica onde está; com mais de uma cópia, ou se a promoção não é segura, recusa e diz o `prumo promote`. A ajuda e o README param de prometer o comando dos testes, e a saída avisa que o catálogo não traz testes nem stories. A oferta de instalar a UI que falta mantém o `--overwrite` do pedido nos itens que a pessoa pediu.
- 7a7db36: O `prumo new` e o `prumo add` sem `--from` leem a `main` (onde entram as versões publicadas), e não mais a `develop`: `--ref <ref>` e `PRUMO_REF` escolhem outra branch ou uma tag. O cache do `add` passa a ser do prumo (uma sentinela em `.git/prumo-cache.json` guarda o repositório e a ref): o comando recusa, sem tocar, uma `PRUMO_CACHE_DIR` que tem outra coisa, segue a troca de `PRUMO_REPOSITORY` ou de ref, restaura ou refaz um cache danificado e, se o índice não lê, diz qual pasta apagar; `XDG_CACHE_HOME` e `HOME` vazios não jogam mais o clone na pasta atual, e `Origem:` mostra o repositório e a ref. O `new --from` não leva mais o que o git do checkout ignora (`.env` com token, `public/r`, `dist-ds`, `.vscode`, logs). `--ds gekom-ds` é recusado (o `--ds` recebe só o nome do cliente), a ajuda do `--no-install` descreve o `--no-install`, o `doctor` lê os mesmos arquivos `.env` que o `add` e esconde a query e o fragmento das URLs.
- 0337aa3: O `prumo new` troca também o nome do app em `src/config/app.ts` (o `APP_NAME` que o título das páginas, o logo e o rodapé do 404 leem), pelo nome de exibição do produto, o mesmo do `<title>` do `index.html`. Antes, só o `index.html` mudava, e toda aba voltava a mostrar `| Matizze`. O starter que ele copia também fica sem links para telas que não existem (`/signup`, `/reset-password`, `/invoices`) e sem as imagens do TailAdmin Pro (substitutos neutros no lugar).
- Updated dependencies [7a58c82]
- Updated dependencies [7a7db36]
  - @matizze/prumo-rules@0.1.1

## 0.2.0

### Minor Changes

- 58fd2f1: O `prumo` agora é uma árvore de comandos, com ajuda em português: `prumo --help` lista os comandos e `prumo <comando> --help` mostra a sintaxe, os argumentos e as opções. Comando desconhecido, opção que o comando não tem, opção sem valor e argumento que falta ou sobra saem com código 2, com a mensagem e a ajuda do comando. O `prumo check` mantém a saída e os códigos de hoje (0 sem violação, 1 com violação, 2 para uso errado), mas a raiz agora também precisa ter `package.json`, além de `src`. O pacote passa a depender de `citty`.
- 0e8d5c1: O pacote ganha o núcleo do codemod que os comandos `make:*` vão usar (`src/codemod/`). Um plano de mudanças em memória (ts-morph, sem tsconfig e sem checagem de tipos) recebe as cópias e as costuras, lista o que seria criado e alterado (o `--dry-run`) e só grava no fim. As operações são `copyPage`, `renameExports` (renomeia pelo language service, com as referências), `replaceNamespace`, `renameStoryTitles`, `replaceRoute`, `registerMessages`, `registerRoute` (clona o `<Route>` da referência, inclusive dentro de `nest`) e `registerMenuItem`, além da validação e da derivação de nomes (kebab, Pascal, camel, singular e plural). O pacote passa a depender de `ts-morph`.
- 55c92de: Novo comando `prumo make:component <nome> --page <tela> [--root <pasta>] [--dry-run]`: gera um componente e a story dele em `src/pages/<tela>/components/`, a partir de um componente pequeno do próprio projeto (`storage-card`, de `src/pages/file-manager/components/`), renomeado pela estrutura do código: o componente e o tipo das props, o import da story e o título dela (`Pages/<PascalDaTela>/<Pascal>`, para não repetir título no Storybook). A story tem play function e roda com o axe nos dois temas. O componente novo não precisa ser usado pela tela, e a pasta `components` é criada se não existir. Valida tudo antes de escrever (nome inválido, tela que não existe, componente ou story que já existem e título repetido saem com código 2, sem tocar em arquivo), `--dry-run` só lista o que seria criado, e ao terminar o comando roda a análise do `prumo check` e mostra o comando do teste da story. As props e os textos da story são os da referência, e o produto os edita.
- 41bae0e: Novo comando `prumo make:domain <nome> [--entity <singular>] [--root <pasta>] [--dry-run]`: gera um domínio de dados a partir do domínio `customers` do próprio projeto. Copia o schema da entidade, o repositório (contrato, mock com latência, fixtures e teste de contrato) e as queries, renomeia pela estrutura do código (`Customer`, `ICustomersRepository`, `MockCustomersRepository`, `createCustomersRepository`, `MOCK_CUSTOMERS`, `customerKeys`, a chave do container e do `createQueryKeys`, o código de erro e o prefixo dos ids das fixtures) e faz as costuras: o export em `src/schemas/index.ts`; o import, o `export *` e a entrada do mapa `factories` em `src/repositories/index.ts` (em ordem alfabética); e o export em `src/queries/index.ts`. O singular da entidade sai do nome (tira o `s` final) e o `--entity` o substitui quando a regra erra. Valida tudo antes de escrever (nome inválido, domínio que já existe, referência incompleta e índice ausente saem com código 2, sem tocar em arquivo), `--dry-run` só lista o que seria criado e alterado, e ao terminar o comando roda a análise do `prumo check` e mostra o comando dos testes do domínio novo. Os campos e as fixtures são os de `customers`, e o produto os edita; a mensagem do erro "não encontrado" vira `Registro não encontrado.`, e o comentário das fixtures que cita a origem dos dados da referência vira um aviso de dados de exemplo. Se o projeto tem `registry.json` e um item que publica `src/schemas/index.ts`, `src/repositories/index.ts` ou `src/queries/index.ts`, os arquivos novos que esse índice reexporta (sem os testes) entram no mesmo item, e o `registry.json` aparece entre os alterados, inclusive no `--dry-run`; sem `registry.json`, nada muda.
- 8d01c00: Novo comando `prumo make:page <nome> --like <tela> [--root <pasta>] [--menu <grupo>] [--dry-run]`: gera uma tela a partir de uma tela de referência do próprio projeto. Copia `src/pages/<tela>/` para `src/pages/<nome>/`, renomeia pela estrutura do código (componentes, hook, namespace dos textos, títulos das stories, rota e testes) e faz as costuras: as mensagens nos dois idiomas, a rota no `src/App.tsx` (com os parâmetros da referência, como `/pedidos/:id`) e, com `--menu`, o item do menu lateral. Valida tudo antes de escrever (nome inválido, tela que já existe, referência ou rota da referência ausentes saem com código 2, sem tocar em arquivo), `--dry-run` só lista o que seria criado e alterado, e ao terminar o comando roda a análise do `prumo check` e mostra o comando dos testes da tela nova.
- cd68899: O `prumo make:page` agora conhece os dez padrões de tela. O `--like` aceita o nome do padrão (`dashboard`, `lista`, `detalhe`, `formulario`, `chat`, `configuracoes`, `kanban`, `autenticacao`, `status` e `vazio`), além do nome de uma tela, e o `--like` deixa de ser obrigatório: sem ele, num terminal interativo o comando pergunta o padrão (com a opção "tela mínima"), e fora dele (CI, agentes) gera a tela mínima, a partir de `blank`. A referência com rota aninhada passa a valer: a tela entra no mesmo `<Route nest>` (`configuracoes` gera `/ai-settings/<nome>`), e o item de `--menu` leva o endereço completo. A tela de referência sem arquivo de mensagens próprio (a de `autenticacao` usa o namespace `auth`, que várias telas dividem) gera a tela nova sem criar um, e o comando avisa. O pacote passa a depender de `@clack/prompts`.

### Patch Changes

- 101b9a7: O `prumo make:page` passa a renomear o que ficava da tela de referência e a gerar links e testes que apontam para rotas que existem. A rota da referência pode se repetir em outro `<Route>` do `App.tsx` (`--like billing`, `ai-settings-billing`, `ecommerce-dashboard`): o comando clona o `<Route>` que usa o componente da tela, e não recusa mais com "tem 2 rotas". O componente da referência vem do `export default` do `index.tsx`, e não do nome da pasta, então `--like signup` (que exporta `SignUpPage`) funciona. Numa referência sem parâmetro (`--like invoices`), só o literal igual à rota e a rota seguida de `?` mudam: os links para o detalhe (`/invoices/${invoice.id}`) ficam apontando para o detalhe da referência, que existe, em vez de um `/<nome>/${id}` sem rota. Numa tela dentro de um `nest` (`--like ai-chat-text`), o teste gerado passa o endereço completo da tela nova (`/ai-chat/<nome>`), e não o da origem. As chaves completas que a tela guarda fora de `t()` (a mensagem do zod ou um `message:`, como `fileManager.renameDialog.required`) viram as do namespace novo quando a chave existe nas mensagens da referência. Interfaces, types e funções que a tela não exporta (`LoginFormProps`), os apelidos de reexport (`export { AuthSkeleton as LoginSkeleton }`) e os arquivos com o prefixo da tela (`chat-header.tsx`) ganham o nome novo, com os imports acompanhando; o arquivo que um `vi.mock` ou `import()` cita pelo caminho fica com o nome antigo. O resumo também avisa quando a referência está num `nest` com layout próprio (`/ai-settings`), cujo menu de seções o comando não atualiza.
- 1685322: O `prumo make:domain` passa a registrar o domínio novo no `registry.json` do projeto, se ele tiver um: os arquivos novos que `src/schemas/index.ts`, `src/repositories/index.ts` ou `src/queries/index.ts` reexportam entram no item do registry que publica esse índice (sem os testes, em ordem de caminho, no formato dos arquivos vizinhos), e o `registry.json` aparece entre os alterados, inclusive no `--dry-run`. Um `registry.json` que não é JSON é erro de uso (código 2). O comentário das fixtures que cita a origem dos dados da referência (o Pro) vira um aviso de dados de exemplo, em vez de seguir no domínio gerado. O comando dos testes que os `make:*` imprimem passa a pôr aspas no caminho do projeto com espaço ou caractere especial (`pnpm --dir 'meu app' ...`). A ajuda e a saída do `make:domain` deixam de dizer que a mensagem de erro é a de `customers` (ela vira `Registro não encontrado.`), e a ajuda do `make:page` passa a listar todos os erros de uso, inclusive `--menu` com grupo inexistente ou numa tela com parâmetro na rota.
- 824d98d: Os `make:page`, `make:domain` e `make:component` passam a recusar, com código 2 e sem escrever nada (o `--dry-run` também), os nomes que deixariam o projeto quebrado e sairiam com 0. O nome que é palavra reservada do JavaScript (`new`, `default`, `class`, `let`, `enum`...) ou, no domínio e no componente, nome global (`Date`, `Record`, `Promise`...) é recusado. O `make:domain` recusa o domínio cujos nomes exportados (`messageSchema`, `MOCK_MESSAGES`) o `schemas`, o `repositories` ou o `queries` já exportam, que dariam TS2308, e o plural que a regra de tirar o `s` erra (`status`, `categories`), com a sugestão do `--entity`. O `make:component` recusa o nome que repete um identificador da story ou do componente de referência (`video`, `folder-icon`). O `make:page` recusa o nome que o `App.tsx` ou as mensagens já registram (`error404` e `error-404`) e a rota que uma irmã com curinga ou parâmetro já cobre (`inbox-details` com `/inbox-details/*?`).

## 0.1.0

### Minor Changes

- 6419a6d: Novo bin `prumo` com o comando `prumo check [--root <pasta>]`, que roda a análise de `@matizze/prumo-rules/check` no projeto (a pasta atual, por padrão) e escreve uma linha por violação, com o arquivo, a regra e o que está errado. O código de saída é 0 sem violação, 1 com violação e 2 se o uso está errado, então serve de portão na CI. O pacote passa a depender de `@matizze/prumo-rules`.

### Patch Changes

- be0fd64: `prumo check` com `--root` que não existe, que não é pasta ou que não tem `src` agora escreve um erro claro em português e sai com código 2, em vez de sair verde sem analisar nada.
- Updated dependencies [be0fd64]
- Updated dependencies [52543cb]
- Updated dependencies [7d40cb1]
- Updated dependencies [e90f277]
- Updated dependencies [e52f705]
- Updated dependencies [e90f277]
- Updated dependencies [8f37583]
- Updated dependencies [3ba9751]
  - @matizze/prumo-rules@0.1.0
