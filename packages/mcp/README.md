# @matizze/prumo-mcp

Servidor MCP do Prumo: os comandos da CLI e o índice de padrões, como ferramentas para agentes de IA.

**Situação:** o servidor está pronto no workspace (Fase 4, passo I4): uma ferramenta por comando do `prumo`, por stdio, com o bin `prumo-mcp`. O build e o empacotamento (`dist/`, `publishConfig`), o servidor no starter e no `.mcp.json` do produto e o portão `pnpm verify:product` vêm nos próximos passos ([docs/fase-4.md](../../docs/fase-4.md)); a visão geral está na seção 9 de [docs/plano-prumo.md](../../docs/plano-prumo.md). Nada foi publicado: o pacote segue `"private": true`.

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

Os testes usam o cliente do SDK (`@modelcontextprotocol/client`, só de teste) contra o app em miniatura do codemod do cli:

- **Paridade, com a ajuda do `prumo` como oráculo** (e não o `describeCommands`, de que o servidor se serve): o conjunto de ferramentas é o conjunto de comandos de "Comandos:", e os campos e a obrigatoriedade de cada esquema são os de "Argumentos:", "Opções:" e da linha "Uso:".
- **O esquema:** cada tipo de argumento aceita o que a CLI aceita e recusa o que ela recusa.
- **As chamadas** (transporte em memória): `make_page` com `like` e `dry-run`, `check` com e sem violação, erro de uso, `patterns` e `catalog`, isolamento entre chamadas, a fila, e o `root` e o `dir` fora da pasta.
- **O stdout é o protocolo** (o bin por stdio): cada linha do stdout é JSON-RPC, e a saída dos comandos e dos subprocessos (`add` com um `shadcn` de mentira, `new --dry-run`) está nas respostas, nunca solta.

## Dependências

`@modelcontextprotocol/server` (o SDK oficial, v2) e `zod` em `dependencies`, mais `@matizze/prumo-cli` (`workspace:*`, de onde vêm `describeCommands`, `toArgv` e `runInProcess`); `@modelcontextprotocol/client` só em `devDependencies`, para os testes e o portão.

**Origem no app de referência:** `docs/patterns.md` e o teste do índice (`src/patterns-index.test.ts`, que virou a análise `references` do `prumo check`).
