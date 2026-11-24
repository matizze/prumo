# AGENTS.md

Guia para agentes de IA e pessoas que contribuem com este monorepo.

## O que é

O Prumo é uma **ferramenta** da Matizze para criar e manter aplicações React organizadas em camadas (telas com `index`, `model` e `view`, domínios com schema, repositório e queries, textos em dois idiomas) e conferir a arquitetura. **Não tem frontend:** nenhum componente de interface, ícone, tema, CSS, Storybook, tela pronta, catálogo de blocos ou padrão de tela. A interface é do produto.

Onde ler mais:

- [README.md](README.md): visão geral e comandos.
- [docs/](docs/README.md): a documentação de uso (tutorial, conceitos, guias e referência) e o [roadmap](docs/roadmap.md).
- [docs/contributing/internals.md](docs/contributing/internals.md): como os pacotes funcionam por dentro.
- [CONTRIBUTING.md](CONTRIBUTING.md): o processo de contribuição.

## Estrutura

Quatro pacotes em `packages/`, versionados separadamente:

- `core`: infraestrutura do app gerado (container de repositórios, query keys, i18n tipado, erros com código, utilitários de mock, guarda de rota).
- `rules`: o plugin de ESLint e a análise do projeto que o `prumo check` roda.
- `testing`: `renderWithProviders`, setup do DOM e o teste de contrato de repositórios.
- `cli`: o comando `prumo` (`new`, `make:schema`, `make:usecase`, `make:repository`, `make:query`, `make:page`, `check`, `list` e `mcp`). Cada comando tem o seu gerador em `packages/cli/src/generators/`, que devolve um plano antes de escrever, e o servidor MCP, que descreve as ferramentas a partir dos comandos, fica em `packages/cli/src/mcp/`. Os modelos são arquivos `.tpl` com marcadores de nome em `packages/cli/templates/`.

Os pacotes são publicados no npm (`@matizze`, acesso público) pelo workflow de release, quando a `develop` vai para a `main`. Publicar é decisão de uma pessoa: não publique por conta própria.

## Regras

1. **Critério para qualquer decisão:** se uma peça só faz sentido com uma interface específica, ela não é do Prumo.
2. **Pull request abre contra a `develop`**, e o que muda `packages/*` traz changeset (`pnpm changeset`). A `main` recebe as versões.
3. **Os únicos workflows do GitHub são os de publicação**: o `.github/workflows/release.yml`, que a cada push na `main` publica no npm as versões que faltam (veja `.changeset/README.md`), e o `.github/workflows/docs.yml`, que a cada push na `main` que muda `docs/` ou `website/` gera a imagem do site da documentação (`docs.prumo.matizze.com.br`) e pede ao Portainer para atualizá-lo. Não há CI de verificação: a verificação é local, com `pnpm verify`. Não crie nem mude workflow sem aprovação de uma pessoa.
4. **Idioma.** Comentários, documentação e commits em português; nomes de função, variável, arquivo e pasta em inglês, inclusive os da documentação (`docs/guides/test.md`, não `docs/guias/testes.md`). Ao mudar um comportamento visível, atualize a referência e os guias em `docs/`.
5. **Dependência nova só com aprovação de uma pessoa**, mesmo que seja pequena.

## Verificação

- `pnpm verify`: typecheck, lint e testes dos quatro pacotes, sem navegador.
- `pnpm build`: compila os pacotes (`dist/`). `pnpm pack:all [pasta]` gera os tarballs; o `packaging.test.ts` do cli (já dentro do `pnpm verify`) compila, empacota e confere os tarballs.
- `pnpm verify:new`: o portão local do app novo (`scripts/verify-new.sh`). Empacota os pacotes, cria um app com `prumo new` numa pasta temporária fora do monorepo, roda nele todos os comandos pela CLI, gera outro domínio e três telas só por ferramentas MCP (o cliente é `packages/cli/scripts/drive-mcp.mjs`, por stdio, contra o `prumo mcp` do app), roda o `pnpm verify` do app (typecheck, lint, `prumo check` e testes) e apaga a pasta, também na falha. O script não edita arquivo do app (só a CLI e o MCP mudam o app): se o verify do app falha, o achado é dos modelos, da CLI ou dos pacotes. Rode-o ao mudar os modelos (`packages/cli/templates`), o `new`, os `make:*` ou o servidor MCP.
- `pnpm --dir website build`: gera o site da documentação; o build falha com link ou âncora quebrados. Rode-o ao mudar `docs/` ou `website/`.
