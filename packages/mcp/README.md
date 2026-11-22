# @matizze/prumo-mcp

Servidor MCP do Prumo: os comandos da CLI e o índice de padrões, como ferramentas para agentes de IA.

**Situação:** Fase 4 concluída. O servidor está pronto e empacotado como os outros pacotes: uma ferramenta por comando do `prumo`, por stdio, com o bin `prumo-mcp`. O starter o tem como `devDependency` e o `.mcp.json` do produto registra o servidor `prumo`; o portão `pnpm verify:product` o exercita na etapa `mcp` (veja "O portão do produto", abaixo), e uma rodada com um agente de verdade ("A rodada com um agente de verdade", abaixo) criou uma tela e um domínio só por ele. O plano e o resultado estão em [docs/fase-4.md](../../docs/fase-4.md#resultado), e a visão geral, na seção 9 de [docs/plano-prumo.md](../../docs/plano-prumo.md). Nada foi publicado: o pacote segue `"private": true` e está na 0.0.0 até o pull request de versão da Fase 4 (0.1.0).

## Como ligar

O servidor roda na máquina de quem usa o agente, na pasta do projeto, e fala por stdio. Ligue-o pelo `.mcp.json` da raiz do projeto (o que o Claude Code e outros clientes MCP leem):

```json
{
  "mcpServers": {
    "prumo": { "command": "pnpm", "args": ["exec", "prumo-mcp"] }
  }
}
```

O `prumo-mcp` é o bin deste pacote, que o projeto tem como `devDependency`. Dentro do monorepo, `node packages/mcp/src/bin.ts` (a partir da pasta do projeto) faz o mesmo. Não o rode à mão: o stdout é o protocolo. `prumo-mcp --help` e `--version` escrevem a ajuda e a versão e saem.

## Build e empacotamento

No workspace, o `exports` e o `bin` apontam para o código-fonte (`src/*.ts`). Fora do monorepo o Node não faz type stripping dentro de `node_modules`, então o pacote tem `tsconfig.build.json` e o script `build` (`pnpm --filter @matizze/prumo-mcp run build`), que emite o `dist/` com `.js` e `.d.ts` (sem os testes e os arquivos de apoio deles). O `publishConfig` troca `exports` e `bin` (`prumo-mcp`, em `dist/bin.js`) para o `dist/` e define o registry `https://npm.pkg.github.com` (acesso restrito); o `pnpm pack` aplica a troca, e o tarball leva só o `dist/`, o `package.json` e o README. O `@matizze/prumo-cli` (`workspace:*`) vira a versão exata dele no tarball. `pnpm pack:all`, na raiz, empacota os cinco pacotes numa pasta, na ordem de publicação (rules, core, testing, cli, mcp), e o `packaging.test.ts` do cli confere o tarball do mcp e sobe o `prumo-mcp` empacotado, com o `node` comum, para um `initialize` e um `tools/list` por stdio. O pacote continua `"private": true`: nada é publicado até uma pessoa fazer a primeira publicação ([docs/publicacao.md](../../docs/publicacao.md)).

## As ferramentas

Uma ferramenta por comando do `prumo` (o mesmo que a pessoa roda no terminal), com o nome do comando com `:` trocado por `_`. Não há ferramenta escrita à mão: o nome, a descrição e o esquema de entrada saem da árvore de comandos da CLI (`describeCommands`), então um comando novo vira ferramenta sem mudar o servidor.

| Ferramenta       | Comando                | Campos principais                                                     |
| ---------------- | ---------------------- | --------------------------------------------------------------------- |
| `make_page`      | `prumo make:page`      | `nome`, `like`, `menu`, `root`, `dry-run`                             |
| `make_domain`    | `prumo make:domain`    | `nome`, `entity`, `root`, `dry-run`                                   |
| `make_component` | `prumo make:component` | `nome`, `page`, `root`, `dry-run`                                     |
| `add`            | `prumo add`            | `item` (lista), `root`, `from`, `ref`, `diff`, `dry-run`, `overwrite` |
| `promote`        | `prumo promote`        | `componente`, `from`, `root`, `dry-run`                               |
| `check`          | `prumo check`          | `root`                                                                |
| `doctor`         | `prumo doctor`         | `root`                                                                |
| `new`            | `prumo new`            | `nome`, `dir`, `from`, `ref`, `packages`, `ds`, `install`, `dry-run`  |
| `patterns`       | `prumo patterns`       | `busca`, `root`, `from`, `ref`, `json`                                |
| `catalog`        | `prumo catalog`        | `busca`, `kind`, `from`, `ref`, `json`                                |
| `agents`         | `prumo agents`         | `root`, `check`, `dry-run`                                            |

- **O nome do campo é o do argumento na CLI, sem tradução.** `dry-run` é o campo `dry-run`, o posicional `nome` é o campo `nome`, e o posicional variádico `item...` do `add` é o campo `item`, uma lista. `toArgv`, da CLI, faz o mapa de campo para linha de comando.
- **O esquema é derivado dos argumentos.** Texto é `string` (o posicional, sem começar por `-`, que o parser leria como opção), o variádico é uma lista com ao menos um item, liga e desliga é `boolean`, `enum` é a lista de valores, e o que o comando exige é obrigatório. Um campo que o comando não tem é recusado.
- **A saída é o texto da CLI, sem moldura:** o stdout e, depois, o stderr do comando, e, quando o código de saída não é 0, uma última linha `[saída <código>]`. `isError` é verdadeiro quando o código não é 0: o `check` com violação (saída 1) e o uso errado (saída 2) são erro da ferramenta, como no terminal, e o agente lê o motivo no texto. Para dados estruturados, use `json` em `patterns` e `catalog`.
- **O comando roda em processo** (`runInProcess`, de `@matizze/prumo-cli/api`), sem terminal: não pergunta nada (onde perguntaria, recusa e diz o comando que resolve), e a saída dos subprocessos (`pnpm install`, `shadcn`) volta na resposta. O `cwd` é a pasta onde o servidor roda, e o ambiente é o do servidor (`PATH`, `PRUMO_REPOSITORY`, `MADS_REGISTRY_*`).
- **Uma chamada de cada vez.** O cliente pode pedir várias juntas, mas dois comandos escrevendo no mesmo projeto se atropelariam (duas telas no `App.tsx`), então o servidor as roda em fila.
- **O `root` e o `dir` ficam dentro da pasta do servidor.** Quem escolhe o valor é o agente, e `root: "/"` ou `dir: "~"` o levaria a escrever fora do projeto. O servidor resolve os dois contra o `cwd` (seguindo links simbólicos) e recusa, com `isError` e sem rodar o comando, o que sai da pasta. É a única regra do servidor que não vem da CLI, e existe por segurança. O `from`, o `packages` e o `ref` são de leitura e ficam livres.

Só ferramentas: o servidor não expõe resources nem prompts, e o transporte é só stdio (sem HTTP).

## API

O `@matizze/prumo-mcp` exporta as peças, para os testes e o portão do produto:

- `createServer({ cwd?, env?, commands? })`: monta o servidor (`McpServer` do SDK, nome `prumo`, versão do `package.json`) e devolve `{ server, tools }`, sem ligar a transporte. `commands` troca a árvore do `prumo` por outra lista de `CommandInfo`.
- `toolsOf(commands, { cwd, env? })`: uma `PrumoTool` por comando (`name`, `description`, `command`, `inputSchema` e `call`).
- `inputSchemaOf(command)`: o esquema zod da ferramenta de um comando.

## Testes

Os testes (63 no total, com os das funções do portão) usam o cliente do SDK (`@modelcontextprotocol/client`, só de teste) contra o app em miniatura do codemod do cli:

- **Paridade, com a ajuda do `prumo` como oráculo** (e não o `describeCommands`, de que o servidor se serve): o conjunto de ferramentas é o conjunto de comandos de "Comandos:", e os campos e a obrigatoriedade de cada esquema são os de "Argumentos:", "Opções:" e da linha "Uso:".
- **O esquema:** cada tipo de argumento aceita o que a CLI aceita e recusa o que ela recusa.
- **As chamadas** (transporte em memória): `make_page` com `like` e `dry-run`, `check` com e sem violação, erro de uso, `patterns` e `catalog`, isolamento entre chamadas, a fila, e o `root` e o `dir` fora da pasta.
- **O stdout é o protocolo** (o bin por stdio): cada linha do stdout é JSON-RPC, e a saída dos comandos e dos subprocessos (`add` com um `shadcn` de mentira, `new --dry-run`) está nas respostas, nunca solta.

## O portão do produto

A etapa `mcp` do `pnpm verify:product` (`scripts/verify-product.sh`) roda o `scripts/product-gate.ts` deste pacote, um cliente do SDK (`@modelcontextprotocol/client`, por isso o script mora aqui, fora do `dist/` e do tarball). Ele sobe por stdio o `prumo-mcp` instalado no produto novo (o dos tarballs, de `dist/`, pelo mesmo comando do `.mcp.json`: `pnpm exec prumo-mcp`, com o `cwd` no produto) e, só por ferramentas:

1. lista as ferramentas e confere que são exatamente os comandos de `pnpm exec prumo --help` (o oráculo é a CLI instalada no produto, a única chamada de processo do script, só de leitura);
2. chama `patterns` (busca `kanban`) e confere o caminho `prumo make:page <nome> --like kanban`, e `catalog` (busca `metric`) e confere o `metric-card`, os dois com `from` a origem extraída do HEAD;
3. gera uma tela de um padrão diferente do da etapa `generate`: `make_page` com `portao-mcp-kanban`, `like` `kanban` e `menu` `ecommerce` (o `detalhe` não serve: o `--menu` recusa uma rota com parâmetro);
4. gera um domínio com `make_domain` (`portao-mcp-itens`) e roda o `check`;
5. faz um uso errado (`make_page` com nome inválido), que volta `isError` e `[saída 2]`, e confere que o `check` seguinte continua limpo.

Cada chamada tem limite de 5 minutos, e o script sai com 1 e a lista do que falhou (mais o stderr do servidor). Não escreve nada no produto: quem escreve é o servidor, a pedido das ferramentas, e o `pnpm verify` do produto, na etapa `run` seguinte, prova que o gerado passa. As funções puras do script (ler a ajuda do `prumo`, comparar os nomes, conferir um resultado) estão em `scripts/product-gate-lib.ts`, com testes que não sobem produto nenhum.

## A rodada com um agente de verdade

O portão acima usa um cliente de teste. Uma vez, no fim da Fase 4, um agente de verdade (Claude Code, `claude -p`) trabalhou num produto novo só por este servidor: `--mcp-config` com o servidor `prumo` e `--strict-mcp-config`, e, entre as ferramentas do Claude Code, só `Read`, `Glob` e `Grep` (sem `Edit`, `Write` nem `Bash`). Pedido: uma tela de lista de fornecedores com menu e o domínio de dados deles. Ele leu o `AGENTS.md`, chamou `patterns` (a primeira linha trazia `prumo make:page <nome> --like lista`), `make_domain`, `make_page` (`like` `lista`, `menu` `ecommerce`) e `check` (nenhuma violação), em 7 turnos e 18 s, sem chamada com erro, e o `pnpm verify` do produto passou. O registro completo, com o que ficou estranho (a tela continua no domínio de produtos, o grupo de menu não aparece nas descrições, a mensagem de "não encontrado" é genérica), está no [Resultado da fase](../../docs/fase-4.md#a-rodada-com-um-agente-de-verdade-r).

## Fora do escopo

Só ferramentas e só stdio: sem resources, sem prompts e sem transporte HTTP. Se um agente remoto ou um cliente sem stdio pedir, é uma fase própria ([docs/fase-4.md](../../docs/fase-4.md#pendências-fora-da-fase)).

## Dependências

`@modelcontextprotocol/server` (o SDK oficial, v2) e `zod` em `dependencies`, mais `@matizze/prumo-cli` (`workspace:*`, de onde vêm `describeCommands`, `toArgv` e `runInProcess`); `@modelcontextprotocol/client` só em `devDependencies`, para os testes e o portão.

**Origem no app de referência:** `docs/patterns.md` e o teste do índice (`src/patterns-index.test.ts`, que virou a análise `references` do `prumo check`).
