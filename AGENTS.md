# AGENTS.md

Guia para agentes de IA neste monorepo.

## O que é

O Prumo é uma **ferramenta** da Matizze para criar e manter aplicações React organizadas em camadas (telas com `index`, `model` e `view`, domínios com schema, repositório e queries, textos em dois idiomas) e conferir a arquitetura. **Não tem frontend:** nenhum componente de interface, ícone, tema, CSS, Storybook, tela pronta, catálogo de blocos ou padrão de tela. A interface é do produto. Visão geral e comandos no [README.md](README.md); a documentação de uso (tutorial, conceitos, guias e referência), em [docs/](docs/README.md); como os pacotes funcionam por dentro, em [docs/contributing/internals.md](docs/contributing/internals.md); o processo de contribuição, no [CONTRIBUTING.md](CONTRIBUTING.md); o plano e as fases, em [docs/plan.md](docs/plan.md).

A **reescrita da CLI terminou**: a v1 está completa na `develop`, e a versão 0.7.0 do `@matizze/prumo-cli` espera uma pessoa decidir a versão e a ida para a `main`. Os comandos são `new`, `make:schema` (`--entity`, `--fields`), `make:repository` (`--data-source mock|http|storage`), `make:query`, `make:page` (`--query`, `--path`), `check`, `list` (`--json`) e `mcp` (o servidor MCP, por stdio, com uma ferramenta por comando); saíram `make:domain`, `make:component`, `move:component` e `doctor`. O pacote `@matizze/prumo-mcp` não volta. Os modelos são arquivos `.tpl` com marcadores de nome em `packages/cli/templates/`, e cada comando tem o seu gerador em `packages/cli/src/generators/`, que devolve um plano antes de escrever (veja [docs/contributing/internals.md](docs/contributing/internals.md)). São quatro pacotes em `packages/`: `core`, `rules`, `testing` e `cli`. Os pacotes estão no npm público (`@matizze`, acesso público, sem token para instalar; o `publishConfig` aponta para o `registry.npmjs.org`). A publicação sai pelo workflow quando a `develop` vai para a `main`, o que é decisão de uma pessoa: não publique por conta própria.

## Regras

1. **Critério para qualquer decisão:** se uma peça só faz sentido com uma interface específica, ela não é do Prumo.
2. **Pull request abre contra a `develop`**, e o que muda `packages/*` traz changeset (`pnpm changeset`). A `main` recebe as versões.
3. **Os únicos workflows do GitHub são os de publicação**: o `.github/workflows/release.yml`, que a cada push na `main` publica no npm as versões que faltam (veja `.changeset/README.md`), e o `.github/workflows/docs.yml`, que a cada push na `main` que muda `docs/` ou `website/` gera a imagem do site da documentação (`docs.prumo.matizze.com.br`) e pede ao Portainer para atualizá-lo. Não há CI de verificação (custo): a verificação é local, com `pnpm verify`. Não crie nem mude workflow sem aprovação de uma pessoa.
4. **Idioma.** Comentários, documentação e commits em português; nomes de função, variável, arquivo e pasta em inglês, inclusive os da documentação (`docs/guides/test.md`, não `docs/guias/testes.md`). Ao mudar um comportamento visível, atualize a referência e os guias em `docs/`.
5. **Dependência nova só com aprovação de uma pessoa**, mesmo que seja pequena.
6. **Um verify por vez.** A máquina de desenvolvimento tem pouca memória.

## Verificação

- `pnpm verify`: typecheck, lint e testes dos quatro pacotes, sem navegador.
- `pnpm build`: compila os pacotes (`dist/`). `pnpm pack:all [pasta]` gera os tarballs; o `packaging.test.ts` do cli (já dentro do `pnpm verify`) compila, empacota e confere os tarballs.
- `pnpm verify:new`: o portão local do app novo, sem navegador e sem GitHub (`scripts/verify-new.sh`). Empacota os pacotes (`pnpm pack:all`), cria um app com `prumo new` numa pasta temporária fora do monorepo (`--packages` os tarballs), roda nele todos os comandos pela CLI (`make:schema` com campos de todos os tipos, `make:repository` nas três fontes, `make:query` e as quatro variações do `make:page`; no fim, o `prumo list` e o `prumo list --json`, que o script confere com um `node -e`), roda a etapa `mcp` (`packages/cli/scripts/drive-mcp.mjs`: um cliente do SDK abre o servidor pelo `.mcp.json` que o `new` criou, confere as seis ferramentas e gera só por elas o domínio `autores` e duas telas, um `dry_run`, um erro de uso, o `check` e o `list`), roda o `pnpm verify` do app (typecheck, lint, `prumo check` e testes) e apaga a pasta (trap, também na falha). Instala dependências e roda `tsc`, `eslint` e `vitest`: rode-o pela trava de memória, um por vez. O script não edita arquivo do app (só a CLI muda o app): se o verify do app falha, o achado é dos modelos, da CLI ou dos pacotes. O `verify-new.test.ts` do cli confere a estrutura do script. Rode-o ao mudar os modelos (`packages/cli/templates`), o `new`, os `make:*` ou o servidor MCP.
