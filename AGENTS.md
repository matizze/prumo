# AGENTS.md

Guia para agentes de IA neste monorepo.

## O que é

O Prumo é uma **ferramenta** da Matizze para criar e manter aplicações React organizadas em camadas (telas com `index`, `model` e `view`, domínios com schema, repositório e queries, textos em dois idiomas) e conferir a arquitetura. **Não tem frontend:** nenhum componente de interface, ícone, tema, CSS, Storybook, tela pronta, catálogo de blocos ou padrão de tela. A interface é do produto. Visão geral e comandos no [README.md](README.md); a documentação de uso (tutorial, conceitos, guias e referência), em [docs/](docs/README.md); como os pacotes funcionam por dentro, em [docs/contributing/internals.md](docs/contributing/internals.md); o processo de contribuição, no [CONTRIBUTING.md](CONTRIBUTING.md); o plano e as fases, em [docs/plan.md](docs/plan.md).

As **Fases A e B terminaram**: não há interface no repositório, e `new`, `make:page`, `make:domain` e `make:component` existem, com o portão local `pnpm verify:new` (veja a seção Verificação). Os modelos são arquivos `.tpl` com marcadores de nome em `packages/cli/templates/` (veja [docs/contributing/internals.md](docs/contributing/internals.md)), e o gerador novo entra em `packages/cli/src/generate/`. São cinco pacotes em `packages/`: `core`, `rules`, `testing`, `cli` (os comandos `new`, `make:page`, `make:domain`, `make:component`, `check` e `doctor`) e `mcp` (o servidor com as mesmas ferramentas). Os pacotes estão no npm público (`@matizze`, acesso público, sem token para instalar; o `publishConfig` aponta para o `registry.npmjs.org`); o GitHub Packages foi etapa provisória. A publicação sai pelo workflow quando a `develop` vai para a `main`, o que é decisão de uma pessoa: não publique por conta própria.

## Regras

1. **Critério para qualquer decisão:** se uma peça só faz sentido com uma interface específica, ela não é do Prumo.
2. **Pull request abre contra a `develop`**, e o que muda `packages/*` traz changeset (`pnpm changeset`). A `main` recebe as versões.
3. **Os únicos workflows do GitHub são os de publicação**: o `.github/workflows/release.yml`, que a cada push na `main` publica no npm as versões que faltam (veja `.changeset/README.md`), e o `.github/workflows/docs.yml`, que a cada push na `main` que muda `docs/` ou `website/` gera a imagem do site da documentação (`docs.prumo.matizze.com.br`) e pede ao Portainer para atualizá-lo. Não há CI de verificação (custo): a verificação é local, com `pnpm verify`. Não crie nem mude workflow sem aprovação de uma pessoa.
4. **Idioma.** Comentários, documentação e commits em português; nomes de função, variável, arquivo e pasta em inglês, inclusive os da documentação (`docs/guides/test.md`, não `docs/guias/testes.md`). Ao mudar um comportamento visível, atualize a referência e os guias em `docs/`.
5. **Dependência nova só com aprovação de uma pessoa**, mesmo que seja pequena.
6. **Um verify por vez.** A máquina de desenvolvimento tem pouca memória.

## Verificação

- `pnpm verify`: typecheck, lint e testes dos cinco pacotes, sem navegador.
- `pnpm build`: compila os pacotes (`dist/`). `pnpm pack:all [pasta]` gera os tarballs; o `packaging.test.ts` do cli (já dentro do `pnpm verify`) compila, empacota e confere os tarballs.
- `pnpm verify:new`: o portão local do app novo, sem navegador e sem GitHub (`scripts/verify-new.sh`). Empacota os pacotes (`pnpm pack:all`), cria um app com `prumo new` numa pasta temporária fora do monorepo (`--packages` os tarballs), gera nele pela CLI um domínio, uma tela com `--domain` e um componente, gera outro domínio, outra tela e outro componente só por ferramentas MCP (o cliente é `packages/mcp/scripts/drive-mcp.mjs`, por stdio, contra o `prumo-mcp` do app), roda o `pnpm verify` do app (typecheck, lint, `prumo check` e testes) e apaga a pasta (trap, também na falha). Dura cerca de 30 s a 1 min, mas instala dependências e roda `tsc`, `eslint` e `vitest`: rode-o pela trava de memória, um por vez. O script não edita arquivo do app (só a CLI e o MCP mudam o app): se o verify do app falha, o achado é dos modelos, da CLI ou dos pacotes. O `verify-new.test.ts` do cli confere a estrutura do script. Rode-o ao mudar os modelos (`packages/cli/templates`), o `new`, os `make:*` ou o servidor MCP.
