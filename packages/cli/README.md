# @matizze/prumo-cli

O comando `prumo`: `make:domain`, `check` e `doctor`, e a API para rodar os comandos em processo.

**Situação:** o Prumo é uma ferramenta sem frontend ([docs/plano.md](../../docs/plano.md)). Na Fase A, a CLI ficou só com o que confere o projeto; os geradores simples voltam na Fase B, um por vez, e o `make:domain` é o primeiro. Faltam `make:page`, `make:component` e `new`. Nada foi publicado: o pacote segue `"private": true`.

## Comandos

| Comando                                                                       | O que faz                                                                                                                                                         |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prumo make:domain <nome> [--entity <singular>] [--root <pasta>] [--dry-run]` | Gera um domínio de dados (schema, repositório com mock e contrato, queries com hooks e o teste de contrato) e o registra nos índices e no container. Veja abaixo. |
| `prumo check [--root <pasta>]`                                                | Analisa o projeto (a análise do [`@matizze/prumo-rules`](../rules/README.md)) e escreve uma linha por violação, com o arquivo e a regra.                          |
| `prumo doctor [--root <pasta>]`                                               | Confere o ambiente e o projeto, uma linha por item com ok, aviso ou erro. Não escreve nada e não usa a rede.                                                      |

`--root` é a pasta do projeto (a que tem o `package.json` e o `src`); o padrão é a pasta atual. Códigos de saída: 0 sem erro, 1 com violação (`check`) ou erro (`doctor`), 2 para uso errado (comando ou opção desconhecidos, pasta que não é um projeto). `prumo --help` e `prumo <comando> --help` mostram a ajuda, em português.

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

### prumo doctor

- **Node:** erro abaixo do Node 24, o mínimo do Prumo. Aviso se o `.nvmrc` (do projeto ou de uma pasta acima) ou o `engines.node` pedem outra versão.
- **pnpm:** erro se não existe. Aviso se o `package.json` não tem `packageManager`, se ele não é pnpm, ou se o pnpm instalado é de outra major ou mais antigo.
- **Pacotes do Prumo:** a versão instalada de cada `@matizze/prumo-*` contra uma faixa compatível (`>=0.1.0 <0.2.0`), não contra a igualdade, porque os pacotes versionam separados. As faixas estão em `src/doctor/ranges.ts`, e o `ranges.test.ts` as compara com o `package.json` de cada pacote do workspace.
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

- **Marcadores:** `{{plural.kebab}}`, `{{plural.pascal}}`, `{{plural.camel}}` e `{{plural.constant}}` (o mesmo para `singular`): para `pedidos-recentes`, `pedidos-recentes`, `PedidosRecentes`, `pedidosRecentes` e `PEDIDOS_RECENTES`. O nome do marcador só tem letras, números e ponto, então um `{{` de JSX não é marcador. Marcador sem valor lança um erro: o gerador não escreve `undefined` no código de ninguém. `src/templates.ts` troca os marcadores (`renderTemplate`) e monta os valores de um nome (`nameVars`).
- **Caminhos:** cada gerador (`src/generate/<nome>.ts`) lista os pares modelo e destino, o destino também com marcadores (`src/repositories/{{plural.kebab}}/index.ts`), e monta tudo num `ChangePlan` em memória, junto com as costuras.
- **No tarball:** `templates/` está no `files` do `package.json`, e o caminho (`templates/`, um nível acima de `src/` e de `dist/`) vale no workspace e no pacote instalado. O `packaging.test.ts` confere que o tarball leva os mesmos arquivos e gera um domínio com o `prumo` empacotado.
- **O código gerado compila e roda:** o `generate/domain.compile.test.ts` cria um projeto mínimo, gera três domínios (um com nome composto e entidade explícita), e roda nele o `tsc` (estrito) e o Vitest, com o contrato de cada mock e os hooks de verdade.

## O codemod (interno)

`src/codemod/` guarda as costuras dos geradores: o `make:domain` usa as dos índices do domínio, e as outras esperam `make:page`.

- **`ChangePlan`** (`plan.ts`): o plano de mudanças em memória, sobre um `Project` do ts-morph sem tsconfig e sem checagem de tipos. Recebe arquivos novos e costuras, lista o que seria criado e alterado (`summary()`, o `--dry-run`) e só grava no `commit()`: um erro no meio do caminho não deixa o projeto pela metade.
- **Nomes** (`names.ts`): valida o nome (kebab-case) e deriva Pascal, camel e, para domínios, singular e plural.
- **Rota** (`add-route.ts`): registra a rota de uma tela no `src/App.tsx`, clonando o `<Route>` de um `App.tsx` de origem, com o import na ordem dos de `@/pages`.
- **Mensagens** (`register-messages.ts`, `messages.ts`): registra um namespace nos `index.ts` de cada idioma, em ordem alfabética.
- **Domínio** (`register-domain.ts`, `merge-barrel.ts`): os exports de `src/schemas/index.ts` e de `src/queries/index.ts` e o import, o `export *` e o mapa `factories` de `src/repositories/index.ts`, também num índice sem nenhum domínio; o `mergeBarrel` acrescenta ao barrel os exports de outro barrel que faltam.

Os testes montam um projeto pequeno numa pasta temporária (`src/codemod/test-support.ts`) e não leem nada fora do pacote.

## Build e empacotamento

No workspace, o `exports` do pacote aponta para o código-fonte (`src/*.ts`), e o bin roda com um Node que executa `.ts` (Node 24 ou mais novo). Fora do monorepo o Node não faz type stripping dentro de `node_modules`, então o pacote tem `tsconfig.build.json` e o script `build` (`pnpm --filter @matizze/prumo-cli run build`), que emite o `dist/` com `.js` e `.d.ts`, sem os testes e os arquivos de apoio. O `publishConfig` troca `exports`, `types` e `bin` para o `dist/`, e o tarball leva só o `dist/`, os `templates/`, o `package.json` e o README. `pnpm pack:all`, na raiz, empacota os cinco pacotes, e o `packaging.test.ts` confere os tarballs e roda o `prumo` empacotado fora do monorepo.

## Dependências

`@matizze/prumo-rules` (`workspace:*`, a análise do `check`), `citty` (a árvore de comandos) e `ts-morph` (o codemod).
