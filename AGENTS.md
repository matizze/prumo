# AGENTS.md

Guia para agentes de IA neste monorepo.

## O que é

O Prumo é uma ferramenta para criar e manter aplicações React em camadas (telas com `index`, `model` e `view`; domínios com schema, repositório e queries; textos em dois idiomas) e conferir a arquitetura. **Não traz frontend:** nada de componente de interface, ícone, tema, CSS, Storybook, telas prontas, catálogo de blocos ou `--like`. O plano está em [docs/plano.md](docs/plano.md).

O repositório está em transição: `apps/reference`, `catalog` e `starter` são restos das fases anteriores e saem na Fase A. Não amplie nada neles.

## Regras

1. **Sem frontend no Prumo.** Se uma peça só faz sentido com uma interface específica, ela não é do Prumo.
2. **Pull request contra a `develop`**, um assunto por PR; o que muda `packages/*` traz changeset (`pnpm changeset`). A `main` recebe as versões.
3. **Idioma.** Comentários, documentação e commits em português; nomes de função, variável e arquivo em inglês.
4. **Dependência nova só com aprovação de uma pessoa**, mesmo que seja pequena.
5. **Nada roda no GitHub sem aprovação.** A CI de verificação foi desligada pelo custo; a CI do Prumo vai existir só para publicar. Não crie nem religue workflow e não publique pacote.
6. **Um verify por vez.** A máquina tem pouca memória.

## Verificação

- `pnpm verify:packages`: typecheck, lint e testes dos pacotes. Rode antes de abrir o pull request.
