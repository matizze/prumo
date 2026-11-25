# Agentes de IA

O Prumo foi feito para ser usado tanto por pessoas quanto por agentes de IA. Um agente conhece o app por dois arquivos que o `prumo new` cria: o `AGENTS.md`, que explica as camadas e as regras, e o `.mcp.json`, que liga o agente ao servidor MCP do Prumo, o [`prumo mcp`](../reference/cli.md#prumo-mcp). Com os dois, ele gera schemas, use cases e telas pelas mesmas ferramentas que uma pessoa usa no terminal e passa pela mesma verificação (`pnpm verify`).

## O `AGENTS.md`

O `AGENTS.md` gerado é curto de propósito: as camadas, as camadas (telas → use cases → http e schemas) e as regras de convivência (telas isoladas, view sem dados, dado pelo use case, texto nos dois idiomas), a tabela de comandos, a seção do servidor MCP e uma linha sobre testes. Ele é do seu time: acrescente as convenções do produto (o design system, a API, o idioma, o que exige aprovação).

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
| `make_usecase`    | `nome` (obrigatório), `input`, `output`, `endpoint`, `read`, `write`, `local`, `crud`, `entity`, `dry_run` | Gera o use case (tipos, classe, mock e teste) e o registra; `nome` é `<domínio>.<ação>`, ou só o domínio com `crud` (os cinco do CRUD) |
| `make_page`       | `nome` (obrigatório), `usecase`, `path`, `dry_run`                                       | Gera a tela, os textos e a rota; `nome` com ponto ou barra (`auth.login`) cria a tela em subpasta |
| `check`           | nenhum                                                                                   | Confere a arquitetura                                          |
| `list`            | nenhum                                                                                   | Mostra o que o projeto tem, em JSON                            |

Os parâmetros são as opções do comando de mesmo nome, em snake_case e sem acento: `<domínio>` vira `dominio` e `--dry-run` vira `dry_run`. Nenhuma ferramenta recebe a pasta do projeto. A lista completa e as regras da conversão estão na [referência do `prumo mcp`](../reference/cli.md#as-ferramentas).

### Um exemplo de chamada

Num app com o schema de `pedidos`, o agente chama `make_usecase` com:

```json
{ "nome": "pedidos", "crud": true }
```

e recebe o texto da saída do `prumo make:usecase`:

```text
prumo make:usecase: pedidos --crud (entidade pedido).
Campos (lidos do schema): numero (number), valor (number), status (string).
Use cases (listPedidos, getPedido, createPedido, updatePedido, removePedido):
  listPedidos  GET /pedidos
  getPedido  GET /pedidos/:id
  createPedido  POST /pedidos
  updatePedido  PATCH /pedidos/:id
  removePedido  DELETE /pedidos/:id

Criados (22):
  src/use-cases/pedidos/collection.mock.ts
  src/use-cases/pedidos/create-pedido.mock.ts
  ...

Alterados (3):
  src/messages/en/errors.json
  src/messages/pt-BR/errors.json
  src/use-cases/index.ts

Próximo passo: prumo make:page pedidos --usecase pedidos.list-pedidos
```

Com `dry_run: true`, a chamada só diz o que faria, sem escrever nada. Antes de criar a tela, o agente pode conferir:

```json
{ "nome": "pedidos", "usecase": "pedidos.list-pedidos", "dry_run": true }
```

```text
prumo make:page: pedidos (rota /pedidos, use case pedidos.list-pedidos, lista) (simulação).

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

Quando o comando falha, o resultado volta com `isError` e a mensagem em português, para o agente corrigir. Pedir uma tela com um use case que não existe, por exemplo, devolve:

```text
prumo: o use case 'nada.list-nada' não existe: falta src/use-cases/nada/list-nada.usecase.ts. Rode prumo make:usecase nada.list-nada (ou prumo list para ver o que há).
```

A mensagem diz o que fazer, e o agente a segue (aqui, gerar o use case antes). O erro de opção ou argumento traz também a linha de uso do comando.

O `check` com violação não é erro: volta como resultado, com as violações no texto.

### Um use case pelo agente

O use case é o caminho novo para o que o app faz com dados. O agente chama `make_usecase` com o domínio e a ação, e os campos quando sabe:

```json
{ "nome": "auth.sign-in", "input": "email:string,password:string", "output": "token:string" }
```

A ferramenta decide leitura ou escrita pelo verbo da ação (`get`, `list`, `search`, `find`, `check` e `count` são leitura), cria `src/use-cases/auth/` com o tipo, a classe, a rota de mock e o teste, e registra tudo. A descrição da ferramenta traz o formato de `input`, `output` (que aceita o nome de uma entidade que já tem schema: `store` ou `store[]`) e `endpoint` (`PATCH /livros/:id`, com cada `:parâmetro` saindo do campo do Input), além do `local` para um use case sem API. As chaves do registro são únicas no app: o `list` mostra os use cases que já existem (`useCases`, com a chave, o tipo e o endpoint), para o agente não repetir uma ação. Na tela, o model usa `useUseCases()`. O [guia de referência](../reference/cli.md#prumo-makeusecase) tem o detalhe.

## O `list` antes de gerar

A ferramenta `list` devolve o que o projeto já tem: os schemas com os campos, os use cases (domínio, ação, chave no registro, tipo e endpoint), as telas (rota, variação e o use case que o model chama; a variação é `title`, `list`, `param`, `detail` ou `form`) e os idiomas. O agente a chama antes de gerar, para não repetir um use case (as chaves do registro são únicas), escolher o use case certo para a tela e saber a ordem das camadas que faltam. O resultado é o JSON do `prumo list --json`:

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
  "useCases": [
    { "domain": "pedidos", "name": "list-pedidos", "key": "listPedidos", "kind": "read", "endpoint": "GET /pedidos" }
  ],
  "pages": [
    { "name": "home", "route": "/", "routeKind": "literal", "routePartial": false, "variation": "title", "useCase": null }
  ],
  "languages": ["en", "pt-BR"]
}
```

As chaves e os campos estão na [referência do `list`](../reference/cli.md#prumo-list). Uma pessoa pode rodar o mesmo no terminal: `pnpm exec prumo list`.

## Um pedido completo

Um pedido como este já basta:

> Crie um domínio de pedidos com os campos número, valor e status, e uma tela que lista os pedidos com o valor formatado em reais. Rode o `pnpm verify` no fim.

O agente lê o `AGENTS.md`, chama o `list`, gera as camadas por `make_schema`, `make_usecase` e `make_page` (ou só `make_usecase` com `crud`), ajusta o schema, as fixtures, o model, a view e os textos à mão, confere com o `check` e roda o `pnpm verify`.

## O que o servidor não faz

- **Não cria o app.** O `new` não é ferramenta: o app nasce no terminal (`pnpm dlx @matizze/prumo-cli new`), e o servidor abre dentro dele.
- **Não escreve fora do projeto.** Ele trabalha no projeto que acha subindo da pasta onde abriu (a primeira com `src` e dependência `@matizze/prumo-*` no `package.json`), ou na `--root`, e nenhuma ferramenta recebe outra pasta. Os comandos que escrevem seguem as regras da CLI: validam tudo antes e nunca sobrescrevem um arquivo, e os nomes e caminhos que aceitam são validados e ficam sob a raiz do projeto. Antes de gravar, a CLI também confere o caminho real de cada arquivo, com os links simbólicos resolvidos: um link que leve a escrita para fora do projeto (o próprio `src`, uma pasta dentro dele, um arquivo como o `App.tsx`) ou um link quebrado fazem a ferramenta voltar com erro, dizendo qual é o link, sem escrever nada; o `dry_run` confere o mesmo. Fica de fora só o link físico (hard link) para um arquivo de fora, que o git não carrega.
- **Roda uma chamada por vez.** As chamadas entram numa fila, para duas escritas não se cruzarem, mesmo que o agente peça várias de uma vez.
- **Não edita o código que você escreve.** Ele gera as camadas e os registros; o model, a view e as regras de negócio continuam sendo do agente (ou da pessoa), com o `check` e o `pnpm verify` para conferir.

## O agente sem MCP

Nem todo agente fala MCP, e não precisa. As ferramentas são os comandos da CLI, e o `AGENTS.md` traz a tabela deles: o agente usa `pnpm exec prumo make:schema`, `make:usecase`, `make:page`, `check` e `list` pelo terminal, com os mesmos argumentos e a mesma saída. Para o agente que lê JSON, `pnpm exec prumo list --json` faz o papel da ferramenta `list`. A verificação é a mesma: `pnpm verify`.
