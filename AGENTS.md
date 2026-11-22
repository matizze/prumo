# AGENTS.md

Guia para agentes de IA neste monorepo.

## O que é

O Prumo é uma **ferramenta** da Matizze para criar e manter aplicações React organizadas em camadas (telas com `index`, `model` e `view`, domínios com schema, repositório e queries, textos em dois idiomas) e conferir a arquitetura. **Não tem frontend:** nenhum componente de interface, ícone, tema, CSS, Storybook, tela pronta, catálogo de blocos ou padrão de tela. A interface é do produto. Visão geral e comandos no [README.md](README.md); o plano e as fases, em [docs/plano.md](docs/plano.md).

São cinco pacotes em `packages/`: `core`, `rules`, `testing`, `cli` (os comandos `check` e `doctor`) e `mcp` (o servidor com as mesmas ferramentas). Nada foi publicado: os pacotes seguem `"private": true`, e a primeira publicação (npm público, Fase C do plano) espera uma pessoa e um token. Não tire o `private` nem publique por conta própria.

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
