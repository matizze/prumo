---
'@matizze/prumo-cli': minor
---

Voltaram o `prumo new` e o `prumo check`, agora na CLI nova com o commander. O app novo vem sem o `.mcp.json` e sem o `@matizze/prumo-mcp`, com a fonte de dados `mock` (no lugar de `memory`) e com o `AGENTS.md` e o `README.md` descrevendo os comandos da v1 (`make:schema`, `make:repository`, `make:query`, `make:page` e `check`). O `check` escreve uma violação por linha e sai com 0, 1 (violação) ou 2 (a pasta não é um projeto).
