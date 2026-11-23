# Referência do `@matizze/prumo-mcp`

O servidor [MCP](https://modelcontextprotocol.io) do Prumo: os comandos da CLI como ferramentas para agentes de IA. O guia de uso está em [Agentes de IA](../guides/ai-agents.md).

```bash
pnpm add -D @matizze/prumo-mcp
```

Um app criado pelo `prumo new` já tem o pacote e o `.mcp.json`.

## O bin `prumo-mcp`

```text
prumo-mcp [--help | --version]
```

Sem argumentos, sobe o servidor no **stdio**, na pasta atual (a do projeto). O stdout é do protocolo JSON-RPC: tudo o que o processo escreveria no console vai para o stderr. Não rode o servidor à mão para testar comandos; use o `prumo` no terminal.

| Opção            | Descrição                    |
| ---------------- | ---------------------------- |
| `-h`, `--help`   | Mostra a ajuda e sai         |
| `-v`, `--version`| Mostra a versão e sai        |

Uma opção desconhecida sai com código 2.

**Configuração do cliente** (`.mcp.json` na raiz do projeto, o formato que o Claude Code e outros clientes leem):

```json
{
  "mcpServers": {
    "prumo": { "command": "pnpm", "args": ["exec", "prumo-mcp"] }
  }
}
```

## As ferramentas

Uma ferramenta por comando da CLI. O nome é o do comando com `:` trocado por `_`, e a descrição é a da ajuda do comando. Não há ferramenta escrita à mão: tudo sai da árvore de comandos da CLI (`describeCommands`), então um comando novo vira ferramenta sem mudar o servidor.

| Ferramenta       | Comando                | Campos                                                    |
| ---------------- | ---------------------- | --------------------------------------------------------- |
| `check`          | `prumo check`          | `root?`                                                   |
| `doctor`         | `prumo doctor`         | `root?`                                                   |
| `make_component` | `prumo make:component` | `nome`, `page?`, `shared?`, `root?`, `dry-run?`           |
| `make_domain`    | `prumo make:domain`    | `nome`, `entity?`, `fields?`, `root?`, `dry-run?`            |
| `make_page`      | `prumo make:page`      | `nome`, `domain?`, `path?`, `root?`, `dry-run?`            |
| `new`            | `prumo new`            | `nome`, `dir?`, `packages?`, `install?`, `dry-run?`       |

O significado de cada campo é o da opção de mesmo nome na [referência da CLI](cli.md).

### O esquema de entrada

O esquema de cada ferramenta é derivado dos argumentos do comando:

| Argumento na CLI                 | Campo                                                              |
| -------------------------------- | ------------------------------------------------------------------ |
| Posicional (`<nome>`)            | `string` não vazia que não começa com `-`; obrigatório             |
| Opção de texto (`--root <pasta>`) | `string` não vazia; opcional                                      |
| Opção liga e desliga (`--dry-run`) | `boolean`; opcional                                             |
| Opção que começa ligada (`--no-install`) | `boolean` com o nome positivo (`install: false` desliga)   |

O objeto é estrito: um campo que o comando não tem é recusado. A descrição de cada campo é a da opção e, quando há, o valor padrão.

### A chamada

1. Os campos `root` e `dir`, se presentes, são conferidos contra a pasta do servidor (veja [Segurança](#segurança)).
2. Os campos viram a linha de comando (`toArgv`): texto vira `--nome=valor`; liga e desliga com `true` vira `--nome`, e com `false` vira `--no-nome` só quando a opção começa ligada (o `install` do `new`), senão nada.
3. O comando roda **em processo** (`runInProcess`), com o `cwd` da pasta do servidor e o ambiente do servidor.

### A resposta

Um único conteúdo de texto: o stdout do comando e, depois, o stderr, sem moldura. Quando o código de saída não é 0, uma última linha `[saída <código>]`, e a resposta tem `isError: true`. Sem saída nenhuma, o texto é `(sem saída)`.

```text
src/messages/en/clientes.json  [messages]  A chave 'clientes.empty' existe em 'pt-BR' e falta em 'en'.

prumo check: 1 violação.
[saída 1]
```

### Concorrência

As chamadas rodam **uma de cada vez**, em fila. O cliente pode pedir várias juntas, mas dois geradores escrevendo no mesmo projeto (duas telas no `App.tsx`) se atropelariam.

## Segurança

- **`root` e `dir` ficam dentro da pasta do servidor.** Quem escolhe o valor é o agente, e `root: "/"` o levaria para fora do projeto. O servidor resolve os dois contra a pasta, seguindo links simbólicos (inclusive de pastas que ainda não existem), e recusa o que sai dela, com `isError` e sem rodar o comando. É a única regra do servidor que não vem da CLI.
- **Só ferramentas.** O servidor não expõe resources nem prompts.
- **Só stdio.** Não abre porta de rede.
- **Só o `prumo`.** O servidor não executa nada além dos comandos da CLI. O `new` roda o `git init` e o `pnpm install`, cuja saída volta no texto da ferramenta.

## API

O pacote exporta as peças do servidor, para quem quiser montá-lo com outro transporte ou testá-lo:

```ts
import { createServer } from '@matizze/prumo-mcp'

const { server, tools } = await createServer({ cwd: '/caminho/do/app' })
```

| Export                                      | Descrição                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `createServer({ cwd?, env?, commands? })`   | Monta o `McpServer` (nome `prumo`, versão do pacote) com as ferramentas e devolve `{ server, tools }`, sem ligar a transporte. `cwd` padrão: `process.cwd()`; `env`: `process.env`; `commands`: a árvore do `prumo`. |
| `toolsOf(commands, { cwd, env? })`          | Uma `PrumoTool` por comando: `{ name, description, command, inputSchema, call }`.                          |
| `inputSchemaOf(command)`                    | O esquema zod de entrada da ferramenta de um comando.                                                     |
| `PACKAGE_NAME`, `PACKAGE_VERSION`           | O nome e a versão do pacote.                                                                               |

O servidor usa o SDK oficial (`@modelcontextprotocol/server`) e a API em processo do `@matizze/prumo-cli`.
