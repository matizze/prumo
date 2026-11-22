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
  repositories/<domínio>/  contrato, implementação mock e fixtures
  queries/<domínio>.ts     hooks de query e mutation (TanStack Query)
  messages/<idioma>/       textos em pt-BR e en, um JSON por tela
```

- Uma tela não importa de outra tela: o que as duas usam vai para `src/components/shared`.
- A `view` não busca dado nem tem estado de dados: tudo chega do `model` por props.
- Dado vem de um hook de `src/queries`, que usa o repositório do container (`useRepositories()`), nunca um `fetch` solto.
- Todo texto da tela mora em `src/messages/<idioma>/<tela>.json`, nos dois idiomas, e é lido por `useTranslations`.

## Comandos

Crie com os geradores, não à mão: eles registram a rota, as mensagens e os índices, e rodam o `prumo check` no fim.

| Comando                                                | O que faz                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `pnpm exec prumo make:domain <nome>`                   | Schema, repositório com mock e contrato, queries e o teste de contrato          |
| `pnpm exec prumo make:page <nome> [--domain <nome>]`   | Tela com index, model, view, teste, mensagens e rota; com `--domain`, lista dele |
| `pnpm exec prumo make:component <nome> --page <tela>`  | Componente só HTML e o teste dele (`--shared` para o `src/components/shared`)   |
| `pnpm exec prumo check`                                | Confere a arquitetura do projeto inteiro                                        |
| `pnpm exec prumo doctor`                               | Confere Node, pnpm e a versão dos pacotes do Prumo                              |

Todos os geradores aceitam `--dry-run` (só lista o que faria). O servidor MCP do Prumo (`.mcp.json`) dá a um agente os mesmos comandos como ferramentas (`make_page`, `make_domain`, `check`...).

Scripts do projeto: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm check`, `pnpm test` e `pnpm verify` (typecheck, lint, check e test; sem navegador). Rode o `pnpm verify` antes de dar uma tarefa por pronta.

## Regras

- Comentários e documentação em português; nomes de função, variável e arquivo em inglês.
- Teste o comportamento novo (Vitest, com o `renderWithProviders` de `@/test/render`).
- Dependência nova só com aprovação de uma pessoa.
