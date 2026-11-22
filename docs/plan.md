# Plano do Prumo

22/11/2026

O Prumo é uma **ferramenta** para criar e manter aplicações React organizadas em camadas: telas com `index`, `model` e `view`, domínios com schema, repositório e queries, textos em dois idiomas e as regras que mantêm tudo no lugar. Ele gera a estrutura e confere a arquitetura. **Não traz frontend:** nenhum componente de interface, ícone, tema, CSS, Storybook ou tela pronta. A interface é do produto, que usa o design system que quiser (o MaDS, o de um cliente ou nenhum).

Este plano substitui o anterior (Fases 0 a 4), que levou o Prumo para o lado de um app de referência com 65 telas, um catálogo de blocos e um starter com a interface inteira. Tudo isso sai.

## Situação

**Fases A e B concluídas** (22/11/2026). Da Fase C, os pacotes estão no npm público e há o workflow de publicação; falta o repositório público.

- **A (PRs #66 e #67):** saíram o app de referência, o catálogo, o starter, os portões antigos e a CI de verificação; cada pacote perdeu o que era de interface. `pnpm verify` verde, sem Chromium.
- **B (PRs #68 a #72):** `make:domain`, `make:page` e `make:component` por modelo (`templates/` do cli), `new` (app mínimo de 27 arquivos), o MCP com as mesmas ferramentas e o portão `pnpm verify:new`. Números do último verify da raiz: core 95 testes, rules 111, testing 43, cli 465, mcp 50, em cerca de 1 minuto. O portão, em 41 s (empacotar 9 s, criar o app 10 s, CLI 4 s, MCP 1 s, verify do app 14 s), com 19 testes no app gerado, sem navegador e sem GitHub.
- **C (em andamento):** os pacotes estão no npm público desde 22/11/2026 (core 0.1.3, rules e testing 0.2.1, cli 0.5.0, mcp 0.1.1), publicados à mão a partir da `main`. O critério de pronta foi cumprido: fora do monorepo, sem token e sem `.npmrc`, `pnpm dlx @matizze/prumo-cli new demo` instalou os cinco pacotes do npm, a CLI e o MCP geraram domínio, tela e componente, o `prumo check` não achou violação e o `pnpm verify` do app saiu verde (19 testes). O histórico do repositório já foi reescrito (seção 6). A cli 0.5.1 e a mcp 0.1.2 saíram em seguida, também à mão. O workflow de publicação existe (seção 6). Falta apagar as refs de pull request antigas (pedido ao suporte do GitHub) e tornar o repositório público. Ao subir versões, o mapa `packages/cli/src/new/versions.ts` acompanha.

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

| Pacote                   | Fica com                                                                                                                             | Sai                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `@matizze/prumo-core`    | container de repositórios, query keys, tipo `Page`, utilitários de mock, i18n, erros, guarda de login, provedor de query             | nada (rever só o que depender de interface)                                                                                       |
| `@matizze/prumo-rules`   | `page-structure`, `no-cross-page-import`, as análises `components-folders`, `messages`, `page-structure` e `shared-usage` do `check` | `ui-boundary`, `icons-from-alias`, `no-inline-svg`, `references` e as seções geradas do `AGENTS.md`                               |
| `@matizze/prumo-testing` | `renderWithProviders` (com a rota em memória), `setupDom`, `matchMedia` controlável, `createDeferred`, o teste de contrato           | `storybook`, `storybook/preview`, os peers de Storybook e Playwright                                                              |
| `@matizze/prumo-cli`     | `new`, `make:page`, `make:domain`, `make:component`, `check`, `doctor`                                                               | `add`, `promote`, `catalog`, `patterns`, `agents`, o `--like` e os dez padrões, `--menu`, a escolha interativa (`@clack/prompts`) |
| `@matizze/prumo-mcp`     | o servidor com as mesmas ferramentas da CLI                                                                                          | o que vier dos comandos que saem                                                                                                  |

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

- **npm público:** os pacotes vão para o `registry.npmjs.org`, no escopo `@matizze`, com acesso público: ninguém precisa de token para instalar. O `prumo new` não cria `.npmrc`, e o `prumo doctor` avisa se o `.npmrc` do projeto ainda manda o escopo para o GitHub Packages.
- **GitHub Packages foi uma etapa provisória:** a versão anterior (core 0.1.2, rules 0.2.0, testing 0.2.0, cli 0.4.0, mcp 0.1.0) ficou publicada lá, à mão; desde a seguinte, os pacotes saem no npm público.
- **CI só para publicar:** o workflow `.github/workflows/release.yml`, a cada push na `main`, roda o `scripts/publish-npm.sh`. O script pergunta ao npm quais versões faltam e, se nenhuma falta, termina em segundos, sem instalar nada. Se falta alguma, compila, empacota e publica só essas. A autenticação é pelo Trusted Publishing do npm (o GitHub Actions se identifica para o npm, sem token guardado no repositório), configurado no npmjs em cada pacote. Nenhum job de verificação no GitHub; a verificação é local.
- **Repositório público depois da separação.** O histórico antigo tinha o código e as imagens das telas portadas do TailAdmin Pro, que não podem ficar públicos. Decidido e feito em 22/11/2026: o histórico foi reescrito no próprio repositório (só os caminhos que a `main` e a `develop` têm hoje). Antes de abrir, as refs dos pull requests antigos, que ainda guardam o histórico anterior e não somem com push, precisam ser apagadas pelo suporte do GitHub.

## 7. Fases

| Fase                 | Entrega                                                                                                                       | Pronta quando                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Extermínio        | Sai tudo o que a seção 4 lista, e cada pacote perde o que a seção 3 lista. A CLI fica só com `check` e `doctor` até a Fase B. | `pnpm verify` (só os pacotes) verde, sem Chromium, e nenhum arquivo de interface no repositório                                                                                             |
| B. Geradores simples | Os modelos, `new`, `make:page`, `make:domain` e `make:component`, e o MCP com as mesmas ferramentas                           | Um portão local cria um app novo numa pasta temporária, gera uma tela, um domínio e um componente, e roda nele `tsc`, `eslint`, `prumo check` e `vitest`, em poucos minutos e sem navegador |
| C. Publicação        | npm público, workflow de publicação, repositório público com histórico novo                                                   | Um projeto fora do monorepo instala os pacotes do npm e o `prumo new` funciona                                                                                                              |

## 8. Decisões para confirmar

1. **`promote` sai?** Decidido: sai (Fase A). Ele dependia de stories e do `registry.json`; se fizer falta, volta simples depois.
2. **`skeleton.tsx`:** Decidido: não é cobrado nem gerado (é interface). A regra e a análise `page-structure` só olham os arquivos da lista (`index.tsx`, `model.ts` e `view.tsx`).
3. **Versões:** Decidido: cada pacote manteve a sua versão; o npm começou em core 0.1.3, rules e testing 0.2.1, cli 0.5.0 e mcp 0.1.1.
4. **Escopo no npm:** Decidido: a organização `matizze` existe no npmjs, e a primeira publicação foi feita à mão, com um token granular de validade curta. As próximas saem pelo workflow de publicação (seção 6).
