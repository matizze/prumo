# @matizze/prumo-mcp

Servidor MCP do Prumo: os comandos da CLI e o índice de padrões, como ferramentas para agentes de IA.

**Situação:** esqueleto da Fase 0, sem código de produção. O conteúdo chega na Fase 4 (plano em [docs/fase-4.md](../../docs/fase-4.md)); a visão geral está na seção 9 de [docs/plano-prumo.md](../../docs/plano-prumo.md).

**Origem no app de referência:** `docs/patterns.md` e o teste do índice (`src/patterns-index.test.ts`).

## O que vem na Fase 4

- **Uma ferramenta por comando do `prumo`.** O nome é o do comando com `:` trocado por `_` (`make_page`, `make_domain`, `make_component`, `add`, `promote`, `check`, `doctor`, `new`, e os que a fase cria: `patterns`, `catalog` e `agents`). O esquema de entrada sai da definição dos argumentos do comando, não é escrito à mão, e o nome de cada campo é o da CLI (`dry-run`, `nome`, `like`).
- **Sem lógica própria.** A ferramenta roda o comando em processo, com um Runtime que captura a saída, e devolve o texto da CLI, com `isError` quando o código de saída não é 0. Um teste confere a paridade com a CLI nos dois sentidos. O que o agente precisa e a CLI não tinha (o índice de padrões e a lista do catálogo) vira comando da CLI primeiro: pessoas e agentes seguem o mesmo caminho.
- **Só stdio, só ferramentas.** O servidor roda na máquina de quem usa o agente (`pnpm exec prumo-mcp`, ligado pelo `.mcp.json` do produto). Resources, prompts e o transporte HTTP ficam fora da fase. O `root` e o `dir` de uma ferramenta ficam dentro da pasta onde o servidor roda.
- **Dependências:** `@modelcontextprotocol/server` (o SDK oficial, v2), `zod` e `@matizze/prumo-cli`; o `@modelcontextprotocol/client` é só de teste e do portão.
- **O portão:** a etapa `mcp` do `pnpm verify:product` sobe o servidor de um produto novo e, só por ferramentas, consulta os padrões, gera uma tela e um domínio e roda o `check`; o `pnpm verify` do produto confere o que o MCP gerou.
