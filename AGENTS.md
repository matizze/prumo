# AGENTS.md

Guia para agentes de IA neste monorepo. Dentro de `apps/reference`, vale também o guia do próprio app, [apps/reference/AGENTS.md](apps/reference/AGENTS.md), com a arquitetura das telas, os repositórios e o índice de padrões.

## O que é

O Prumo é o framework da Matizze para produtos React: pacotes versionados (core, rules, testing, cli e mcp), um app de referência com as telas portadas, um catálogo e um starter. Visão geral e comandos no [README.md](README.md); o plano completo em [docs/plano-prumo.md](docs/plano-prumo.md).

## Regras

1. **O Prumo depende do MaDS; o MaDS nunca depende do Prumo.** Componentes de UI, tokens, tema e ícones são do MaDS. Até o MaDS ser publicado, o app de referência mantém a própria cópia deles.
2. **O app de referência é a fonte de verdade.** Uma mudança num pacote não pode quebrar o verify do app.
3. **Extração do app para um pacote: um módulo por pull request.** O app passa a importar do pacote no mesmo pull request, com o verify verde. A ordem e os arquivos estão em [docs/fase-1.md](docs/fase-1.md).
4. **Pull request abre contra a `develop`**, e o que muda `packages/*` traz changeset (`pnpm changeset`). A CI cobra. A `main` recebe as versões.
5. **Idioma.** Comentários, documentação e commits em português; nomes de função, variável e arquivo em inglês.
6. **Dependência nova só com aprovação de uma pessoa**, mesmo que seja pequena.
7. **Um verify por vez.** O do app roda as stories no Chromium e chega a uns 2 GB de memória.

## Verificação

- Mudança só em `packages/*`: `pnpm verify:packages`.
- Antes de abrir o pull request: `pnpm verify`, que roda os pacotes e o app de referência.
- Mudança no codemod, nos comandos `make:*` ou numa tela de referência: também `pnpm verify:generated`, o portão da Fase 2, que gera uma tela de cada padrão, um domínio e um componente numa worktree temporária e roda o `pnpm verify` nela (etapas `prepare`, `run` e `clean`, cada uma com menos de 10 minutos; um verify por vez). Veja `scripts/verify-generated.sh`.
