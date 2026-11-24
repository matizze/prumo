---
'@matizze/prumo-cli': minor
---

O `prumo new` cria o `.mcp.json`, que registra o servidor `prumo` (`pnpm exec prumo mcp`), e o `AGENTS.md` e o `README.md` do app passam a citar o servidor MCP, as ferramentas e os parâmetros. O `pnpm verify:new` ganha a etapa `mcp`: um cliente do SDK abre o servidor pelo `.mcp.json` do app e gera, só por ferramentas, um domínio e duas telas.
