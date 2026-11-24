# Plano do Prumo

23/11/2026

O Prumo é uma **ferramenta** para criar e manter aplicações React organizadas em camadas. Ele gera a estrutura e confere a arquitetura. **Não traz frontend:** a interface é do produto (o shadcn, outro design system ou nenhum).

Este plano substitui o de 22/11/2026 (Fases A, B e C, já concluídas, exceto o repositório público). A `cli` é reescrita do zero com o commander; a arquitetura do app gerado não muda.

**Situação:** v1 completa na `develop` em 23/11/2026: passos 1 a 7 e 9 concluídos (o 8 entrou no 2). Versões da v1 (24/11/2026): `@matizze/prumo-cli` 0.7.0, `@matizze/prumo-core` 0.2.1 e `@matizze/prumo-testing` 0.3.1, publicadas pelo workflow quando a `develop` vai para a `main`.

## 1. Por que recomeçar a CLI

- Cerca de 520 linhas (`run.ts`, `args.ts`, `help.ts` e `describe.ts`) existiam só para contornar o citty: ele aceita opção desconhecida sem reclamar, escreve a ajuda e os erros em inglês e sai com 1 quando o uso está errado. O commander faz isso sozinho.
- A CLI foi moldada pelo MCP: `Runtime` injetado, `runInProcess`, `describeCommands` e `api.ts` existiam para o servidor rodar os comandos em processo.
- O `make:domain` gerava três camadas de uma vez. Agora cada camada tem o seu comando.

Saem na reescrita: `make:domain` (vira `make:schema`, `make:repository` e `make:query`), `make:component` e `move:component` (a interface vem do shadcn, e os componentes do produto se criam à mão), `doctor` e o MCP. Ficam, porque já existiam e a Biblioteca precisou deles: o `--fields` e o `--entity` (agora no `make:schema`) e o `--path` com parâmetro do `make:page`.

## 2. Decisões

| Tema                | Decisão                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Repositório         | O mesmo, com um branch a partir da `develop` para cada passo                                                                  |
| Pacotes             | `cli` reescrita; `core`, `testing` e `rules` ficam como estão; `mcp` sai                                                      |
| CLI                 | Node 24 ou mais, TypeScript, commander 15                                                                                     |
| Arquitetura do app  | A mesma de hoje (seção 3)                                                                                                     |
| Interface           | Agnóstica: a view gerada usa só tags nativas no JSX, e a pessoa troca pelos componentes do shadcn (ou de outro) à mão         |
| Nomes               | Os comandos recebem o domínio no plural (`clientes`) e a entidade sai no singular automático (`cliente`), ou do `--entity`    |
| Campos              | Só o `make:schema` recebe `--fields`; o `make:repository` e o `make:query` leem os campos do schema gerado                    |
| Camada que falta    | Erro com dica (`falta o schema clientes; rode prumo make:schema clientes`), sem criar nada                                    |
| Fontes de dados     | `mock` (a `memory` de hoje, renomeada), `http` e `storage` (seção 5)                                                          |
| Formato da API      | O backend responde no formato do app, e o repositório `http` só valida a resposta                                             |
| Versão              | `@matizze/prumo-cli` 0.7.0                                                                                                    |

## 3. As camadas do app gerado

```
src/
  pages/<tela>/
    index.tsx      liga a rota ao model e à view
    model.ts       dados, textos e estado da tela; sem JSX
    view.tsx       apresentação, com tags nativas; recebe tudo por props
    components/    componentes usados só por esta tela
  components/
    ui/            o design system (o shadcn instala aqui); fora do Prumo
    shared/        componentes usados por duas ou mais telas
    layout/        a casca do app
  queries/<domínio>.ts             query keys, hooks e mutations (TanStack Query)
  repositories/<domínio>/          o contrato e as implementações (mock, http, storage)
  schemas/entities/<entidade>.ts   o schema zod e os tipos da entidade
  messages/<idioma>/<tela>.json    os textos, em pt-BR e en
  providers/                       query, i18n e o container de repositórios
```

Cada camada usa só a de baixo: a view recebe do model, o model usa as queries, as queries usam o repositório e o repositório usa o schema.

## 4. Comandos da v1

Comum a todos: `--root <pasta>` (padrão: a pasta atual), `--dry-run` (só mostra o que seria feito), ajuda e erros em português. Nenhum sobrescreve arquivo, e todos validam tudo antes de escrever, para nada ficar pela metade. Códigos de saída: 0 sem erro, 1 para violação do `check`, 2 para uso errado.

### `prumo new <nome>`

Cria `<nome>/` com Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next, os pacotes do Prumo (`cli`, `core`, `testing` e `rules`), a estrutura da seção 3 e a tela `home`. A fonte de dados padrão é `mock`.

Opções: `--dir <pasta>`, `--no-install` e `--packages <pasta>` (os tarballs do `pnpm pack:all`, para o `verify:new`).

Diferença para o de hoje: sem `.mcp.json` e sem `@matizze/prumo-mcp`.

### `prumo make:schema <domínio> [--entity <singular>] [--fields <campos>]`

- Cria `src/schemas/entities/<entidade>.ts`, com `<entidade>Schema`, `<Entidade>Schema`, `<entidade>InputSchema`, `<Entidade>Input`, `<Entidade>SortKey` e `<Entidade>ListQuery`.
- Altera `src/schemas/index.ts`.
- `--entity`: a entidade no singular, quando o automático erra (`paes` → `pao`). Padrão: o nome sem o `s` final, como hoje.
- `--fields`: os campos, `nome:tipo` separados por vírgula (`titulo:string,ano:int,status:enum(rascunho|publicado),apelido?:string`). Tipos: `string`, `number`, `int`, `boolean`, `date`, `datetime` e `enum(a|b|c)`; o `?` torna o campo opcional. Padrão: só `name:string`. As regras são as do `--fields` atual do `make:domain`.

### `prumo make:repository <domínio> [--entity <singular>] [--data-source mock|http|storage]`

Precisa do schema. Os campos (busca, ordem, fixtures e teste de contrato) saem do schema gerado, lido com o ts-morph. Um campo que o comando não reconhece (o schema foi editado à mão com algo fora dos tipos do `--fields`) é erro de uso, com a linha do campo.

- Sem a opção (ou com `mock`): cria `src/repositories/<domínio>/` com `repository.contract.ts`, `repository.mock.ts`, `fixtures.ts`, `repository.contract.test.ts` e `index.ts` (a fábrica), e registra o domínio no container (`src/repositories/index.ts`).
- Com `http` ou `storage`: cria o repositório se ainda não existe e acrescenta `repository.<fonte>.ts`. O mock existe sempre, porque os testes rodam nele. A fábrica passa a escolher a implementação pela fonte, e o teste de contrato roda também contra a fonte nova (a `http`, só com uma API de teste configurada).

### `prumo make:query <domínio> [--entity <singular>]`

Precisa do repositório.

- Cria `src/queries/<domínio>.ts`, com `<entidade>Keys`, `<entidade>Queries`, `use<Domínio>List`, `use<Entidade>Detail`, `useCreate<Entidade>`, `useUpdate<Entidade>` e `useRemove<Entidade>`.
- Altera `src/queries/index.ts`.

### `prumo make:page <nome> [--query <domínio>] [--path <caminho>]`

Com `--query`, precisa da query.

- Cria `src/pages/<nome>/` (`index.tsx`, `model.ts`, `view.tsx` e `index.test.tsx`) e `src/messages/<idioma>/<nome>.json`.
- Altera os índices de mensagens e o `src/App.tsx` (a rota).
- `--path`: o caminho da rota, com um parâmetro opcional (`/clientes/:id`). Padrão: `/<nome>`.
- As quatro variações são as que o `make:page` atual já gera: só o título; com `--query`, a lista (`use<Domínio>List`, com carregando, erro e lista); com parâmetro, a tela lê o parâmetro; com `--query` e parâmetro, o detalhe (`use<Entidade>Detail`).

### `prumo check`

Confere a arquitetura do projeto com a análise do `@matizze/prumo-rules/check`. Sai com 1 se acha violação.

## 5. Fontes de dados

O contrato (`I<Domínio>Repository`) é o formato único:

| Método                     | Devolve                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `list`                     | `{ items, total }`                                          |
| `get`, `create`, `update`  | a entidade                                                  |
| `remove`                   | nada                                                        |
| id que não existe          | rejeita com `UIError('<ENTIDADE>_NOT_FOUND')`               |

Todas as fontes implementam o contrato, e o teste de contrato prova que elas se comportam igual. A fábrica escolhe a fonte pela `VITE_DATA_SOURCE`; a tela não sabe qual é.

| Fonte     | Arquivo                 | Como funciona                                                                                                                                                                                       |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mock`    | `repository.mock.ts`    | Em memória, com as fixtures e latência simulada. É a padrão e a dos testes.                                                                                                                         |
| `storage` | `repository.storage.ts` | O mock gravando no `localStorage`, com a chave separada por app (`<app>:<domínio>`). Começa com as fixtures.                                                                                         |
| `http`    | `repository.http.ts`    | `fetch` na API. O backend responde no formato do app (`{ items, total }`, em camelCase) e o repositório só valida com o schema. A lista envia `search`, `sort=<campo>:<asc\|desc>`, `page` e `page_size`. O 404 vira `<ENTIDADE>_NOT_FOUND`. |

Na primeira fonte `http` do app, o comando também cria `src/repositories/http.ts` (o cliente), `src/repositories/api.ts` (a instância, com a `VITE_API_URL` e o lugar do token) e `src/vite-env.d.ts`, e acrescenta `'http'` em `DATA_SOURCES`. Outro nome de fonte é erro de uso.

## 6. A CLI por dentro

```
packages/cli/
  src/
    bin.ts          a entrada: roda o programa e define o código de saída
    program.ts      o comando raiz: nome, versão, ajuda e erros em português
    errors.ts       UsageError (saída 2) e ExitError (código próprio)
    commands/       um arquivo por comando: argumentos, opções, chamada ao gerador e saída
    generators/     app, schema, repository, query e page: recebem as opções e devolvem um plano
    codemods/       editam o app com o ts-morph: rota, índices, container, fábrica e DATA_SOURCES
    lib/            names (plural, singular, PascalCase), project (acha o app), plan e templates
  templates/        os modelos .tpl, com marcadores de nome
```

Princípios:

- **Comando fino.** O comando lê os argumentos, chama o gerador e escreve o resultado. A lógica fica no gerador.
- **Plano antes de escrever.** O gerador não toca o disco: devolve os arquivos a criar e a alterar. O plano confere tudo e só então escreve; o `--dry-run` só mostra o plano.
- **Testável sem subprocesso.** `run(argv, { cwd, out, err })` devolve o código de saída, e os testes rodam os comandos numa pasta temporária.
- **Modelos reaproveitados.** Os `.tpl` de hoje voltam, ajustados: `memory` vira `mock`, sai o MCP e o modelo do domínio se divide em schema, repositório e query.

Dependências da `cli`: `commander`, `ts-morph` e `@matizze/prumo-rules`. Nenhuma outra sem aprovação de uma pessoa.

## 7. Como trabalhamos

- Um PR por passo, de um branch a partir da `develop`, contra a `develop`.
- Os testes vêm no mesmo PR do código: unitários nos geradores e codemods, e de ponta a ponta nos comandos, num app temporário.
- `pnpm verify` verde antes do PR, um por vez (a máquina tem pouca memória).
- O `pnpm verify:new` voltou no passo 2 e cresce a cada comando: cria um app com os tarballs, roda os comandos já prontos e o `pnpm verify` do app.
- Cada comando atualiza a sua parte em `docs/reference/cli.md` no mesmo PR.
- Changeset nos PRs que mudam `packages/*`.
- A `main` só recebe a v1 completa (passo 9), por decisão de uma pessoa.

## 8. Passos

| #   | Entrega                                                                                                                                                                                                        | Pronto quando                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Base: sai o `mcp` (o pacote e as menções no `pack:all`, no `publish-npm.sh`, no lint, no `website/sidebars.ts`, no `README.md`, em `docs/` e no `AGENTS.md`) e o código da cli antiga (os `templates/` ficam para os passos seguintes); sai o `verify:new` até o passo 2; entra a cli nova com commander, `--help`, `--version`, erros e códigos de saída | `prumo --help` e `prumo --version` funcionam; comando ou opção desconhecidos saem com 2 e mensagem em português; nenhum link para arquivo apagado; `pnpm verify` verde |
| 2   | `check` e `new`                                                                                                                                                                                                          | O app criado passa no `pnpm verify` dele; o `verify:new` está de volta                                                                |
| 3   | `make:schema`, com `--entity` e `--fields`                                                                                                                                                                     | O `verify:new` gera um schema com campos de todos os tipos e o app passa no `pnpm verify`                                             |
| 4   | `make:repository`, com o `mock` e os campos lidos do schema                                                                                                                                                    | O teste de contrato do mock passa no app gerado, com os campos do `--fields`                                                          |
| 5   | `--data-source http` e `storage`                                                                                                                                                                               | O app compila com as três fontes, e o teste de contrato do `storage` passa                                                            |
| 6   | `make:query`                                                                                                                                                                                                   | O `verify:new` gera a query e o app passa no `pnpm verify`                                                                            |
| 7   | `make:page`, com `--query` e `--path`                                                                                                                                                                          | As quatro variações (título, lista, parâmetro e detalhe) passam no teste da tela no app gerado                                        |
| 8   | `check` (entrou no passo 2)                                                                                                                                                                                    | Acusa as violações das fixtures do `rules`, e o app gerado não tem nenhuma                                                            |
| 9   | Fechamento: guias, tutorial e README revistos, changeset da `cli` 0.7.0                                                                                                                                        | O `verify:new` completo está verde, a documentação bate com os comandos e o site da documentação compila (`website/`)                 |

## 9. Depois da v1

- `--from openapi.json` no `make:schema` e no `make:repository --data-source http`: os campos e as rotas saem da especificação da API. Só JSON; ler YAML pede uma dependência nova.
- `make:domain`: atalho para schema, repositório e query de uma vez.
- `destroy <tipo> <nome>`: desfaz o que um `make:*` gerou.
- `doctor`: confere Node, pnpm e as versões dos pacotes do Prumo.
- `make:locale <idioma>`: acrescenta um idioma com as mesmas chaves.
- No `make:page`: tela de formulário, com as mutations do `make:query`.
- `make:component` e `move:component`, se fizerem falta.
- Na fonte `http`: os erros 401 (sessão) e 422 (validação).
- Marcar o `@matizze/prumo-mcp` como descontinuado no npm, com o ok de uma pessoa.

## 10. O que continua do plano anterior

- **Publicação:** o `release.yml` publica no npm, a cada push na `main`, as versões que faltam (Trusted Publishing, sem token). O `docs.yml` atualiza o site da documentação. Nenhum workflow novo sem aprovação.
- **Repositório público:** o histórico já foi reescrito; falta o suporte do GitHub apagar as refs dos pull requests antigos.

## 11. Execução sem acompanhamento

Os nove passos rodam do começo ao fim sem uma pessoa presente. A sessão do Claude Code que orquestra fica aberta, com o Mac na tomada e sem dormir (`caffeinate`).

### Papéis

| Papel         | Quem                                       | Faz                                                                                                                                   |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Orquestrador  | a sessão principal (Opus 5.5)              | Escreve o pedido de cada passo, confere o resultado, roda o portão final, faz o merge na `develop` e decide o que o plano não cobre   |
| Implementador | um subagente Sonnet 5.5, em segundo plano  | Faz o passo inteiro: branch, código, testes, documentação, changeset, `pnpm verify`, commit, push e PR                                |
| Revisor       | um subagente Opus 5.5, em segundo plano    | Lê o diff do PR contra este plano, sem as conclusões do implementador, e aponta bugs e desvios com gravidade                         |

Um subagente por vez: nunca um implementador e um revisor ao mesmo tempo (a máquina tem 8 GB).

### O ciclo de cada passo

1. **Preparar.** O orquestrador atualiza a `develop` local e escreve o pedido do passo: a linha da seção 8, as seções do plano que ela usa, o que os passos anteriores deixaram e os desvios já aceitos.
2. **Implementar.** O implementador cria `feat/cli-<passo>` a partir da `origin/develop`, faz o passo, roda o `pnpm verify` (e, do passo 2 em diante, o `pnpm verify:new`) pela trava de memória, faz o commit, o push e abre o PR contra a `develop`. Devolve `{ status, pr, branch, verify, deviations, notes }`.
3. **Revisar.** O revisor recebe o número do PR, o pedido do passo e este plano. Devolve achados com gravidade: `important` (bug ou desvio do plano), `nit` (pequeno).
4. **Corrigir.** Com achado `important`, o mesmo implementador corrige (ele mantém o contexto) e o revisor confere só a correção. No máximo duas voltas.
5. **Portão.** O orquestrador roda ele mesmo, no branch do PR, o `pnpm verify`, o `pnpm verify:new` (do passo 2 em diante) e o critério de pronto da seção 8.
6. **Merge.** Com o portão verde: `gh pr merge --merge --delete-branch` e atualiza a `develop` local. Cada PR já marca o próprio passo na **Situação**, no topo deste plano.

### Regras do implementador

- Segue o `AGENTS.md`: português nos comentários, documentação e commits; nomes em inglês; changeset nos PRs que mudam `packages/*`.
- Dependência nova: só o `commander`. Se o passo parecer precisar de outra, resolve sem ela ou devolve `blocked`.
- Todo comando pesado (`pnpm install`, `verify`, `verify:new`, `build`, `tsc`, `eslint`, `vitest`) passa pela trava `/private/tmp/claude-501/matizze-heavy.sh run <dono> -- <comando>`.
- Não toca a `main`, os workflows, o npm (nada de `publish` nem `deprecate`) nem os pacotes `core`, `testing` e `rules`.
- Não faz merge: quem faz é o orquestrador.

### Quando parar

A execução para, deixa o estado registrado e avisa por notificação quando:

- um passo continua com achado `important` ou com o portão vermelho depois de duas voltas de correção;
- o implementador devolve `blocked` por algo que só uma pessoa decide (dependência nova, mudança em workflow, mudança no `core`, `testing` ou `rules`);
- a trava de memória não libera em 2 horas.

O que o plano não cobre e não está nessa lista, o orquestrador decide pelo critério da seção 2 e registra no PR do passo, na seção "Desvios".

### No fim

O orquestrador deixa no chat um relatório curto (PRs, números de testes, desvios e o que ficou para depois) e manda uma notificação. A `develop` fica com a v1 completa; levar para a `main` (e publicar) é decisão de uma pessoa.

## 12. Desvios registrados na execução

O que os PRs #106 a #113 registraram na seção "Desvios", em resumo:

- **#106 (base):** o export `.` da cli ficou (`run`, `createProgram`, `ExitError`, `UsageError`) e só o `./api` saiu; os erros do commander são traduzidos no `error()` do `PrumoCommand`, mantendo a sugestão "Você quis dizer ...?"; comando desconhecido na raiz diz "comando desconhecido" e grupo sem subcomando sai com 2.
- **#107 (`new` e `check`):** o `Io` ganhou `inheritStdio` no lugar do `Runtime`; o plano do app inteiro é montado em memória e gravado de uma vez, com rollback se a escrita falhar; `registerMessageNamespace` aceita a lista de idiomas; `templates/component` foi apagado e os demais modelos esperaram os passos seguintes; `addRoute` (de origem), `moveSource`, `messageKeys` e `isNestRoute` não foram portados (eram do `move:component`).
- **#108 (`make:schema`):** o aviso do `errors.json` passou para o `make:repository`, que é quem lança `<ENTIDADE>_NOT_FOUND`.
- **#109 (`make:repository`):** o codemod do container tem só `registerRepository` e `registerRepositoryEntry`; a saída mostra a linha `Campos (lidos do schema)`.
- **#110 (`--data-source`):** a fábrica do mock puro continua com `{ latencyMs }` e passa a `{ dataSource, latencyMs }` quando entra a primeira fonte; o `src/vite-env.d.ts` também é criado junto do `api.ts` num app antigo; teste de contrato que o codemod não edita vira aviso, não erro; o `update` do `http` usa `PATCH`.
- **#111 (`make:query`):** o suporte dos testes de compilação foi extraído para `generators/compile-test-support.ts`; a terceira revisão achou um caso `important` criado pela segunda correção (contrato que usa também o schema de outra entidade), e o orquestrador o corrigiu com teste, em vez de parar a execução como a seção 11 previa.
- **#112 (`make:page`):** as telas de lista e detalhe importam de `@/queries/<domínio>`, e não de `@/queries` (os dois valem para o `check`); a entidade cai no `use<Entidade>Detail` da query quando o contrato do repositório não a diz.
- **#113 (documentação):** o `docs/reference/cli.md` também foi atualizado (tirado o aviso de reescrita, completadas a tabela e a ajuda); os README de `core` e `testing` trocaram `memory` por `mock` nos exemplos, com um changeset `patch` só para isso; a seção "Conferir o ambiente" (`doctor`) do guia de projeto existente virou "Conferir a versão"; o `SECURITY.md` perdeu a menção ao `doctor`; o componente do tutorial passou a ser criado à mão.

## 13. MCP: `prumo mcp` (planejado em 24/11/2026)

O servidor MCP volta como um comando da própria cli. As ferramentas saem da árvore de comandos do commander, então um comando novo vira ferramenta sem uma segunda lista para manter. O `@matizze/prumo-mcp` (até 0.2.0) não volta.

### Decisões

| Tema               | Decisão                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Onde               | `prumo mcp`, um comando da cli; sem pacote separado                                                                                                                                             |
| Transporte         | stdio                                                                                                                                                                                            |
| SDK                | `@modelcontextprotocol/server` 2.4.0, dependência da cli, carregado por `import()` só dentro do `prumo mcp`; `@modelcontextprotocol/client` 2.4.0, devDependency, para os testes. Aprovados em 24/11/2026 |
| Ferramentas        | Uma por comando: `make_schema`, `make_repository`, `make_query`, `make_page`, `check` e `list`. O `new` e o próprio `mcp` ficam de fora                                                        |
| Projeto            | O da pasta onde o servidor abre (o `cwd`, ou `prumo mcp --root <pasta>`). Nenhuma ferramenta recebe `root`: o agente não escreve fora do projeto                                               |
| Comando novo       | `prumo list`: o que o projeto já tem (seção 13.3)                                                                                                                                               |
| App                | O `new` cria o `.mcp.json` (servidor `prumo`, `pnpm exec prumo mcp`), e o `AGENTS.md` do app cita o servidor                                                                                     |
| Pacote antigo      | `@matizze/prumo-mcp` marcado como descontinuado no npm, com a mensagem "use `prumo mcp` (@matizze/prumo-cli 0.8.0 ou mais)", só com o ok de uma pessoa                                         |
| Versão             | `@matizze/prumo-cli` 0.8.0                                                                                                                                                                       |

### 13.1 As ferramentas

Cada ferramenta é descrita a partir do comando do commander:

- **Nome:** o do comando, com `:` trocado por `_` (`make:schema` → `make_schema`).
- **Descrição:** o `summary` e a `description` do comando, os mesmos da ajuda.
- **Entrada (JSON Schema):** os argumentos posicionais (obrigatórios) e as opções, com nomes em snake_case sem acento (`<domínio>` → `dominio`, `--data-source` → `data_source`, `--dry-run` → `dry_run`). Opção com valor vira `string`; opção sem valor vira `boolean`; `.choices()` vira `enum`; `--no-<x>` vira `<x>: boolean`, com `true` de padrão. A `--root` não entra.
- **Execução:** a entrada vira a linha de comando (`['make:schema', 'livros', '--fields', '...']`) e roda em processo com `run(argv, io)`, com o `cwd` do projeto e a saída capturada. Uma chamada por vez (fila), para duas escritas não se cruzarem.
- **Resultado:** o texto da saída (stdout e, se houver, stderr). `isError` quando o código de saída não é 0, menos o `check` com violação (código 1), que é um resultado e não uma falha. A ferramenta `list` devolve o JSON do `prumo list --json`.
- **stdout é do protocolo:** nenhum comando escreve direto no `process.stdout` com o servidor no ar, e os subprocessos não herdam o terminal (`inheritStdio` desligado).

### 13.2 O servidor

- `prumo mcp [--root <pasta>]` confere que a pasta é um projeto (como o `check`) e sai com 2 se não for. Depois, abre o servidor por stdio e só termina quando o cliente fecha.
- Informa ao cliente o nome `prumo` e a versão da cli.
- O `--help` do `prumo mcp` mostra o trecho do `.mcp.json` para colar, para quem usa o servidor num projeto que não saiu do `new`.

### 13.3 `prumo list [--root <pasta>] [--json]`

Mostra o que o projeto tem, lendo os arquivos e sem escrever nada:

- **schemas:** a entidade, o arquivo e os campos que o leitor reconhece (ou "editado à mão" quando não reconhece);
- **repositórios:** o domínio, a entidade e as fontes (`mock`, `http`, `storage`);
- **queries:** o domínio e os hooks;
- **telas:** o nome, a rota, a variação (título, lista, parâmetro, detalhe) e a query que usa;
- **idiomas:** os de `src/messages`.

Sem `--json`, é um texto curto por seção. Com `--json`, é um objeto estável, documentado na referência.

### 13.4 Passos

| #  | Entrega                                                                                                                                                                         | Pronto quando                                                                                                                               |
| -- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 | `prumo list`, texto e `--json`                                                                                                                                                  | Lista certo um app com todas as camadas e fontes; o `verify:new` o chama no fim e confere o JSON                                           |
| M2 | `prumo mcp`: ferramentas descritas a partir do commander, servidor stdio, execução em processo e fila                                                                           | Teste cliente ↔ servidor no mesmo processo; teste de paridade (todo comando, menos `new` e `mcp`, tem ferramenta, e vice-versa); nada além do protocolo no stdout |
| M3 | O app: `.mcp.json` e `AGENTS.md` pelo `new`; etapa MCP no `verify:new` (um domínio e uma tela gerados só por ferramentas, com o cliente do SDK por stdio contra o `prumo mcp` do app) | `pnpm verify:new` verde com a etapa MCP                                                                                                     |
| M4 | Documentação (guia de agentes de IA, referência do `mcp` e do `list`) e changeset `minor` da cli                                                                               | O site compila e a documentação bate com os comandos                                                                                        |
| M5 | Com o ok de uma pessoa: versões (cli 0.8.0), `develop` → `main` e o `npm deprecate` do pacote antigo                                                                           | A 0.8.0 no npm e o pacote antigo marcado                                                                                                    |

**Situação:** M1 concluído.

### 13.5 Execução e o que fica de fora

- **Como executar:** decidido em 24/11/2026 — o mesmo ciclo da seção 11 (subagentes em segundo plano, revisão independente, portão e merge na `develop` pelo orquestrador), de M1 a M4. O M5 espera o ok de uma pessoa.
- **Recursos e prompts MCP:** ficam de fora por enquanto. O agente já lê o `AGENTS.md` do app.
