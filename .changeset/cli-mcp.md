---
'@matizze/prumo-cli': minor
---

Novo comando `prumo mcp [--root <pasta>]`: abre o servidor MCP do projeto, por stdio, para agentes de IA usarem o Prumo. Há uma ferramenta por comando (`make_schema`, `make_repository`, `make_query`, `make_page`, `check` e `list`), descrita a partir da árvore de comandos: nome com `_` no lugar de `:`, parâmetros em snake_case sem acento (`dominio`, `data_source`, `dry_run`) e a descrição da ajuda. As chamadas rodam em processo, uma de cada vez, na pasta do projeto, e nenhuma ferramenta escreve fora dele. O resultado é o texto da saída, com `isError` para código diferente de 0 (menos o `check` com violação). O `--help` mostra o trecho do `.mcp.json` para colar. O SDK do MCP só é carregado dentro do `prumo mcp`.
