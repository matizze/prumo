# Plano do Prumo

23/11/2026

O Prumo é uma **ferramenta** para criar e manter aplicações React organizadas em camadas. Ele gera a estrutura e confere a arquitetura. **Não traz frontend:** a interface é do produto (o shadcn, outro design system ou nenhum).

Este plano substitui o de 22/11/2026 (Fases A, B e C, já concluídas, exceto o repositório público). A `cli` é reescrita do zero com o commander; a arquitetura do app gerado não muda.

**Situação:** plano fechado em 23/11/2026; execução pela seção 11. Passos concluídos: 1.

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
- O `pnpm verify:new` volta no passo 2 e cresce a cada comando: cria um app com os tarballs, roda os comandos já prontos e o `pnpm verify` do app.
- Cada comando atualiza a sua parte em `docs/reference/cli.md` no mesmo PR.
- Changeset nos PRs que mudam `packages/*`.
- A `main` só recebe a v1 completa (passo 9), por decisão de uma pessoa.

## 8. Passos

| #   | Entrega                                                                                                                                                                                                        | Pronto quando                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Base: sai o `mcp` (o pacote e as menções no `pack:all`, no `publish-npm.sh`, no lint, no `website/sidebars.ts`, no `README.md`, em `docs/` e no `AGENTS.md`) e o código da cli antiga (os `templates/` ficam para os passos seguintes); sai o `verify:new` até o passo 2; entra a cli nova com commander, `--help`, `--version`, erros e códigos de saída | `prumo --help` e `prumo --version` funcionam; comando ou opção desconhecidos saem com 2 e mensagem em português; nenhum link para arquivo apagado; `pnpm verify` verde |
| 2   | `new`                                                                                                                                                                                                          | O app criado passa no `pnpm verify` dele; o `verify:new` está de volta                                                                |
| 3   | `make:schema`, com `--entity` e `--fields`                                                                                                                                                                     | O `verify:new` gera um schema com campos de todos os tipos e o app passa no `pnpm verify`                                             |
| 4   | `make:repository`, com o `mock` e os campos lidos do schema                                                                                                                                                    | O teste de contrato do mock passa no app gerado, com os campos do `--fields`                                                          |
| 5   | `--data-source http` e `storage`                                                                                                                                                                               | O app compila com as três fontes, e o teste de contrato do `storage` passa                                                            |
| 6   | `make:query`                                                                                                                                                                                                   | O `verify:new` gera a query e o app passa no `pnpm verify`                                                                            |
| 7   | `make:page`, com `--query` e `--path`                                                                                                                                                                          | As quatro variações (título, lista, parâmetro e detalhe) passam no teste da tela no app gerado                                        |
| 8   | `check`                                                                                                                                                                                                        | Acusa as violações das fixtures do `rules`, e o app gerado não tem nenhuma                                                            |
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
