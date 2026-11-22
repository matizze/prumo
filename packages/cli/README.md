# @matizze/prumo-cli

O comando `prumo`: `new`, `make:page`, `make:domain`, `make:component`, `check` e `doctor`, e a API para rodar os comandos em processo.

**Situação:** o Prumo é uma ferramenta sem frontend ([docs/plano.md](../../docs/plano.md)): a CLI cria e confere o projeto, e não traz interface. Os comandos estão prontos. O pacote está pronto para o npm público (sem `private`, com `repository` e `publishConfig` público); o GitHub Packages foi uma etapa provisória. O `prumo new` não cria `.npmrc` (os pacotes `@matizze/prumo-*` vêm do registry padrão), e o `prumo doctor` avisa se o `.npmrc` ainda manda o escopo `@matizze` para o GitHub Packages.

## Comandos

| Comando                                                                                | O que faz                                                                                                                                                                    |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prumo new <nome> [--dir <pasta>] [--packages <pasta>] [--no-install] [--dry-run]`     | Cria um app mínimo, sem CSS e sem design system, com a estrutura de pastas, os provedores, uma tela inicial, o eslint, o vitest, o `AGENTS.md` e o `.mcp.json`. Veja abaixo. |
| `prumo make:page <nome> [--domain <domínio>] [--root <pasta>] [--dry-run]`             | Gera uma tela (`index`, `model`, `view` e o teste), as mensagens nos idiomas do projeto, o namespace nos índices de mensagens e a rota no `src/App.tsx`. Veja abaixo.        |
| `prumo make:component <nome> (--page <tela> \| --shared) [--root <pasta>] [--dry-run]` | Gera um componente (só HTML) e o teste dele, na pasta da tela ou em `src/components/shared`. Veja abaixo.                                                                    |
| `prumo make:domain <nome> [--entity <singular>] [--root <pasta>] [--dry-run]`          | Gera um domínio de dados (schema, repositório com mock e contrato, queries com hooks e o teste de contrato) e o registra nos índices e no container. Veja abaixo.            |
| `prumo check [--root <pasta>]`                                                         | Analisa o projeto (a análise do [`@matizze/prumo-rules`](../rules/README.md)) e escreve uma linha por violação, com o arquivo e a regra.                                     |
| `prumo doctor [--root <pasta>]`                                                        | Confere o ambiente e o projeto, uma linha por item com ok, aviso ou erro. Não escreve nada e não usa a rede.                                                                 |

`--root` é a pasta do projeto (a que tem o `package.json` e o `src`); o padrão é a pasta atual. Códigos de saída: 0 sem erro, 1 com violação (`check`) ou erro (`doctor`), 2 para uso errado (comando ou opção desconhecidos, pasta que não é um projeto). `prumo --help` e `prumo <comando> --help` mostram a ajuda, em português.

### prumo new

`prumo new meu-app` cria `./meu-app` (ou `<dir>/meu-app`, com `--dir`) com o app mínimo do Prumo: Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next (o que o `@matizze/prumo-core` usa), e **nada de interface** (sem CSS, sem design system, sem Storybook). O app tem:

- a estrutura de pastas do plano (`src/pages`, `src/components/shared`, `src/schemas`, `src/repositories`, `src/queries` e `src/messages/{pt-BR,en}`) e os pontos que os geradores pressupõem: `@/` para `src` (tsconfig e vite), `src/i18n.ts`, `src/providers/repository`, `src/repositories/{index,options}.ts` (o container) e `src/test/render.tsx` (o `renderWithProviders`);
- os provedores (`src/providers/app.tsx`: query, i18n e repositórios) e o `src/main.tsx`;
- uma tela inicial, `src/pages/home` na rota `/`, gerada pelo mesmo modelo do `make:page` (com o teste e as mensagens nos dois idiomas);
- o eslint com o plugin do Prumo, o vitest com jsdom, o `AGENTS.md` (as camadas e os comandos, curto) e o `.mcp.json` com o servidor `prumo` (`pnpm exec prumo-mcp`);
- os scripts `dev`, `build`, `typecheck`, `lint`, `check`, `test` e `verify` (typecheck, lint, check e test, sem navegador).

As bibliotecas de terceiros têm as versões fixadas nos modelos (`templates/app`), e os cinco pacotes do Prumo entram como `^<versão>` (a versão de cada um está em `src/new/versions.ts`, que o `versions.test.ts` confere contra os `package.json` de `packages/*`: ao subir uma versão, atualize o arquivo). Com `--packages <pasta>` (os tarballs do `pnpm pack:all`), o `package.json` ganha `pnpm.overrides` com `file:` para os tarballs, e o app instala sem registry. Roda `git init` (sem commit) e `pnpm install`, a não ser com `--no-install`; sob o servidor MCP (ou qualquer Runtime sem `inheritStdio`), a saída do `pnpm install` é capturada e volta pelo `runtime.out`/`runtime.err` (`process.ts`), nunca direto no stdout do processo.

O app é montado numa pasta de rascunho e só vai ao destino se tudo deu certo. Valida antes de escrever (saída 2): o nome em kebab-case, o destino (não pode existir com conteúdo) e os tarballs (a pasta tem de ter os cinco). `--dry-run` lista os arquivos e não escreve nada.

### prumo make:domain

`prumo make:domain clientes` (o nome é o do domínio, no plural e em kebab-case) cria, a partir dos modelos do pacote:

| Arquivo                                                       | O que tem                                                                                                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/schemas/entities/cliente.ts`                             | O schema zod (`id`, `name`, `createdAt`) e o tipo, a entrada de criar e editar (`ClienteInput`) e a consulta da lista (`ClienteListQuery`, com busca, ordem e página) |
| `src/repositories/clientes/repository.contract.ts`            | A interface `IClientesRepository`: `list`, `get`, `create`, `update` e `remove`                                                                                       |
| `src/repositories/clientes/repository.mock.ts`, `fixtures.ts` | O mock em memória, com a latência simulada e os utilitários de `@matizze/prumo-core/mock`, e os dados de exemplo                                                      |
| `src/repositories/clientes/index.ts`                          | A fábrica `createClientesRepository`, que o container chama, e os exports do domínio                                                                                  |
| `src/repositories/clientes/repository.contract.test.ts`       | O contrato, com `defineContractSuite` e `runContractSuite` de `@matizze/prumo-testing/contract`, rodado contra o mock                                                 |
| `src/queries/clientes.ts`                                     | As query keys do core, as queries e os hooks `useClientesList`, `useClienteDetail`, `useCreateCliente`, `useUpdateCliente` e `useRemoveCliente`                       |

O domínio é registrado em `src/schemas/index.ts`, em `src/repositories/index.ts` (o import, o `export *` e a entrada no mapa `factories`, que é o container, em ordem alfabética) e em `src/queries/index.ts`. Os três índices podem estar vazios (o de um projeto novo): o primeiro domínio entra sem erro.

- **A entidade** é o singular do nome, tirando o `s` final. Onde a regra erra (`categories`, `status`...), o comando recusa e pede `--entity category`.
- **Os hooks** pegam o repositório de `useRepositories()`, de `@/providers/repository` (o provedor que `createRepositoryContext`, do core, cria), e as mutations invalidam as queries do domínio. O comando avisa se o projeto não tem esse provedor.
- **Valida antes de escrever** (nome kebab-case e que não é palavra reservada nem nome global, singular suspeito, índice que falta, domínio ou arquivo que já existe): erro de uso sai com 2 e não deixa o projeto pela metade. Nunca sobrescreve.
- **`--dry-run`** lista o que seria criado e alterado e não escreve nada.
- **No fim**, roda o `prumo check`: com violação (do projeto, não necessariamente do domínio) sai com 1, já com o domínio gerado. Mostra também o comando dos testes do domínio novo.

### prumo make:page

`prumo make:page clientes` (kebab-case) cria, a partir dos modelos, `src/pages/clientes/` com:

- `index.tsx`: liga o model à view (`const model = useClientesModel(); return <ClientesView {...model} />`);
- `model.ts`: o título e os textos, por `useTranslations('clientes')`, sem JSX;
- `view.tsx`: só elementos HTML semânticos, sem classe e sem componente de design system, e recebe tudo por props;
- `index.test.tsx`: renderiza com o `renderWithProviders` do projeto (`@/test/render`) e confere o título.

Cria `src/messages/<idioma>/clientes.json` em cada idioma do projeto (os `pt` com o texto em português; os outros, em inglês, para a pessoa traduzir), registra o namespace nos índices de mensagens e a rota `/clientes` no `src/App.tsx` (depois da última rota, com o import na ordem dos de `@/pages`; um `<Switch>` sem rota recebe a primeira).

Com `--domain clientes`, o model lê a lista do domínio (`useClientesList()`, de `@/queries/clientes`, o que o `make:domain` gera) e devolve `{ title, items, loading, failed }` mais os textos de carregando e de erro, e a view mostra o carregando, o erro e a lista (`<ul>` com `<li key={i.id}>{i.name}</li>`). O comando confere que o domínio existe e tem o hook antes de escrever. Valida o nome, recusa sobrescrever, aceita `--dry-run` e `--root`, roda o `prumo check` no fim (violação sai com 1, já com a tela gerada) e mostra o comando dos testes da tela.

### prumo make:component

`prumo make:component resumo --page clientes` gera `src/pages/clientes/components/resumo.tsx` (só HTML, com `ResumoProps`) e `resumo.test.tsx`; `--shared` gera em `src/components/shared/`. É um dos dois: sem nenhum, ou com os dois, o comando recusa (saída 2), e a tela de `--page` precisa existir. O `prumo check` cobra que o que está em `shared` seja usado por duas telas ou mais: um componente `--shared` recém-gerado aparece nessa violação (`shared-usage`), que o comando mostra e explica, e sai com 0. Qualquer outra violação sai com 1.

### prumo doctor

- **Node:** erro abaixo do Node 24, o mínimo do Prumo. Aviso se o `.nvmrc` (do projeto ou de uma pasta acima) ou o `engines.node` pedem outra versão.
- **pnpm:** erro se não existe. Aviso se o `package.json` não tem `packageManager`, se ele não é pnpm, ou se o pnpm instalado é de outra major ou mais antigo.
- **Pacotes do Prumo:** a versão instalada de cada `@matizze/prumo-*` contra uma faixa compatível (`>=0.1.0 <0.2.0`), não contra a igualdade, porque os pacotes versionam separados. As faixas estão em `src/doctor/ranges.ts`, e o `ranges.test.ts` as compara com o `package.json` de cada pacote do workspace.
- **`.npmrc`:** só quando ele manda o escopo `@matizze` para o `npm.pkg.github.com`: aviso (nunca falha) de que os pacotes agora estão no npm público e a linha pode sair; sem esse `.npmrc`, nenhuma linha. Nunca lê nem imprime token.
- **`.mcp.json`:** aviso se não existe, se não é um JSON de objeto ou se não tem o servidor `prumo` (o `prumo-mcp`), com o trecho a acrescentar.

## A API em processo

`@matizze/prumo-cli/api` (também exportada na raiz) roda e descreve os comandos sem subprocesso; é o que o servidor [`@matizze/prumo-mcp`](../mcp/README.md) usa. Importar não tem efeito colateral: nada é lido do `process` nem escrito.

| Função                                | O que faz                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runInProcess(argv, { cwd, env? })`   | Roda um comando e devolve `{ exitCode, stdout, stderr }`, sem escrever no stdout nem no stderr do processo e sem encerrá-lo. O `argv` é a linha de comando sem o `prumo` (`['check', '--root=app']`). Nada é lido de `process.cwd()` nem de `process.env`, e duas chamadas não compartilham estado.      |
| `describeCommands(root)`              | A árvore de comandos como dado, das definições do citty que a ajuda usa: cada comando folha com `name`, `path`, `toolName`, `summary`, `description` e `options`. A raiz é um argumento: `createRoot(runtime)`.                                                                                          |
| `toolNameOf(nome)`                    | O nome da ferramenta MCP de um comando: `make:page` vira `make_page`.                                                                                                                                                                                                                                    |
| `toArgv(command, input)`              | Os campos de uma chamada (um por argumento, com o nome da CLI) como linha de comando, sem o nome do comando. Opção de texto vira `--nome=valor`; liga e desliga vira `--nome` (e `--no-nome` se parte ligado); posicional que começa com `-`, campo desconhecido e valor de outro tipo são `UsageError`. |
| `createRoot(runtime)` e `runCli(...)` | A árvore de comandos e o executor que devolve o código de saída, os mesmos do `bin`.                                                                                                                                                                                                                     |

**O stdout é do protocolo.** No transporte stdio do MCP, uma linha solta no stdout corrompe o JSON-RPC. Por isso os comandos escrevem só pelo `Runtime` (`out`, `err`, `cwd` e `env`), e o `no-leak.test.ts` proíbe `process.stdout`, `process.stderr`, `console.` e `stdio: 'inherit'` em tudo, menos no `bin.ts`.

## Os modelos (`templates/`)

Os geradores não copiam tela nem domínio de outro projeto: cada arquivo gerado sai de um modelo em `templates/`, um arquivo `.tpl` com marcadores de nome. O `.tpl` evita que o TypeScript, o ESLint e o Vitest tomem o modelo por código, e o `templates.test.ts` confere que todo arquivo da pasta é usado por um gerador e todo modelo de um gerador existe.

- **Marcadores:** `{{plural.kebab}}`, `{{plural.pascal}}`, `{{plural.camel}}` e `{{plural.constant}}` (o mesmo para `singular`, `page`, `domain` e `component`; o `new` usa `{{app.kebab}}` e `{{app.title}}`): para `pedidos-recentes`, `pedidos-recentes`, `PedidosRecentes`, `pedidosRecentes` e `PEDIDOS_RECENTES`. O nome do marcador só tem letras, números e ponto, então um `{{` de JSX não é marcador. Marcador sem valor lança um erro: o gerador não escreve `undefined` no código de ninguém. `src/templates.ts` troca os marcadores (`renderTemplate`) e monta os valores de um nome (`nameVars`).
- **Caminhos:** cada gerador (`src/generate/<nome>.ts`) lista os pares modelo e destino, o destino também com marcadores (`src/repositories/{{plural.kebab}}/index.ts`), e monta tudo num `ChangePlan` em memória, junto com as costuras.
- **No tarball:** `templates/` está no `files` do `package.json`, e o caminho (`templates/`, um nível acima de `src/` e de `dist/`) vale no workspace e no pacote instalado. O `packaging.test.ts` confere que o tarball leva os mesmos arquivos e gera um domínio com o `prumo` empacotado.
- **O código gerado compila e roda:** o `generate/page.compile.test.ts` monta um projeto como o do `prumo new` (App sem rota, índices vazios, i18n, provedores e `renderWithProviders`), gera um domínio, três telas (uma com `--domain`) e dois componentes, e roda nele o `tsc` (estrito), o Vitest e o `prumo check`. O `generate/domain.compile.test.ts` cria um projeto mínimo, gera três domínios (um com nome composto e entidade explícita), e roda nele o `tsc` (estrito) e o Vitest, com o contrato de cada mock e os hooks de verdade.

## O codemod (interno)

`src/codemod/` guarda as costuras dos geradores: o `make:domain` usa as dos índices do domínio, e o `make:page` as das mensagens e da rota.

- **`ChangePlan`** (`plan.ts`): o plano de mudanças em memória, sobre um `Project` do ts-morph sem tsconfig e sem checagem de tipos. Recebe arquivos novos e costuras, lista o que seria criado e alterado (`summary()`, o `--dry-run`) e só grava no `commit()`: um erro no meio do caminho não deixa o projeto pela metade.
- **Nomes** (`names.ts`): valida o nome (kebab-case) e deriva Pascal, camel e, para domínios, singular e plural.
- **Rota** (`add-route.ts`): registra a rota de uma tela no `src/App.tsx`, com o import na ordem dos de `@/pages`. `addRouteSnippet` recebe o `<Route>` pronto em JSX (o que o `make:page` usa, sem `App.tsx` de origem); `addRoute` copia o de um `App.tsx` de origem.
- **Mensagens** (`register-messages.ts`, `messages.ts`): registra um namespace nos `index.ts` de cada idioma, em ordem alfabética, também num índice sem nenhum import (só o `export default {}`).
- **Domínio** (`register-domain.ts`, `merge-barrel.ts`): os exports de `src/schemas/index.ts` e de `src/queries/index.ts` e o import, o `export *` e o mapa `factories` de `src/repositories/index.ts`, também num índice sem nenhum domínio; o `mergeBarrel` acrescenta ao barrel os exports de outro barrel que faltam.

Os testes montam um projeto pequeno numa pasta temporária (`src/codemod/test-support.ts`) e não leem nada fora do pacote.

## Build e empacotamento

No workspace, o `exports` do pacote aponta para o código-fonte (`src/*.ts`), e o bin roda com um Node que executa `.ts` (Node 24 ou mais novo). Fora do monorepo o Node não faz type stripping dentro de `node_modules`, então o pacote tem `tsconfig.build.json` e o script `build` (`pnpm --filter @matizze/prumo-cli run build`), que emite o `dist/` com `.js` e `.d.ts`, sem os testes e os arquivos de apoio. O `publishConfig` troca `exports`, `types` e `bin` para o `dist/`, e o tarball leva só o `dist/`, os `templates/`, o `package.json` e o README. `pnpm pack:all`, na raiz, empacota os cinco pacotes, e o `packaging.test.ts` confere os tarballs e roda o `prumo` empacotado fora do monorepo.

## Dependências

`@matizze/prumo-rules` (`workspace:*`, a análise do `check`), `citty` (a árvore de comandos) e `ts-morph` (o codemod).
