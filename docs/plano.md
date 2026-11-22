# Plano do Prumo

22/11/2026

O Prumo é uma **ferramenta** para criar e manter aplicações React organizadas em camadas: telas com `index`, `model` e `view`, domínios com schema, repositório e queries, textos em dois idiomas e as regras que mantêm tudo no lugar. Ele gera a estrutura e confere a arquitetura. **Não traz frontend:** nenhum componente de interface, ícone, tema, CSS, Storybook ou tela pronta. A interface é do produto, que usa o design system que quiser (o MaDS, o de um cliente ou nenhum).

Este plano substitui o anterior (Fases 0 a 4), que levou o Prumo para o lado de um app de referência com 65 telas, um catálogo de blocos e um starter com a interface inteira. Tudo isso sai.

## 1. O que é e o que não é

| É do Prumo                                                                                        | Não é do Prumo                                                       |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A estrutura de pastas e camadas de um app React                                                   | Componentes de interface, ícones, tema, tokens, CSS                  |
| Gerar tela, domínio e componente a partir de modelos simples                                      | Copiar telas prontas (`--like`), padrões de tela, catálogo de blocos |
| Conferir a arquitetura (`prumo check` e regras de ESLint)                                         | Storybook, stories, testes visuais, Chromium                         |
| Infraestrutura sem interface: container de repositórios, query keys, i18n, erros, guarda de login | Layout, menu, telas de login, dashboards                             |
| Utilitários de teste sem interface: render com provedores, teste de contrato                      | Paridade visual, axe, temas claro e escuro                           |
| Um servidor MCP com os mesmos comandos, para agentes                                              | Registry de UI, `prumo add @mads/...`                                |

**Critério para qualquer decisão:** se uma peça só faz sentido com uma interface específica, ela não é do Prumo.

## 2. A estrutura que o Prumo gera e confere

```
src/
  pages/<tela>/
    index.tsx      liga a rota ao model e à view
    model.ts       estado, dados (queries) e ações da tela; sem JSX
    view.tsx       apresentação; recebe tudo por props
    components/    componentes usados só por esta tela
  components/shared/   componentes usados por duas ou mais telas
  schemas/entities/    schemas zod das entidades
  repositories/<domínio>/  contrato, implementação mock e fixtures
  queries/<domínio>.ts     hooks de query e mutation (TanStack Query)
  messages/<idioma>/<tela>.json   textos em pt-BR e en
```

A `view` gerada usa só React e elementos HTML semânticos, sem classes de nenhum design system. O produto troca os elementos pelos componentes da interface dele.

## 3. Pacotes

| Pacote                   | Fica com                                                                                                                 | Sai                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `@matizze/prumo-core`    | container de repositórios, query keys, tipo `Page`, utilitários de mock, i18n, erros, guarda de login, provedor de query | nada (rever só o que depender de interface)                                                                                       |
| `@matizze/prumo-rules`   | `page-structure`, `no-cross-page-import`, as análises `messages`, `page-structure` e `shared-usage` do `check`           | `ui-boundary`, `icons-from-alias`, `no-inline-svg`, `components-folders` (se só servir à UI), `references`                        |
| `@matizze/prumo-testing` | `renderWithProviders`, `setupDom`, `createDeferred`, o teste de contrato                                                 | `storybook`, `storybook/preview`, os peers de Storybook e Playwright                                                              |
| `@matizze/prumo-cli`     | `new`, `make:page`, `make:domain`, `make:component`, `check`, `doctor`                                                   | `add`, `promote`, `catalog`, `patterns`, `agents`, o `--like` e os dez padrões, `--menu`, a escolha interativa (`@clack/prompts`) |
| `@matizze/prumo-mcp`     | o servidor com as mesmas ferramentas da CLI                                                                              | o que vier dos comandos que saem                                                                                                  |

## 4. O que sai do repositório

- `apps/reference/` inteiro: as 65 telas, a UI, os ícones, o tema, o Storybook e a paridade visual.
- `catalog/` e `starter/`.
- Os portões `verify:generated` e `verify:product`, o `serve-registry.mjs` e os scripts do starter.
- A CI de verificação (`.github/workflows/ci.yml`). A CI do Prumo passa a existir só para publicar (seção 6).
- O codemod de renomear cópias (o `--like`). Fica só o que faz as costuras: registrar a rota, as mensagens e os índices do domínio.

## 5. Comandos

| Comando                                     | O que faz                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prumo new <nome>`                          | Cria um app mínimo: Vite, React, TypeScript, wouter, TanStack Query, zod e i18next, com os pacotes do Prumo, a estrutura de pastas, uma tela inicial e o `AGENTS.md`. Sem CSS, sem design system. |
| `prumo make:page <nome>`                    | Gera `index`, `model`, `view`, as mensagens nos dois idiomas e o teste do model, e registra a rota.                                                                                               |
| `prumo make:domain <nome>`                  | Gera o schema, o contrato do repositório, o mock com fixtures, as queries e o teste de contrato, e registra nos índices.                                                                          |
| `prumo make:component <nome> --page <tela>` | Gera um componente na pasta da tela, ou em `shared` com `--shared`.                                                                                                                               |
| `prumo check`                               | Confere a arquitetura do projeto inteiro.                                                                                                                                                         |
| `prumo doctor`                              | Confere Node, pnpm e a versão dos pacotes do Prumo.                                                                                                                                               |

Os modelos de cada comando moram no `@matizze/prumo-cli`, como arquivos com marcadores de nome, e não como cópia de uma tela de outro projeto.

## 6. Publicação e repositório público

- **npm público**, no escopo `@matizze` do npmjs, e não mais o GitHub Packages privado.
- **CI só para publicar:** um workflow que, na `main`, roda o build e o `changeset publish`, com o token do npm num segredo do repositório. Nenhum job de verificação no GitHub; a verificação é local.
- **Repositório público depois da separação.** O histórico atual tem o código e as imagens das telas portadas do TailAdmin Pro, que não podem ficar públicos. Recomendação: abrir o repositório público com um histórico novo, a partir do estado limpo, e arquivar o atual como privado.

## 7. Fases

| Fase                 | Entrega                                                                                                                       | Pronta quando                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Extermínio        | Sai tudo o que a seção 4 lista, e cada pacote perde o que a seção 3 lista. A CLI fica só com `check` e `doctor` até a Fase B. | `pnpm verify` (só os pacotes) verde, sem Chromium, e nenhum arquivo de interface no repositório                                                                                             |
| B. Geradores simples | Os modelos, `new`, `make:page`, `make:domain` e `make:component`, e o MCP com as mesmas ferramentas                           | Um portão local cria um app novo numa pasta temporária, gera uma tela, um domínio e um componente, e roda nele `tsc`, `eslint`, `prumo check` e `vitest`, em poucos minutos e sem navegador |
| C. Publicação        | npm público, workflow de publicação, repositório público com histórico novo                                                   | Um projeto fora do monorepo instala os pacotes do npm e o `prumo new` funciona                                                                                                              |

## 8. Decisões para confirmar

1. **`promote` sai?** Ele move um componente de uma tela para `shared`, mas depende de stories e do `registry.json`. A recomendação é tirar e, se fizer falta, refazer simples depois.
2. **`skeleton.tsx`:** hoje é opcional na estrutura da tela. A recomendação é não gerar (é interface).
3. **Versões:** os pacotes nunca foram publicados. A recomendação é recomeçar o histórico no repositório público, mantendo a versão atual de cada pacote.
4. **Escopo no npm:** confirmar que a organização `matizze` existe no npmjs e quem guarda o token.
