# {{app.title}}

App React criado pelo Prumo (`prumo new`). O guia para pessoas e agentes de IA está em [AGENTS.md](AGENTS.md).

## Instalação

Os pacotes `@matizze/prumo-*` vêm do GitHub Packages (privado, por enquanto), pelo `.npmrc` do projeto. Quem instala precisa de um token clássico do GitHub com `read:packages`, exportado em `NODE_AUTH_TOKEN`:

```sh
export NODE_AUTH_TOKEN=<token clássico com read:packages>
pnpm install
```

O token nunca vai para o `.npmrc` nem para o git: o `.npmrc` só lê a variável. Sem ela, o `pnpm install` não baixa os pacotes do Prumo, e o `pnpm exec prumo doctor` avisa.

## Comandos

`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm check`, `pnpm test` e `pnpm verify` (typecheck, lint, check e test).
