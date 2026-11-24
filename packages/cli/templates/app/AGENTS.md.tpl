# AGENTS.md

Guia para agentes de IA neste projeto, o {{app.title}}. Ele foi criado pelo Prumo (`prumo new`), a ferramenta da Matizze que gera a estrutura de um app React e confere a arquitetura. O projeto não traz CSS nem design system: a interface é sua, e as `view` geradas usam só elementos HTML.

## Camadas

```
src/
  pages/<tela>/
    index.tsx      liga a rota ao model e à view
    model.ts       dados (queries), textos e ações da tela; sem JSX
    view.tsx       apresentação; recebe tudo por props
    components/    componentes usados só por esta tela
  components/shared/       componentes usados por duas ou mais telas
  schemas/entities/        schemas zod das entidades
  repositories/<domínio>/  contrato, implementações (mock, http, storage) e fixtures
  queries/<domínio>.ts     hooks de query e mutation (TanStack Query)
  messages/<idioma>/       textos em pt-BR e en, um JSON por tela
```

- Uma tela não importa de outra tela: o que as duas usam vai para `src/components/shared`.
- A `view` não busca dado nem tem estado de dados: tudo chega do `model` por props.
- Dado vem de um hook de `src/queries`, que usa o repositório do container (`useRepositories()`), nunca um `fetch` solto.
- Todo texto da tela mora em `src/messages/<idioma>/<tela>.json`, nos dois idiomas, e é lido por `useTranslations`.

## Comandos

Crie com os geradores, não à mão: eles registram a rota, as mensagens e os índices.

| Comando                                                                            | O que faz                                                                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec prumo make:schema <domínio> [--entity <singular>] [--fields "a:string,b:int"]` | O schema zod da entidade (tipos: string, number, int, boolean, date, datetime, enum(a\|b\|c); `?` torna o campo opcional)          |
| `pnpm exec prumo make:repository <domínio> [--data-source mock\|http\|storage]`      | O contrato, a implementação mock, as fixtures e o teste de contrato do domínio (precisa do schema)                              |
| `pnpm exec prumo make:query <domínio>`                                             | As query keys, os hooks e as mutations do domínio (precisa do repositório)                                                      |
| `pnpm exec prumo make:page <nome> [--query <domínio>] [--path <caminho>]`          | Tela com index, model, view, teste, mensagens e rota; com `--query`, a lista do domínio; com `--path /x/:id`, rota com parâmetro |
| `pnpm exec prumo check`                                                            | Confere a arquitetura do projeto inteiro                                                                                        |
| `pnpm exec prumo list [--json]`                                                    | O que o projeto já tem (schemas, repositórios com as fontes, queries, telas com rota e idiomas); só lê. Rode antes de gerar     |

Todos os geradores aceitam `--dry-run` (só lista o que faria).

Scripts do projeto: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm check`, `pnpm test` e `pnpm verify` (typecheck, lint, test e check, nessa ordem, para os testes rodarem mesmo que o check falhe; sem navegador). Rode o `pnpm verify` antes de dar uma tarefa por pronta.

## Servidor MCP

O projeto traz o `.mcp.json`, que registra o servidor `prumo` (`pnpm exec prumo mcp`, por stdio). Ele dá ao agente os mesmos geradores como ferramentas: `make_schema`, `make_repository`, `make_query`, `make_page`, `check` e `list`. Os parâmetros têm o nome da opção em snake_case sem acento (`dominio`, `nome`, `entity`, `fields`, `data_source`, `query`, `path` e `dry_run`). O servidor trabalha só neste projeto. Prefira as ferramentas a editar à mão, e chame `list` antes de gerar.

## Testes

Teste o comportamento novo (Vitest, com o `renderWithProviders` de `@/test/render`).
