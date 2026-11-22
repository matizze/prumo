# Changesets

Esta pasta guarda as mudanças de versão pendentes dos pacotes do Prumo, uma por arquivo. Todo pull request que muda um pacote em `packages/` traz um changeset.

## Como usar

```sh
pnpm changeset          # escolhe os pacotes e o tipo de versão (patch, minor ou major) e descreve a mudança
pnpm changeset status   # mostra o que sai na próxima versão
pnpm changeset version  # aplica: sobe as versões e escreve o CHANGELOG.md de cada pacote
```

A descrição do changeset vai para o CHANGELOG do pacote, então escreva em português e do ponto de vista de quem usa o pacote.

## Versão

Na hora de lançar uma versão, um pull request no branch `changeset-release/develop` roda `pnpm changeset version`: sobe as versões, escreve os CHANGELOGs e apaga os changesets. Depois, um pull request leva a `develop` para a `main`.

## Decisões desta configuração

- **Pacotes privados por enquanto.** Os pacotes estão com `"private": true` até a primeira publicação. Por isso `privatePackages.version` está ligado: os pacotes ganham versão e changelog, mas não são publicados nem recebem tag.
- **App de referência, catálogo e starter fora das versões.** Ficam em `ignore` enquanto existirem; saem do repositório na Fase A do plano.
- **Sem formatação automática.** O `format` está desligado porque o Prettier não é dependência da raiz.
- **Changelog padrão.** Quando o repositório estiver no GitHub, dá para trocar pelo `@changesets/changelog-github`, que liga cada linha ao pull request. É outro pacote, então precisa de aprovação antes.

## Publicação

Nada foi publicado. A publicação será no npm público, com a CI do GitHub existindo só para publicar (seção 6 do [plano](../docs/plano.md)). Até lá, não rode `changeset publish`.
