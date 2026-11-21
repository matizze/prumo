# Prumo

O Prumo é o framework da Matizze para criar produtos React sempre no mesmo formato. Ele tem uma CLI que gera código, bibliotecas que padronizam a infraestrutura, um verificador que cobra a arquitetura e uma integração com agentes de IA. A aparência fica no **MaDS**, um produto separado: o Prumo usa o MaDS, e o MaDS nunca depende do Prumo.

O plano completo está em [docs/plano-prumo.md](docs/plano-prumo.md).

## Situação

**Fase 0 (preparação).** O monorepo tem o app de referência, com o histórico do `template-react-vite-app`, e os cinco pacotes como esqueleto. A Fase 1 extrai o prumo-core e o prumo-rules do app, um módulo por pull request, conforme [docs/fase-1.md](docs/fase-1.md).

## Estrutura

| Pasta              | Conteúdo                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `packages/core`    | `@matizze/prumo-core`: infraestrutura comum dos produtos (Fase 1)                        |
| `packages/rules`   | `@matizze/prumo-rules`: regras da arquitetura, plugin de ESLint e `prumo check` (Fase 1) |
| `packages/testing` | `@matizze/prumo-testing`: utilitários de teste (Fase 3)                                  |
| `packages/cli`     | `@matizze/prumo-cli`: o comando `prumo` (Fases 1 e 2)                                    |
| `packages/mcp`     | `@matizze/prumo-mcp`: servidor MCP para agentes (Fase 4)                                 |
| `apps/reference`   | o app de referência: as 65 telas portadas, fonte do `--like` e alvo do verify            |
| `catalog`          | blocos e telas que o `prumo add` instala (Fase 3)                                        |
| `starter`          | o que o `prumo new` copia (Fase 3)                                                       |
| `docs`             | planos do Prumo e do MaDS, e o plano da Fase 1                                           |
| `.changeset`       | versões e changelog por pacote                                                           |

## Comandos

Requisitos: Node 24 (`.nvmrc`) e pnpm 10 (a versão exata está no `packageManager` do `package.json`).

```sh
pnpm install
pnpm --filter @matizze/prumo-reference exec playwright install chromium   # uma vez por máquina, para as stories
```

| Comando                 | O que faz                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `pnpm verify`           | verify dos pacotes e depois do app de referência; é o que a CI cobra                    |
| `pnpm verify:packages`  | typecheck, lint e testes de `packages/*`, um pacote por vez                             |
| `pnpm verify:reference` | o `pnpm verify` do app: typecheck, lint, testes, stories com axe nos dois temas e build |
| `pnpm dev`              | o app de referência em modo dev                                                         |
| `pnpm changeset`        | registra a mudança de um pacote para a próxima versão                                   |

Os outros scripts do app (Storybook, registry, paridade visual) rodam dentro de `apps/reference` ou com `pnpm --filter @matizze/prumo-reference <script>`. Eles estão descritos em [apps/reference/README.md](apps/reference/README.md).

O verify do app é pesado: as stories rodam no Chromium e o processo chega a uns 2 GB de memória. Rode um verify por vez.

## O app de referência

Ele veio da branch `develop` do `template-react-vite-app` com `git filter-repo --to-subdirectory-filter apps/reference`, então o histórico de cada arquivo continua disponível:

```sh
git log --follow -- apps/reference/src/architecture.test.ts
```

Nas mensagens antigas, as referências a pull requests apontam para `matizze/template-react-vite-app`.

Por enquanto, o app mantém a própria cópia dos componentes de UI (`src/components/ui`, `src/icons` e `src/styles`). A troca para o registry `@mads` fica para quando o MaDS estiver publicado.

## Branches

O trabalho acontece na `develop`, que é a branch padrão: todo pull request abre contra ela. A `main` recebe as versões.

## Pacotes, versões e CI

- **Pacotes.** Cada pacote exporta o próprio código-fonte (`src/index.ts`) e está com `"private": true` até as decisões de distribuição (GitHub Packages ou npm) e de build (tsup), que vêm antes da Fase 1.
- **Versões.** Todo pull request que muda um pacote traz um changeset (`pnpm changeset`). As regras estão em [.changeset/README.md](.changeset/README.md).
- **CI.** O [.github/workflows/ci.yml](.github/workflows/ci.yml) roda os testes dos pacotes e o verify do app de referência a cada pull request e a cada push na `main` ou na `develop`.

## Convenções

- Comentários, documentação e mensagens de commit em português; nomes de função, variável e arquivo em inglês.
- O Prumo depende do MaDS, nunca o contrário.
- Dependência nova entra só com aprovação.
