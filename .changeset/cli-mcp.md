---
'@matizze/prumo-cli': minor
---

O Prumo ganha o servidor MCP e um comando para ver o que o projeto tem.

- **`prumo list [--root <pasta>] [--json]`:** mostra o que o projeto já tem (schemas com os campos que o Prumo reconhece, repositórios com as fontes `mock`, `http` e `storage`, queries com os hooks, telas com rota, variação e query, e idiomas), só lendo os arquivos. Com `--json`, escreve um objeto estável (`schemas`, `repositories`, `queries`, `pages`, `languages`), tipado em `ProjectListing`. Sai com 2 se a pasta não é um projeto.
- **`prumo mcp [--root <pasta>]`:** abre o servidor MCP do projeto, por stdio, para agentes de IA usarem o Prumo. Há uma ferramenta por comando (`make_schema`, `make_repository`, `make_query`, `make_page`, `check` e `list`), com os mesmos parâmetros do comando em snake_case sem acento (`dominio`, `nome`, `entity`, `fields`, `data_source`, `query`, `path` e `dry_run`) e a descrição da ajuda. As chamadas rodam em processo, uma de cada vez, na pasta do projeto, e nenhuma ferramenta escreve fora dele. O resultado é o texto da saída, com `isError` para código diferente de 0 (menos o `check` com violação, que é um resultado). O `--help` mostra o trecho do `.mcp.json` para colar num projeto que não saiu do `prumo new`.
- **O app novo já vem ligado:** o `prumo new` cria o `.mcp.json`, que registra o servidor `prumo` (`pnpm exec prumo mcp`), e o `AGENTS.md` e o `README.md` do app passam a citar o servidor, as ferramentas e os parâmetros.
- **Substitui o `@matizze/prumo-mcp`:** o pacote antigo (até a 0.2.0) não volta. Quem o usava passa a usar o `prumo mcp`, que vem no `@matizze/prumo-cli`.

O SDK do MCP só é carregado dentro do `prumo mcp`: os outros comandos não pagam por ele.
