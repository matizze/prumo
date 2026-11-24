# Agentes de IA

O Prumo foi feito para ser usado tanto por pessoas quanto por agentes de IA. Um agente conhece o app por dois arquivos que o `prumo new` cria: o `AGENTS.md`, que explica as camadas e as regras, e o `.mcp.json`, que liga o agente ao servidor MCP do Prumo, o [`prumo mcp`](../reference/cli.md#prumo-mcp). Com os dois, ele gera domínios e telas pelas mesmas ferramentas que uma pessoa usa no terminal e passa pela mesma verificação (`pnpm verify`).

## O `AGENTS.md`

O `AGENTS.md` gerado é curto de propósito: as camadas, as quatro regras de convivência (telas isoladas, view sem dados, dado pelo repositório, texto nos dois idiomas), a tabela de comandos, a seção do servidor MCP e uma linha sobre testes. Ele é do seu time: acrescente as convenções do produto (o design system, a API, o idioma, o que exige aprovação).

Vários agentes leem o `AGENTS.md` da raiz do projeto por conta própria. O Claude Code lê o `CLAUDE.md`: crie um com a linha abaixo para que ele importe o `AGENTS.md` (é o que o próprio repositório do Prumo faz):

```markdown
@AGENTS.md
```

## O servidor MCP

O MCP (Model Context Protocol) é o jeito padrão de um agente chamar ferramentas de um programa. O `prumo mcp` abre um servidor MCP, por stdio, para o projeto da pasta onde ele abriu, com uma ferramenta por comando da CLI. O agente chama `make_schema` em vez de montar a linha de comando, e recebe de volta o mesmo texto que o terminal mostraria.

O `prumo new` já cria o `.mcp.json` na raiz do app:

```json
{
  "mcpServers": {
    "prumo": {
      "command": "pnpm",
      "args": ["exec", "prumo", "mcp"]
    }
  }
}
```

Num projeto que não saiu do `prumo new` (um app existente que adotou o Prumo, veja [Projeto existente](existing-project.md)), instale o `@matizze/prumo-cli` e cole esse trecho num `.mcp.json` na raiz. O `prumo mcp --help` mostra o mesmo trecho.

### Como o agente o carrega

O Claude Code lê o `.mcp.json` da raiz do projeto e abre o servidor por conta própria. Abra a sessão na pasta do app: na primeira vez, ele pergunta se confia no servidor `prumo` do projeto (aprove), e o comando `/mcp` lista os servidores e mostra se o `prumo` está conectado. Outros clientes (Cursor, VS Code) usam o arquivo de configuração deles, e o comando é o mesmo, `pnpm exec prumo mcp`, com a pasta do app como pasta de trabalho. Não rode o `prumo mcp` à mão: o stdout é do protocolo, e o servidor só termina quando o cliente fecha.

## As ferramentas

| Ferramenta        | Parâmetros                                                                               | O que faz                                                      |
| ----------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `make_schema`     | `dominio` (obrigatório), `entity`, `fields`, `dry_run`                                   | Gera o schema zod da entidade                                  |
| `make_repository` | `dominio` (obrigatório), `entity`, `data_source` (`mock`, `http` ou `storage`), `dry_run` | Gera o contrato, o `mock`, as fixtures e o teste, ou uma fonte |
| `make_query`      | `dominio` (obrigatório), `entity`, `dry_run`                                             | Gera as queries e mutations                                    |
| `make_page`       | `nome` (obrigatório), `query`, `path`, `dry_run`                                         | Gera a tela, os textos e a rota                                |
| `check`           | nenhum                                                                                   | Confere a arquitetura                                          |
| `list`            | nenhum                                                                                   | Mostra o que o projeto tem, em JSON                            |

Os parâmetros são as opções do comando de mesmo nome, em snake_case e sem acento: `<domínio>` vira `dominio`, `--data-source` vira `data_source` e `--dry-run` vira `dry_run`. Nenhuma ferramenta recebe a pasta do projeto. A lista completa e as regras da conversão estão na [referência do `prumo mcp`](../reference/cli.md#as-ferramentas).

### Um exemplo de chamada

Num app com o schema e o repositório de `pedidos`, o agente chama `make_query` com:

```json
{ "dominio": "pedidos" }
```

e recebe o texto da saída do `prumo make:query`:

```text
prumo make:query: pedidos (entidade pedido).
Exporta: pedidoKeys, pedidoQueries, usePedidosList, usePedidoDetail, useCreatePedido, useUpdatePedido, useRemovePedido, type PedidosListOptions.

Criados (1):
  src/queries/pedidos.ts

Alterados (1):
  src/queries/index.ts

Próximo passo: prumo make:page pedidos --query pedidos
```

Com `dry_run: true`, a chamada só diz o que faria, sem escrever nada. Antes de criar a tela, o agente pode conferir:

```json
{ "nome": "pedidos", "query": "pedidos", "dry_run": true }
```

```text
prumo make:page: pedidos (rota /pedidos, query pedidos) (simulação).

Seriam criados (6):
  src/messages/en/pedidos.json
  src/messages/pt-BR/pedidos.json
  src/pages/pedidos/index.test.tsx
  src/pages/pedidos/index.tsx
  src/pages/pedidos/model.ts
  src/pages/pedidos/view.tsx

Seriam alterados (3):
  src/App.tsx
  src/messages/en/index.ts
  src/messages/pt-BR/index.ts

Simulação (--dry-run): nada foi escrito.
```

Quando o comando falha, o resultado volta com `isError` e a mensagem em português, para o agente corrigir. Pedir uma tela com uma query que não existe, por exemplo, devolve:

```text
prumo: a query 'nada' não existe: falta src/queries/nada.ts; rode prumo make:query nada.

Uso: prumo make:page [opções] <nome>

Cria uma tela nova: index, model, view, teste, mensagens e rota.
...
```

Depois da mensagem vem a ajuda do comando (aqui, só o começo dela).

O `check` com violação não é erro: volta como resultado, com as violações no texto.

## O `list` antes de gerar

A ferramenta `list` devolve o que o projeto já tem: os schemas com os campos, os repositórios e suas fontes, as queries, as telas (rota, variação e query) e os idiomas. O agente a chama antes de gerar, para não repetir um domínio, escolher a query certa para a tela e saber a ordem das camadas que faltam. O resultado é o JSON do `prumo list --json`:

```json
{
  "schemas": [
    {
      "entity": "Pedido",
      "file": "src/schemas/entities/pedido.ts",
      "fields": [
        { "name": "numero", "type": "number", "optional": false },
        { "name": "valor", "type": "number", "optional": false },
        { "name": "status", "type": "string", "optional": false }
      ],
      "problem": null
    }
  ],
  "repositories": [{ "domain": "pedidos", "entity": "Pedido", "sources": ["mock"] }],
  "queries": [],
  "pages": [
    { "name": "home", "route": "/", "routeKind": "literal", "routePartial": false, "variation": "titulo", "query": null }
  ],
  "languages": ["en", "pt-BR"]
}
```

As chaves e os campos estão na [referência do `list`](../reference/cli.md#prumo-list). Uma pessoa pode rodar o mesmo no terminal: `pnpm exec prumo list`.

## Um pedido completo

Um pedido como este já basta:

> Crie um domínio de pedidos com os campos número, valor e status, e uma tela que lista os pedidos com o valor formatado em reais. Rode o `pnpm verify` no fim.

O agente lê o `AGENTS.md`, chama o `list`, gera as camadas por `make_schema`, `make_repository`, `make_query` e `make_page`, ajusta o schema, as fixtures, o contrato, o model, a view e os textos à mão, confere com o `check` e roda o `pnpm verify`.

## O que o servidor não faz

- **Não cria o app.** O `new` não é ferramenta: o app nasce no terminal (`pnpm dlx @matizze/prumo-cli new`), e o servidor abre dentro dele.
- **Não escreve fora do projeto.** Ele trabalha na pasta onde abriu (ou na `--root`), e nenhuma ferramenta recebe outra pasta. Os comandos que escrevem seguem as regras da CLI: validam tudo antes e nunca sobrescrevem um arquivo, e os nomes e caminhos que aceitam são validados e ficam sob a raiz do projeto. Antes de gravar, a CLI também confere o caminho real de cada arquivo, com os links simbólicos resolvidos: um link que leve a escrita para fora do projeto (o próprio `src`, uma pasta dentro dele, um arquivo como o `App.tsx`) ou um link quebrado fazem a ferramenta voltar com erro, dizendo qual é o link, sem escrever nada; o `dry_run` confere o mesmo. Fica de fora só o link físico (hard link) para um arquivo de fora, que o git não carrega.
- **Roda uma chamada por vez.** As chamadas entram numa fila, para duas escritas não se cruzarem, mesmo que o agente peça várias de uma vez.
- **Não edita o código que você escreve.** Ele gera as camadas e os registros; o model, a view e as regras de negócio continuam sendo do agente (ou da pessoa), com o `check` e o `pnpm verify` para conferir.

## O agente sem MCP

Nem todo agente fala MCP, e não precisa. As ferramentas são os comandos da CLI, e o `AGENTS.md` traz a tabela deles: o agente usa `pnpm exec prumo make:schema`, `make:repository`, `make:query`, `make:page`, `check` e `list` pelo terminal, com os mesmos argumentos e a mesma saída. Para o agente que lê JSON, `pnpm exec prumo list --json` faz o papel da ferramenta `list`. A verificação é a mesma: `pnpm verify`.
