# @matizze/prumo-cli

O comando `prumo`: `check` e `doctor`, e a API para rodar os comandos em processo.

**Situação:** o Prumo é uma ferramenta sem frontend ([docs/plano.md](../../docs/plano.md)). Na Fase A, a CLI ficou só com o que confere o projeto; os geradores simples (`new`, `make:page`, `make:domain`, `make:component`) voltam na Fase B. Nada foi publicado: o pacote segue `"private": true`.

## Comandos

| Comando                         | O que faz                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `prumo check [--root <pasta>]`  | Analisa o projeto (a análise do [`@matizze/prumo-rules`](../rules/README.md)) e escreve uma linha por violação, com o arquivo e a regra. |
| `prumo doctor [--root <pasta>]` | Confere o ambiente e o projeto, uma linha por item com ok, aviso ou erro. Não escreve nada e não usa a rede.                             |

`--root` é a pasta do projeto (a que tem o `package.json` e o `src`); o padrão é a pasta atual. Códigos de saída: 0 sem erro, 1 com violação (`check`) ou erro (`doctor`), 2 para uso errado (comando ou opção desconhecidos, pasta que não é um projeto). `prumo --help` e `prumo <comando> --help` mostram a ajuda, em português.

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

## O codemod (interno)

`src/codemod/` guarda as costuras que os geradores da Fase B vão reaproveitar. Nada disso é comando ainda.

- **`ChangePlan`** (`plan.ts`): o plano de mudanças em memória, sobre um `Project` do ts-morph sem tsconfig e sem checagem de tipos. Recebe arquivos novos e costuras, lista o que seria criado e alterado (`summary()`, o `--dry-run`) e só grava no `commit()`: um erro no meio do caminho não deixa o projeto pela metade.
- **Nomes** (`names.ts`): valida o nome (kebab-case) e deriva Pascal, camel e, para domínios, singular e plural.
- **Rota** (`add-route.ts`): registra a rota de uma tela no `src/App.tsx`, clonando o `<Route>` de um `App.tsx` de origem, com o import na ordem dos de `@/pages`.
- **Mensagens** (`register-messages.ts`, `messages.ts`): registra um namespace nos `index.ts` de cada idioma, em ordem alfabética.
- **Domínio** (`register-domain.ts`, `merge-barrel.ts`): os exports de `src/schemas/index.ts` e de `src/queries/index.ts` e o import, o `export *` e o mapa `factories` de `src/repositories/index.ts`; o `mergeBarrel` acrescenta ao barrel os exports de outro barrel que faltam.

Os testes montam um projeto pequeno numa pasta temporária (`src/codemod/test-support.ts`) e não leem nada fora do pacote.

## Build e empacotamento

No workspace, o `exports` do pacote aponta para o código-fonte (`src/*.ts`), e o bin roda com um Node que executa `.ts` (Node 24 ou mais novo). Fora do monorepo o Node não faz type stripping dentro de `node_modules`, então o pacote tem `tsconfig.build.json` e o script `build` (`pnpm --filter @matizze/prumo-cli run build`), que emite o `dist/` com `.js` e `.d.ts`, sem os testes e os arquivos de apoio. O `publishConfig` troca `exports`, `types` e `bin` para o `dist/`, e o tarball leva só o `dist/`, o `package.json` e o README. `pnpm pack:all`, na raiz, empacota os cinco pacotes, e o `packaging.test.ts` confere os tarballs e roda o `prumo` empacotado fora do monorepo.

## Dependências

`@matizze/prumo-rules` (`workspace:*`, a análise do `check`), `citty` (a árvore de comandos) e `ts-morph` (o codemod).
