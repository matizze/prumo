# Prumo

O Prumo é o framework da Matizze para criar produtos React sempre no mesmo formato. Ele tem uma CLI que gera código, bibliotecas que padronizam a infraestrutura, um verificador que cobra a arquitetura e uma integração com agentes de IA. A aparência fica no **MaDS**, um produto separado: o Prumo usa o MaDS, e o MaDS nunca depende do Prumo.

O plano completo está em [docs/plano-prumo.md](docs/plano-prumo.md).

## Situação

**Fase 2 concluída.** Depois da Fase 1 (o `@matizze/prumo-core` e o `@matizze/prumo-rules`, extraídos do app de referência, em [docs/fase-1.md](docs/fase-1.md)), o `@matizze/prumo-cli` gera código a partir das telas e dos domínios reais do app: `prumo make:page` (os dez padrões de tela), `prumo make:domain` e `prumo make:component`, com as costuras de mensagens, rota, menu e índices, conforme [docs/fase-2.md](docs/fase-2.md). O portão da fase está cumprido: uma tela de cada padrão, um domínio e um componente gerados pela CLI passam no `pnpm verify` (`pnpm verify:generated`). O `@matizze/prumo-testing` e o `@matizze/prumo-mcp` ainda são esqueleto (Fases 3 e 4), e o comando `new` chega na Fase 3 (o `add`, o `promote` e o `doctor` já estão no `@matizze/prumo-cli`).

## Estrutura

| Pasta              | Conteúdo                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `packages/core`    | `@matizze/prumo-core`: infraestrutura comum dos produtos (Fase 1)                        |
| `packages/rules`   | `@matizze/prumo-rules`: regras da arquitetura, plugin de ESLint e `prumo check` (Fase 1) |
| `packages/testing` | `@matizze/prumo-testing`: utilitários de teste (Fase 3)                                  |
| `packages/cli`     | `@matizze/prumo-cli`: o comando `prumo` (Fases 1 e 2)                                    |
| `packages/mcp`     | `@matizze/prumo-mcp`: servidor MCP para agentes (Fase 4)                                 |
| `apps/reference`   | o app de referência: as 65 telas portadas, fonte do `--like` e alvo do verify            |
| `catalog`          | `@matizze/prumo-catalog`: o índice dos blocos e telas que o `prumo add` instala (Fase 3) |
| `starter`          | o que o `prumo new` copia (Fase 3)                                                       |
| `docs`             | planos do Prumo e do MaDS, e os planos das Fases 1 e 2                                   |
| `.changeset`       | versões e changelog por pacote                                                           |

## Comandos

Requisitos: Node 24 (`.nvmrc`) e pnpm 10 (a versão exata está no `packageManager` do `package.json`).

```sh
pnpm install
pnpm --filter @matizze/prumo-reference exec playwright install chromium   # uma vez por máquina, para as stories
```

| Comando                                        | O que faz                                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify`                                  | verify dos pacotes e depois do app de referência; é o que a CI cobra                                                                         |
| `pnpm verify:packages`                         | typecheck, lint e testes de `packages/*` e do `catalog`, um pacote por vez                                                                   |
| `pnpm verify:reference`                        | o `pnpm verify` do app: typecheck, lint, prumo check, testes, stories com axe e build                                                        |
| `pnpm verify:generated`                        | o portão da geração: gera com a CLI uma tela de cada padrão, um domínio e um componente numa worktree temporária e roda o `pnpm verify` nela |
| `pnpm dev`                                     | o app de referência em modo dev                                                                                                              |
| `pnpm --filter @matizze/prumo-reference check` | o `prumo check` no app de referência (também roda dentro do verify)                                                                          |
| `pnpm --filter @matizze/prumo-catalog build`   | regera o `catalog/index.json` a partir do `registry.json` do app (rode depois de mudar o registry; o teste do catálogo acusa o índice velho) |
| `pnpm changeset`                               | registra a mudança de um pacote para a próxima versão                                                                                        |

Os outros scripts do app (Storybook, registry, paridade visual) rodam dentro de `apps/reference` ou com `pnpm --filter @matizze/prumo-reference <script>`. Eles estão descritos em [apps/reference/README.md](apps/reference/README.md).

O `prumo check` é o comando do `@matizze/prumo-cli`: no app de referência, `pnpm check` dentro de `apps/reference`. Em outro projeto, rode `prumo check [--root <pasta>]` (veja [packages/cli/README.md](packages/cli/README.md)); ele sai com 0 sem violação, 1 com violação e 2 se o uso está errado.

Os comandos que geram código rodam no app de referência com `pnpm exec prumo <comando>`, dentro de `apps/reference`: `make:page <nome> --like <padrão>`, `make:domain <nome>` e `make:component <nome> --page <tela>`. Eles geram no app. Para só testar, use o `--dry-run` (lista o que seria feito, sem escrever) ou gere numa cópia do app com `--root` (`rsync -a --exclude node_modules apps/reference/ /tmp/copia/`, e `prumo make:page ... --root /tmp/copia`). Desfazer com `git checkout -- apps/reference && git clean -fd apps/reference` apaga também o trabalho não commitado do app: só vale com a árvore limpa antes de gerar. Com trabalho em andamento, desfaça só os arquivos que o comando listou. Nunca faça commit de tela, domínio ou componente gerado no app de referência. O `pnpm verify:generated` faz essa prova sem sujar a árvore, numa worktree temporária; rode as etapas dele (`prepare`, `run` e `clean`) uma por vez, e não junto com outro verify.

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

- **Pacotes.** Cada pacote exporta o próprio código-fonte em TypeScript, sem build, e está com `"private": true` até a decisão de distribuição (GitHub Packages ou npm). Os pacotes com código usam exports por subcaminho, um por módulo (`@matizze/prumo-core/query`, `@matizze/prumo-rules/eslint`), para que importar um módulo não traga as dependências dos outros. O build (tsup) entra só na primeira publicação, como decidido em [docs/fase-1.md](docs/fase-1.md).
- **Versões.** Todo pull request que muda um pacote traz um changeset (`pnpm changeset`). As regras estão em [.changeset/README.md](.changeset/README.md).
- **CI.** O [.github/workflows/ci.yml](.github/workflows/ci.yml) roda os testes dos pacotes, o verify do app de referência e o job "Geração" (o portão da Fase 2: gera com a CLI uma tela de cada padrão, um domínio e um componente e roda o verify) a cada pull request e a cada push na `main` ou na `develop`.

## Convenções

- Comentários, documentação e mensagens de commit em português; nomes de função, variável e arquivo em inglês.
- O Prumo depende do MaDS, nunca o contrário.
- Dependência nova entra só com aprovação.
