---
'@matizze/prumo-cli': minor
---

Erros mais curtos, ajuda com exemplos, `prumo help` e busca do projeto.

- Erro de opção ou argumento: `prumo: <mensagem>`, a linha de uso e `Veja 'prumo <comando> --help'.`, sem a ajuda inteira. **Quebra:** quem lia a ajuda do comando no stderr não a recebe mais.
- Erro de um comando (domínio que não existe, nome inválido): só `prumo: <mensagem>`, sem a ajuda. **Quebra:** o mesmo.
- Erro inesperado: `prumo: erro inesperado: <mensagem>`; a pilha só com `PRUMO_DEBUG` ligado (`1`, por exemplo). Na ferramenta MCP o erro inesperado sempre traz a pilha.
- O servidor MCP separa a violação do `check` de um erro inesperado pelo tipo de saída, não pelo texto do stderr.
- As descrições das ferramentas MCP continuam completas (formatos, regras, pré-requisitos), separadas do texto do terminal.
- A ajuda dos comandos ficou enxuta, com `Exemplos:` e `Referência:` (link da documentação); a da raiz termina com o link do site. O detalhe está em `docs/reference/cli.md`.
- `--packages` do `new` saiu da ajuda (continua funcionando).
- A ajuda do `prumo mcp` mostra o trecho do `.mcp.json` inteiro, em qualquer largura de terminal.
- `prumo help <comando>` mostra a ajuda do comando; um nome que não é comando dá o erro de comando desconhecido, com a sugestão.
- Sem `--root`, os comandos procuram o projeto subindo da pasta atual (a primeira com `src` e um `package.json` que depende de `@matizze/prumo-*`): `prumo make:page x` funciona de dentro de `src/pages`. Com `--root`, vale a pasta exata, como antes.
- **Quebra:** o `variation` das telas no `prumo list --json` (e na ferramenta `list` do MCP, e no tipo `ProjectListing`) passa de `titulo`, `lista`, `parametro` e `detalhe` para `title`, `list`, `param` e `detail`. O texto do `prumo list` sem `--json` mantém os rótulos em português (agora com acento: `título`, `parâmetro`).
