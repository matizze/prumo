# @matizze/prumo-mcp

Servidor MCP do Prumo: os comandos da CLI como ferramentas para agentes de IA.

**Situação:** uma ferramenta por comando do `prumo`, por stdio, com o bin `prumo-mcp`. Hoje a CLI tem `make:page`, `make:domain`, `make:component`, `check` e `doctor`, e o servidor expõe esses; a ferramenta do `new` chega com ele, na Fase B ([docs/plano.md](../../docs/plano.md)). Nada foi publicado: o pacote segue `"private": true`.

## Como ligar

O servidor roda na máquina de quem usa o agente, na pasta do projeto, e fala por stdio. Ligue-o pelo `.mcp.json` da raiz do projeto (o que o Claude Code e outros clientes MCP leem):

```json
{
  "mcpServers": {
    "prumo": { "command": "pnpm", "args": ["exec", "prumo-mcp"] }
  }
}
```

O `prumo-mcp` é o bin deste pacote, que o projeto tem como `devDependency`. Não o rode à mão: o stdout é o protocolo. `prumo-mcp --help` e `--version` escrevem a ajuda e a versão e saem.

## As ferramentas

Uma ferramenta por comando, com o nome do comando com `:` trocado por `_`. Não há ferramenta escrita à mão: o nome, a descrição e o esquema de entrada saem da árvore de comandos da CLI (`describeCommands`), então um comando novo vira ferramenta sem mudar o servidor.

| Ferramenta       | Comando                | Campos                                       |
| ---------------- | ---------------------- | -------------------------------------------- |
| `check`          | `prumo check`          | `root`                                       |
| `doctor`         | `prumo doctor`         | `root`                                       |
| `make_component` | `prumo make:component` | `nome`, `page`, `shared`, `root` e `dry-run` |
| `make_domain`    | `prumo make:domain`    | `nome`, `entity`, `root` e `dry-run`         |
| `make_page`      | `prumo make:page`      | `nome`, `domain`, `root` e `dry-run`         |

- **O nome do campo é o do argumento na CLI, sem tradução.** `toArgv`, da CLI, faz o mapa de campo para linha de comando. O esquema é derivado dos argumentos, e um campo que o comando não tem é recusado.
- **A saída é o texto da CLI, sem moldura:** o stdout e, depois, o stderr do comando, e, quando o código de saída não é 0, uma última linha `[saída <código>]`. `isError` é verdadeiro quando o código não é 0: o `check` com violação (saída 1) e o uso errado (saída 2) são erro da ferramenta, como no terminal.
- **O comando roda em processo** (`runInProcess`, de `@matizze/prumo-cli/api`), com o `cwd` da pasta onde o servidor roda e o ambiente do servidor.
- **Uma chamada de cada vez.** O cliente pode pedir várias juntas, mas dois comandos escrevendo no mesmo projeto se atropelariam, então o servidor as roda em fila.
- **O `root` e o `dir` ficam dentro da pasta do servidor.** Quem escolhe o valor é o agente, e `root: "/"` o levaria para fora do projeto. O servidor resolve os dois contra o `cwd` (seguindo links simbólicos) e recusa, com `isError` e sem rodar o comando, o que sai da pasta. É a única regra do servidor que não vem da CLI.

Só ferramentas: o servidor não expõe resources nem prompts, e o transporte é só stdio.

## API

- `createServer({ cwd?, env?, commands? })`: monta o servidor (`McpServer` do SDK, nome `prumo`, versão do `package.json`) e devolve `{ server, tools }`, sem ligar a transporte. `commands` troca a árvore do `prumo` por outra lista de `CommandInfo`.
- `toolsOf(commands, { cwd, env? })`: uma `PrumoTool` por comando.
- `inputSchemaOf(command)`: o esquema zod da ferramenta de um comando.

## Testes

Usam o cliente do SDK (`@modelcontextprotocol/client`, só de teste) contra um projeto mínimo numa pasta temporária: a paridade das ferramentas com a ajuda do `prumo` (o oráculo é a ajuda, não o `describeCommands`), o esquema de cada tipo de argumento, as chamadas (`check` com e sem violação, erro de uso, isolamento, fila, `root` e `dir` fora da pasta) e o bin por stdio (cada linha do stdout é JSON-RPC, e a saída dos comandos está nas respostas).

## Build e empacotamento

No workspace, o `exports` e o `bin` apontam para o código-fonte (`src/*.ts`). O pacote tem `tsconfig.build.json` e o script `build`, que emite o `dist/`; o `publishConfig` troca `exports` e `bin` para ele, e o `@matizze/prumo-cli` (`workspace:*`) vira a versão exata no tarball. O `packaging.test.ts` do cli confere o tarball e sobe o `prumo-mcp` empacotado, com o `node` comum, para um `initialize` e um `tools/list` por stdio.

## Dependências

`@modelcontextprotocol/server` (o SDK oficial, v2) e `zod` em `dependencies`, mais `@matizze/prumo-cli` (`workspace:*`); `@modelcontextprotocol/client` só em `devDependencies`, para os testes.
