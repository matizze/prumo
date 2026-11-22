# Changesets

Esta pasta guarda as mudanças de versão pendentes dos pacotes do Prumo, uma por arquivo. Todo pull request que muda um pacote em `packages/` traz um changeset, e a CI cobra isso.

## Como usar

```sh
pnpm changeset          # escolhe os pacotes e o tipo de versão (patch, minor ou major) e descreve a mudança
pnpm changeset status   # mostra o que sai na próxima versão
pnpm changeset version  # aplica: sobe as versões e escreve o CHANGELOG.md de cada pacote
```

A descrição do changeset vai para o CHANGELOG do pacote, então escreva em português e do ponto de vista de quem usa o pacote.

## Versão

Na hora de lançar uma versão, um pull request no branch `changeset-release/develop` roda `pnpm changeset version`: sobe as versões, escreve os CHANGELOGs e apaga os changesets. Depois, um pull request leva a `develop` para a `main`. A CI não cobra changeset nesses dois.

## Decisões desta configuração

- **Pacotes privados por enquanto.** Os pacotes estão com `"private": true` até a primeira publicação (GitHub Packages, seção 10 do plano; veja o que falta abaixo). Por isso `privatePackages.version` está ligado: os pacotes ganham versão e changelog, mas não são publicados nem recebem tag.
- **App de referência, catálogo e starter fora das versões.** O `@matizze/prumo-reference`, o `@matizze/prumo-catalog` e o `@matizze/prumo-starter` ficam em `ignore`, porque não são publicados: o starter é gerado do app (`pnpm starter:build`) e chega ao produto pelo `prumo new`, e não por um pacote.
- **Sem formatação automática.** O `format` está desligado porque o Prettier não é dependência da raiz.
- **Changelog padrão.** Quando o repositório estiver no GitHub, dá para trocar pelo `@changesets/changelog-github`, que liga cada linha ao pull request. É outro pacote, então precisa de aprovação antes.

## O que falta para publicar

O passo a passo completo, com o token, a ordem, o fluxo da CI e a primeira publicação à mão, está em [docs/publicacao.md](../docs/publicacao.md). O resumo:

A distribuição está decidida (GitHub Packages, privado, escopo `@matizze`) e os pacotes já saem prontos: `core`, `rules`, `testing` e `cli` têm o build com o `tsc` (`pnpm build`), o `publishConfig` com o registry `https://npm.pkg.github.com` e acesso restrito, e o `pnpm pack:all` gera os tarballs, conferidos pelo `packaging.test.ts` do cli. **Nada foi publicado.** A primeira publicação fica para uma pessoa, em três passos que ninguém fez ainda:

1. **Tirar o `"private": true`** do `package.json` dos quatro pacotes (o `mcp` fica de fora, que ainda é esqueleto). Sem isso o `pnpm publish` recusa. O `packaging.test.ts` confere que eles continuam privados, então o pull request que os abre muda esse teste junto. Com o `private` fora, o `privatePackages` do `config.json` deixa de importar para esses pacotes, e dá para ligar `privatePackages.tag` (e o `tag` por pacote) se a versão ganhar tag no git.
2. **Um token com `write:packages`**, de uma conta com acesso de escrita ao repositório `matizze/prumo`, para a primeira publicação à mão (`NODE_AUTH_TOKEN` no ambiente, e um `.npmrc` com `@matizze:registry=https://npm.pkg.github.com` e `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`). Quem instala os pacotes precisa de um token com `read:packages` (o `prumo new` cria o `.npmrc` do produto com esse formato).
3. **O fluxo de publicação na CI**: um workflow (`.github/workflows/release.yml`) que, na `main`, roda `pnpm install --frozen-lockfile`, `pnpm build` e `pnpm changeset publish`, com `permissions: packages: write` e o `GITHUB_TOKEN` como `NODE_AUTH_TOKEN`. Hoje a CI do GitHub nem roda, por causa da cobrança da organização: resolva isso antes.

Antes de publicar, rode `pnpm pack:all` e confira os tarballs, e releia a versão de cada pacote (na Fase 3, o cli foi para a 0.3.0, o testing ganhou a primeira versão, a 0.1.0, e o core e o rules foram para a 0.1.1).
