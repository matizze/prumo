# Prumo

O Prumo é o framework da Matizze para criar produtos React sempre no mesmo formato. Ele tem uma CLI que gera código, bibliotecas que padronizam a infraestrutura, um verificador que cobra a arquitetura e uma integração com agentes de IA. A aparência fica no **MaDS**, um produto separado: o Prumo usa o MaDS, e o MaDS nunca depende do Prumo.

O plano completo está em [docs/plano-prumo.md](docs/plano-prumo.md).

## Situação

**Fase 3 concluída.** Um produto novo chega à primeira tela sem editar nenhuma costura à mão. Depois da Fase 1 (o `@matizze/prumo-core` e o `@matizze/prumo-rules`, extraídos do app de referência, em [docs/fase-1.md](docs/fase-1.md)) e da Fase 2 (o `prumo make:page`, o `make:domain` e o `make:component`, que geram código a partir das telas e dos domínios reais do app, em [docs/fase-2.md](docs/fase-2.md)), a Fase 3 ([docs/fase-3.md](docs/fase-3.md)) integrou o que faltava:

- **`@matizze/prumo-testing`:** o render com providers, o teste de contrato dos repositórios e a configuração das stories nos dois temas, extraídos do app, que agora importa deles.
- **O catálogo e o `prumo add`:** um índice (`catalog/index.json`) dos blocos, telas e domínios do app de referência, e o comando que os instala num projeto com as costuras. Um item `@mads/<item>` vai para o `shadcn` do projeto.
- **O starter e o `prumo new`:** uma versão enxuta do app, gerada dele (`pnpm starter:build`), e o comando que cria um produto a partir dela (com `--from`, `--packages` e `--ds <cliente>`).
- **O `prumo promote` e o `prumo doctor`:** mover um componente de uma tela para o `shared` quando a segunda tela o usa, e conferir o ambiente e o projeto.
- **Build e empacotamento:** os cinco pacotes publicáveis saem com `dist/`, e o `pnpm pack:all` gera os tarballs.

O portão da fase está cumprido: `pnpm verify:product` cria um produto fora do monorepo com os pacotes empacotados, gera uma tela, um domínio e um componente com a CLI, instala um bloco do catálogo e roda o `pnpm verify` do produto. **Nada foi publicado:** os pacotes continuam `"private": true`, e a primeira publicação no GitHub Packages precisa de um token e de uma pessoa ([docs/publicacao.md](docs/publicacao.md)). O produto piloto também espera uma pessoa. O `@matizze/prumo-mcp` (Fase 4, em andamento) é o servidor MCP, uma ferramenta por comando da CLI: já sai empacotado e o produto novo o recebe, com o servidor `prumo` no `.mcp.json`; falta o portão (a etapa `mcp` do `verify:product`).

## Estrutura

| Pasta              | Conteúdo                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `packages/core`    | `@matizze/prumo-core`: infraestrutura comum dos produtos (Fase 1)                         |
| `packages/rules`   | `@matizze/prumo-rules`: regras da arquitetura, plugin de ESLint e `prumo check` (Fase 1)  |
| `packages/testing` | `@matizze/prumo-testing`: render, teste de contrato e stories com axe (Fase 3)            |
| `packages/cli`     | `@matizze/prumo-cli`: o comando `prumo` (Fases 1 a 3)                                     |
| `packages/mcp`     | `@matizze/prumo-mcp`: servidor MCP, uma ferramenta por comando da CLI (Fase 4)            |
| `apps/reference`   | o app de referência: as 65 telas portadas, fonte do `--like` e alvo do verify             |
| `catalog`          | `@matizze/prumo-catalog`: o índice dos blocos e telas que o `prumo add` instala (Fase 3)  |
| `starter`          | `@matizze/prumo-starter`: o que o `prumo new` copia, gerado do app de referência (Fase 3) |
| `docs`             | planos do Prumo e do MaDS, as Fases 1 a 3 e a publicação                                  |
| `.changeset`       | versões e changelog por pacote                                                            |

## Comandos

Requisitos: Node 24 (`.nvmrc`) e pnpm 10 (a versão exata está no `packageManager` do `package.json`).

```sh
pnpm install
pnpm --filter @matizze/prumo-reference exec playwright install chromium   # uma vez por máquina, para as stories
```

| Comando                                        | O que faz                                                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify`                                  | verify dos pacotes, do app de referência e do starter, um depois do outro; é o que a CI cobra                                                                                                                            |
| `pnpm verify:packages`                         | typecheck, lint e testes de `packages/*` e do `catalog`, um pacote por vez                                                                                                                                               |
| `pnpm verify:reference`                        | o `pnpm verify` do app: typecheck, lint, prumo check, testes, stories com axe e build                                                                                                                                    |
| `pnpm verify:starter`                          | o `pnpm verify` do starter: typecheck, lint, prumo check, testes, stories com axe e build                                                                                                                                |
| `pnpm starter:build`                           | monta o `starter/` a partir do app de referência e do catálogo (rode e faça o commit quando o app mudar; o teste do cli acusa o starter velho)                                                                           |
| `pnpm verify:generated`                        | o portão da geração: gera com a CLI uma tela de cada padrão, um domínio e um componente numa worktree temporária, regera o starter e roda nela o verify dos pacotes, o do app e o do starter                             |
| `pnpm verify:product`                          | o portão do produto novo: empacota os pacotes, cria um produto fora do monorepo com `prumo new` (de tarballs), gera uma tela, um domínio e um componente e instala um bloco com a CLI, e roda o `pnpm verify` do produto |
| `pnpm build`                                   | compila os cinco pacotes publicáveis (core, rules, testing, cli e mcp) com o `tsc`: emite o `dist/` de cada um                                                                                                           |
| `pnpm pack:all [pasta]`                        | compila e empacota os cinco pacotes com o `pnpm pack`, deixando os tarballs na pasta (padrão: `.packs`, ignorada pelo git); nada é publicado                                                                             |
| `pnpm dev`                                     | o app de referência em modo dev                                                                                                                                                                                          |
| `pnpm --filter @matizze/prumo-reference check` | o `prumo check` no app de referência (também roda dentro do verify)                                                                                                                                                      |
| `pnpm --filter @matizze/prumo-catalog build`   | regera o `catalog/index.json` e o texto gerado do índice de padrões no app (rode depois de mudar o registry ou o `patterns.json`; o teste acusa o velho)                                                                 |
| `pnpm changeset`                               | registra a mudança de um pacote para a próxima versão                                                                                                                                                                    |

Os outros scripts do app (Storybook, registry, paridade visual) rodam dentro de `apps/reference` ou com `pnpm --filter @matizze/prumo-reference <script>`. Eles estão descritos em [apps/reference/README.md](apps/reference/README.md).

O `prumo check` é o comando do `@matizze/prumo-cli`: no app de referência, `pnpm check` dentro de `apps/reference`. Em outro projeto, rode `prumo check [--root <pasta>]` (veja [packages/cli/README.md](packages/cli/README.md)); ele sai com 0 sem violação, 1 com violação e 2 se o uso está errado.

Os comandos que geram código rodam no app de referência com `pnpm exec prumo <comando>`, dentro de `apps/reference`: `make:page <nome> --like <padrão>`, `make:domain <nome>` e `make:component <nome> --page <tela>`. Eles geram no app. Para só testar, use o `--dry-run` (lista o que seria feito, sem escrever) ou gere numa cópia do app com `--root` (`rsync -a --exclude node_modules apps/reference/ /tmp/copia/`, e `prumo make:page ... --root /tmp/copia`). Desfazer com `git checkout -- apps/reference && git clean -fd apps/reference` apaga também o trabalho não commitado do app: só vale com a árvore limpa antes de gerar. Com trabalho em andamento, desfaça só os arquivos que o comando listou. Nunca faça commit de tela, domínio ou componente gerado no app de referência. O `pnpm verify:generated` faz essa prova sem sujar a árvore, numa worktree temporária; rode as etapas dele (`prepare`, `run`, `run-starter` e `clean`) uma por vez, e não junto com outro verify.

O `prumo new <nome>` cria um produto a partir do starter (`--from` aponta para este monorepo, e `--packages <pasta>` instala os pacotes do Prumo dos tarballs do `pnpm pack:all`, sem publicar nada): veja [packages/cli/README.md](packages/cli/README.md#prumo-new).

O starter não é escrito à mão: o `pnpm starter:build` o monta (copia a casca e a UI do app, roda o `prumo add` das dez telas dos padrões e move para a tela o bloco que só ela usa). O jeito de montar e de mexer está em [starter/scripts/README.md](starter/scripts/README.md).

O verify do app e o do starter são pesados: as stories rodam no Chromium e o processo chega a uns 2 GB de memória. Rode um verify por vez.

## Criar um produto

Um produto novo nasce do starter com o `prumo new`. Enquanto os pacotes não estão publicados, a origem é este monorepo e os pacotes do Prumo vêm de tarballs:

```sh
pnpm pack:all .packs                                                    # os cinco pacotes empacotados, sem publicar
node packages/cli/dist/bin.js new meu-produto --from "$PWD" --packages .packs --dir ~/Code
cd ~/Code/meu-produto
pnpm exec playwright install chromium                                    # uma vez por máquina, para as stories
pnpm exec prumo make:page pedidos --like lista --menu ecommerce         # a primeira tela, com rota, mensagens e menu
pnpm verify
```

Depois da publicação, o `prumo new meu-produto` baixa o starter do repositório (`git clone --depth 1`, com as credenciais do git de quem roda) e instala os pacotes do GitHub Packages, com `NODE_AUTH_TOKEN` (um token `read:packages`) no ambiente. Dentro do produto, a CLI cobre o dia a dia:

| Comando                                            | Para quê                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `prumo make:page`, `make:domain`, `make:component` | gerar uma tela de um dos dez padrões, um domínio de dados e um componente de tela                               |
| `prumo add <item>`                                 | trazer do catálogo um bloco, uma tela ou um domínio que o produto não tem (`--diff` e `--dry-run` antes)        |
| `prumo patterns [busca]`, `prumo catalog [busca]`  | consultar o índice de padrões (com como chegar a cada um) e os itens do catálogo (`--json` para um programa)    |
| `prumo add @mads/<item>`                           | instalar um item de UI do design system pelo `shadcn` do projeto                                                |
| `prumo promote <componente> --from <tela>`         | mover um componente para `src/components/shared` quando a segunda tela o usa                                    |
| `prumo check` e `prumo doctor`                     | cobrar a arquitetura (e o que o `AGENTS.md` cita) e conferir o ambiente, os pacotes do Prumo e o registry de UI |
| `prumo agents`                                     | atualizar as seções geradas do `AGENTS.md` (comandos, padrões do projeto e servidor MCP)                        |

Um produto de cliente com design system próprio nasce com `--ds <cliente>`, que troca o registry `@mads` por `@<cliente>-ds`. Todas as opções estão em [packages/cli/README.md](packages/cli/README.md), e a receita do produto, no `AGENTS.md` do [starter](starter/README.md).

## O app de referência

Ele veio da branch `develop` do `template-react-vite-app` com `git filter-repo --to-subdirectory-filter apps/reference`, então o histórico de cada arquivo continua disponível:

```sh
git log --follow -- apps/reference/src/architecture.test.ts
```

Nas mensagens antigas, as referências a pull requests apontam para `matizze/template-react-vite-app`.

O app mantém a própria cópia dos componentes de UI (`src/components/ui`, `src/icons` e `src/styles`). O MaDS já publica o registry `@mads`, e a Fase 3 mediu a cópia contra ele: 239 dos 251 arquivos são idênticos e os outros 12 diferem só em comentários (veja [docs/fase-3.md](docs/fase-3.md#resultado)). A cópia fica até o MaDS ser a fonte da UI do app; o produto novo traz o registry `@mads` no `components.json`, e o `prumo add @mads/<item>` instala itens dele.

## Branches

O trabalho acontece na `develop`, que é a branch padrão: todo pull request abre contra ela. A `main` recebe as versões.

## Pacotes, versões e CI

- **Pacotes.** No workspace, cada pacote exporta o próprio código-fonte em TypeScript (`src/*.ts`), e está com `"private": true` até a primeira publicação (o registry é o GitHub Packages, escopo `@matizze`). Os cinco pacotes publicáveis (core, rules, testing, cli e mcp) têm `tsconfig.build.json` e o script `build` (`tsc`, que emite o `dist/` com `.js` e `.d.ts`), e o `publishConfig` troca `exports`, `types` e `bin` para o `dist/` no `pnpm pack` e no `publish`: fora do monorepo o Node não faz type stripping dentro de `node_modules`. O `pnpm pack:all` gera os tarballs, e o `packaging.test.ts` do cli confere o conteúdo deles. Os pacotes com código usam exports por subcaminho, um por módulo (`@matizze/prumo-core/query`, `@matizze/prumo-rules/eslint`), para que importar um módulo não traga as dependências dos outros. O build é com o `tsc`, sem `tsup` (decisão 2 de [docs/fase-3.md](docs/fase-3.md)). O que falta para publicar (token, remoção do `private`, ordem e o workflow do Changesets) está em [docs/publicacao.md](docs/publicacao.md).
- **Versões.** Todo pull request que muda um pacote traz um changeset (`pnpm changeset`). As regras estão em [.changeset/README.md](.changeset/README.md).
- **CI.** O [.github/workflows/ci.yml](.github/workflows/ci.yml) roda os testes dos pacotes, o verify do app de referência, o verify do starter, o job "Geração" (o portão da Fase 2: gera com a CLI uma tela de cada padrão, um domínio e um componente e roda o verify) e o job "Produto novo" (o portão da Fase 3: `pnpm verify:product`, que empacota os pacotes, cria um produto fora do monorepo com o `prumo new` e roda o verify dele) a cada pull request e a cada push na `main` ou na `develop`.

## Convenções

- Comentários, documentação e mensagens de commit em português; nomes de função, variável e arquivo em inglês.
- O Prumo depende do MaDS, nunca o contrário.
- Dependência nova entra só com aprovação.
