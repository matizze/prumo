# @matizze/prumo-mcp

O servidor [MCP](https://modelcontextprotocol.io) do [Prumo](https://github.com/matizze/prumo): os comandos da CLI `prumo` como ferramentas para agentes de IA, como o Claude Code.

**[Documentação](https://github.com/matizze/prumo/blob/main/docs/README.md)** · **[Guia de agentes de IA](https://github.com/matizze/prumo/blob/main/docs/guides/ai-agents.md)** · **[Referência deste pacote](https://github.com/matizze/prumo/blob/main/docs/reference/mcp.md)** · **[Changelog](https://github.com/matizze/prumo/blob/main/packages/mcp/CHANGELOG.md)**

## Instalação

Um app criado pelo `prumo new` já tem o pacote e o `.mcp.json` com o servidor. Num projeto existente:

```bash
pnpm add -D @matizze/prumo-mcp
```

E ligue o servidor no `.mcp.json` da raiz do projeto:

```json
{
  "mcpServers": {
    "prumo": { "command": "pnpm", "args": ["exec", "prumo-mcp"] }
  }
}
```

O servidor roda na pasta do projeto e fala por stdio. Não o rode à mão: o stdout é o protocolo. `prumo-mcp --help` e `--version` mostram a ajuda e a versão.

## Ferramentas

Uma por comando da CLI, com o nome do comando (`:` vira `_`) e os campos com o nome dos argumentos. Nada é escrito à mão: tudo sai da árvore de comandos da CLI.

| Ferramenta       | Comando                | Campos                                           |
| ---------------- | ---------------------- | ------------------------------------------------ |
| `new`            | `prumo new`            | `nome`, `dir`, `packages`, `install`, `dry-run` |
| `make_page`      | `prumo make:page`      | `nome`, `domain`, `root`, `dry-run`             |
| `make_domain`    | `prumo make:domain`    | `nome`, `entity`, `root`, `dry-run`             |
| `make_component` | `prumo make:component` | `nome`, `page`, `shared`, `root`, `dry-run`     |
| `check`          | `prumo check`          | `root`                                           |
| `doctor`         | `prumo doctor`         | `root`                                           |

- A resposta é o texto da CLI; quando o código de saída não é 0, a resposta tem `isError` e termina com `[saída <código>]`.
- As chamadas rodam uma de cada vez, em fila.
- `root` e `dir` precisam ficar dentro da pasta do servidor (seguindo links simbólicos): o que sai dela é recusado sem rodar o comando.
- Só ferramentas, só stdio: sem resources, prompts nem porta de rede.

## Suporte

Mantido pela [Matizze](https://github.com/matizze). Problemas e sugestões em [issues](https://github.com/matizze/prumo/issues).
