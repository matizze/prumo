---
'@matizze/prumo-cli': minor
'@matizze/prumo-mcp': minor
---

Promover um componente de tela a compartilhado agora é um comando:

- `prumo move:component <nome> --from <tela> --shared` (ferramenta MCP `move_component`) move o componente e o teste dele de `src/pages/<tela>/components/` para `src/components/shared/` e reescreve para `@/components/shared/<nome>` todo import que apontava para ele (na tela de origem e em qualquer outro arquivo de `src`, inclusive `vi.mock` e `import()`). Aceita `--dry-run`. Recusa, sem mexer em nada, o nome inválido, a tela ou o componente que não existe, o homônimo já em `shared` e o componente que importa algo de uma tela. No fim roda o `prumo check`: a `shared-usage` do componente movido, ainda de uma tela só, é mostrada como esperada e não faz o comando falhar. O caminho inverso (de `shared` para uma tela) não existe.
- `make:component` avisa (`Aviso: ...`, sem recusar) quando já existe um componente de mesmo nome em outra tela ou em `shared`, e sugere o `move:component`. O mesmo nome no mesmo lugar continua recusado.
- O `AGENTS.md` do app novo lista o comando novo, e `docs/reference/cli.md`, `docs/reference/mcp.md` e o guia de telas descrevem o caminho "o componente passou a ser usado por duas telas".
