# AGENTS.md

Guia para agentes de IA neste monorepo.

## O que é

O Prumo é uma **ferramenta** da Matizze para criar e manter aplicações React organizadas em camadas (telas com `index`, `model` e `view`, domínios com schema, repositório e queries, textos em dois idiomas) e conferir a arquitetura. **Não tem frontend:** nenhum componente de interface, ícone, tema, CSS, Storybook, tela pronta, catálogo de blocos ou padrão de tela. A interface é do produto. Visão geral e comandos no [README.md](README.md); o plano e as fases, em [docs/plano.md](docs/plano.md).

A **Fase A (o extermínio) terminou**: não há mais nada de interface no repositório, e a **Fase B (os geradores simples, por modelos) está em andamento**: `new`, `make:page`, `make:domain` e `make:component` existem, e o portão local da fase é o `pnpm verify:new` (veja a seção Verificação). Os modelos são arquivos `.tpl` com marcadores de nome em `packages/cli/templates/` (veja o README do cli), e o gerador novo entra em `packages/cli/src/generate/`. São cinco pacotes em `packages/`: `core`, `rules`, `testing`, `cli` (os comandos `new`, `make:page`, `make:domain`, `make:component`, `check` e `doctor`) e `mcp` (o servidor com as mesmas ferramentas). Nada foi publicado: os pacotes seguem `"private": true`, e a primeira publicação (npm público, Fase C do plano) espera uma pessoa e um token. Não tire o `private` nem publique por conta própria.

## Regras

1. **Critério para qualquer decisão:** se uma peça só faz sentido com uma interface específica, ela não é do Prumo.
2. **Pull request abre contra a `develop`**, e o que muda `packages/*` traz changeset (`pnpm changeset`). A `main` recebe as versões.
3. **Não há CI de verificação no GitHub** (custo). A verificação é local, com `pnpm verify`. A CI do Prumo existirá só para publicar (Fase C).
4. **Idioma.** Comentários, documentação e commits em português; nomes de função, variável e arquivo em inglês.
5. **Dependência nova só com aprovação de uma pessoa**, mesmo que seja pequena.
6. **Um verify por vez.** A máquina de desenvolvimento tem pouca memória.

## Verificação

- `pnpm verify`: typecheck, lint e testes dos cinco pacotes, sem navegador.
- `pnpm build`: compila os pacotes (`dist/`). `pnpm pack:all [pasta]` gera os tarballs; o `packaging.test.ts` do cli (já dentro do `pnpm verify`) compila, empacota e confere os tarballs.
- `pnpm verify:new`: o portão local do app novo, sem navegador e sem GitHub (`scripts/verify-new.sh`). Empacota os pacotes (`pnpm pack:all`), cria um app com `prumo new` numa pasta temporária fora do monorepo (`--packages` os tarballs), gera nele pela CLI um domínio, uma tela com `--domain` e um componente, gera outro domínio, outra tela e outro componente só por ferramentas MCP (o cliente é `packages/mcp/scripts/drive-mcp.mjs`, por stdio, contra o `prumo-mcp` do app), roda o `pnpm verify` do app (typecheck, lint, `prumo check` e testes) e apaga a pasta (trap, também na falha). Dura cerca de 30 s a 1 min, mas instala dependências e roda `tsc`, `eslint` e `vitest`: rode-o pela trava de memória, um por vez. O script não edita arquivo do app (só a CLI e o MCP mudam o app): se o verify do app falha, o achado é dos modelos, da CLI ou dos pacotes. O `verify-new.test.ts` do cli confere a estrutura do script. Rode-o ao mudar os modelos (`packages/cli/templates`), o `new`, os `make:*` ou o servidor MCP.
