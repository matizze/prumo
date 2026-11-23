# {{app.title}}

App React criado pelo Prumo (`prumo new`). O guia para pessoas e agentes de IA está em [AGENTS.md](AGENTS.md).

## Instalação

Os pacotes `@matizze/prumo-*` vêm do npm público, sem token nem configuração extra:

```sh
pnpm install
```

## Comandos

`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm check`, `pnpm test` e `pnpm verify` (typecheck, lint, test e check).

Os geradores do Prumo criam as camadas do app, cada uma com o seu comando:

```sh
pnpm exec prumo make:schema <domínio>      # o schema da entidade
pnpm exec prumo make:repository <domínio>  # o contrato e o mock
pnpm exec prumo make:query <domínio>       # as queries e mutations
pnpm exec prumo make:page <tela>           # uma tela, com a rota e as mensagens
pnpm exec prumo check                      # confere a arquitetura
```
