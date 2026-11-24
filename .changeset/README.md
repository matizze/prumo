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

Na hora de lançar uma versão, um pull request para a `develop` roda `pnpm changeset version`: sobe as versões, escreve os CHANGELOGs e apaga os changesets. Nesse pull request, atualize também o mapa de versões do app novo (`packages/cli/src/lib/versions.ts`): o teste `versions.test.ts` falha até ele acompanhar os `package.json` de `packages/*`. Depois, um pull request leva a `develop` para a `main`, e o workflow de publicação publica as versões novas (veja Publicação).

## Decisões desta configuração

- **Acesso público.** O `access` é `public`, como o `publishConfig` de cada pacote: os pacotes vão para o npm público, no escopo `@matizze`.
- **Sem formatação automática.** O `format` está desligado porque o Prettier não é dependência da raiz.
- **Changelog padrão.** Quando o repositório estiver no GitHub, dá para trocar pelo `@changesets/changelog-github`, que liga cada linha ao pull request. É outro pacote, então precisa de aprovação antes.

## Publicação

Os pacotes estão no npm público. Quem publica é o workflow `.github/workflows/release.yml`, a cada push na `main`: ele roda o `scripts/publish-npm.sh`, que pergunta ao npm quais versões faltam e publica só essas, autenticado pelo Trusted Publishing do npm (sem token no repositório). Não rode `changeset publish` nem `pnpm publish` à mão. Para conferir o que sairia sem publicar: `scripts/publish-npm.sh --dry-run`.
