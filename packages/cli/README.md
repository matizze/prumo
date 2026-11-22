# @matizze/prumo-cli

O comando prumo: new, make, add, promote, check e doctor.

**Situação:** Fase 3 concluída: o `prumo new` (com `--ds`), o `prumo add` (com os itens de UI do design system), o `prumo promote` e o `prumo doctor` estão prontos, além do que a Fase 2 entregou, e o `pnpm verify:product` prova o caminho de um produto novo, fora do monorepo, até a primeira tela. O `prumo` é uma árvore de comandos ([citty](https://github.com/unjs/citty)) com o `prumo check` e os três comandos que geram código: `prumo make:page` (os dez padrões de tela e a escolha no terminal, por [@clack/prompts](https://github.com/bombshell-dev/clack)), `prumo make:domain` e `prumo make:component`. Os três renomeiam pela estrutura do código ([ts-morph](https://ts-morph.com), em `src/codemod/`), nunca por busca e troca de texto, e fazem as costuras que eram manuais. O portão da fase está cumprido: uma tela de cada padrão, um domínio e um componente gerados pela CLI passam no `pnpm verify` (`pnpm verify:generated`, na raiz do monorepo; o resultado está em [docs/fase-2.md](../../docs/fase-2.md#resultado)). O `prumo add` instala blocos, telas e domínios do catálogo num projeto, o `prumo promote` move um componente de uma tela para o `shared` e o `prumo doctor` confere o ambiente e o projeto (veja abaixo). O pacote sai empacotado com `dist/` (o `bin` é o `dist/bin.js`, que roda com o `node` comum), pronto para a publicação, que ainda não aconteceu ([docs/publicacao.md](../../docs/publicacao.md)). Falta a troca de domínio da tela gerada (`--domain`) e o arquivo de configuração do `check`. O plano está na seção 9 de [docs/plano-prumo.md](../../docs/plano-prumo.md).

## Build e empacotamento

No workspace, o `exports` do pacote aponta para o código-fonte (`src/*.ts`). Fora do monorepo o Node não faz type stripping dentro de `node_modules`, então o pacote tem `tsconfig.build.json` e o script `build` (`pnpm --filter @matizze/prumo-cli run build`), que emite o `dist/` com `.js` e `.d.ts` (sem os testes, as fixtures e os arquivos de apoio deles). O `publishConfig` do `package.json` troca `exports`, `types` e `bin` para o `dist/` e define o registry `https://npm.pkg.github.com` (acesso restrito); o `pnpm pack` aplica essa troca, e o tarball leva só o `dist/`, o `package.json` e o README. O pacote continua `"private": true`: nada é publicado até uma pessoa tirar o `private` e fazer a primeira publicação (o que falta está em [.changeset/README.md](../../.changeset/README.md#o-que-falta-para-publicar)). `pnpm pack:all`, na raiz, empacota os quatro pacotes numa pasta.

## Comandos

| Comando                                                                                   | O que faz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prumo new <nome> [--dir <pasta>] [--from <pasta>] [--packages <pasta>] [--ds <cliente>]` | Cria um produto novo a partir do starter: baixa o `starter/` (clone raso do repositório do Prumo, ou um checkout local com `--from`), copia para `<dir>/<nome>` sem `node_modules`, `dist` e `scripts/`, troca o nome do app, troca o `workspace:*` dos pacotes do Prumo pela versão (ou, com `--packages`, por `pnpm.overrides` com `file:` para tarballs), cria o `.npmrc`, o `.env.local` e o `.mcp.json`, roda `git init` e `pnpm install`                                                                                              |
| `prumo make:page <nome> [--like <padrão ou tela>]`                                        | Gera uma tela nova a partir de um dos dez padrões ou de uma tela de referência do projeto: copia a pasta, renomeia pela estrutura do código e faz as costuras (mensagens, rota e, com `--menu`, o menu lateral). Sem `--like`, pergunta o padrão no terminal ou gera a tela mínima                                                                                                                                                                                                                                                          |
| `prumo make:domain <nome> [--entity <singular>]`                                          | Gera um domínio de dados novo a partir do domínio `customers` do projeto: o schema, o repositório (contrato, mock com latência, fixtures e teste de contrato) e as queries, renomeados pela estrutura do código, e as costuras nos três índices (`schemas`, `repositories` e `queries`) e, se o projeto tem `registry.json`, no item que publica um deles                                                                                                                                                                                   |
| `prumo make:component <nome> --page <tela>`                                               | Gera um componente e a story dele em `src/pages/<tela>/components/`, a partir de um componente pequeno do projeto (`storage-card`), renomeado pela estrutura do código. A story tem play function e roda com o axe nos dois temas                                                                                                                                                                                                                                                                                                           |
| `prumo add <item>...`                                                                     | Instala itens do catálogo (blocos, telas, domínios de dados e a camada de app) no projeto, com os itens de que eles dependem: copia os arquivos de uma origem (um checkout do `matizze/prumo` ou o clone em cache) e faz as costuras (mensagens, `<Route>`, índices do domínio e barrel de schemas). Valida tudo antes de escrever, com `--diff`, `--dry-run` e `--overwrite`. Um item com namespace (`@mads/button`) é de UI e vai para o `shadcn` do projeto, depois de conferir o `components.json`, as variáveis do registry e o shadcn |
| `prumo check`                                                                             | Analisa o projeto inteiro e lista as violações da arquitetura: as pastas de `src/components`, o uso de `components/shared` pelas telas, a estrutura de cada tela e os textos completos nos idiomas                                                                                                                                                                                                                                                                                                                                          |
| `prumo promote <componente> --from <tela>`                                                | Move um componente de `src/pages/<tela>/components` para `src/components/shared` (com a story e o teste), quando uma segunda tela passa a usá-lo, e ajusta os imports de quem o usa, o título da story e o `registry.json`. Recusa se só uma tela o usa                                                                                                                                                                                                                                                                                     |
| `prumo doctor [--root <pasta>]`                                                           | Confere o ambiente e o projeto, uma linha por item com ok, aviso ou erro: o Node, o pnpm, a versão de cada `@matizze/prumo-*` instalado contra a faixa que esta CLI espera, o registry de UI do `components.json` e as variáveis dele, e os arquivos `.mcp.json` e `.env.local`. O token do registry nunca é impresso                                                                                                                                                                                                                       |

Os três comandos `make:*` geram a partir do próprio projeto (no app de referência, fonte e destino são o mesmo) e fazem sozinhos as costuras:

| Comando          | Gera a partir de                         | Costuras automáticas                                                                                                                                                                                               |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `make:page`      | a tela do padrão (`--like`) ou a `blank` | mensagens nos dois idiomas e os `index.ts` delas, o `<Route>` no `src/App.tsx` (com o layout da referência) e, com `--menu`, o menu                                                                                |
| `make:domain`    | o domínio `customers`                    | os exports de `src/schemas/index.ts` e de `src/queries/index.ts`, e o import, o `export *` e o mapa `factories` de `src/repositories/index.ts`; o item do `registry.json` que publica um desses índices, se houver |
| `make:component` | o componente `storage-card`, com a story | nenhuma: o componente e a story ficam em `src/pages/<tela>/components/`, com o título da story único                                                                                                               |

Exemplos (no app de referência, `pnpm exec prumo ...` dentro de `apps/reference`; em outro projeto, `prumo ... --root <pasta>`):

```sh
prumo make:page produtos --like lista --menu ecommerce   # tela de lista em /produtos, com item no menu
prumo make:page pedidos --like detalhe --dry-run         # só lista o que seria feito (/pedidos/:id)
prumo make:domain suppliers                              # domínio de fornecedores (entidade supplier)
prumo make:domain companies --entity company             # quando tirar o "s" não dá o singular
prumo make:component resumo-do-pedido --page produtos    # componente e story em src/pages/produtos/components
prumo check                                              # a arquitetura do projeto inteiro
```

**Para só testar uma geração**, use o `--dry-run` (lista o que seria criado e alterado, sem escrever) ou gere numa cópia do projeto com `--root`. No app de referência, desfazer com `git checkout -- apps/reference && git clean -fd apps/reference` apaga também o trabalho não commitado do app: só vale com a árvore limpa antes de gerar. Com trabalho em andamento, desfaça só os arquivos que o comando listou. Nunca faça commit de tela, domínio ou componente gerado no app de referência.

### Ajuda e códigos de saída

- `prumo` ou `prumo --help` lista os comandos; `prumo <comando> --help` mostra a sintaxe, os argumentos e as opções de um comando. A ajuda é em português.
- Todo comando sai com 0 quando dá certo e com 2 quando o uso está errado: comando ou opção que não existe, argumento que falta ou sobra, pasta que não é um projeto. Os demais códigos são de cada comando (o `check` sai com 1 quando há violação).

### prumo check

```sh
prumo check [--root <pasta>]
```

- `--root <pasta>`: a pasta do projeto, a que tem o `src`. Padrão: a pasta atual.
- Cada violação sai numa linha com o arquivo, a regra e o que está errado: `src/components/widgets  [components-folders]  A pasta 'widgets' não é permitida ...`.
- O código de saída é 0 sem violação, 1 com violação e 2 se o uso está errado, então o comando serve de portão na CI. Raiz que não existe, que não é pasta ou que não tem `package.json` e `src` também sai com 2 e uma mensagem clara, em vez de passar sem analisar nada. Essa conferência é do `findProject` (`src/project.ts`), que todos os comandos usam para achar a raiz e os caminhos do projeto: `src/pages`, `src/messages`, `src/App.tsx` e o menu lateral.
- As verificações, as pastas e os idiomas vêm de [`@matizze/prumo-rules/check`](../rules/README.md#análise-do-projeto-prumo-check), com os padrões da arquitetura do Prumo. O arquivo de configuração ainda não existe (fica para depois da Fase 2).

### prumo new

```sh
prumo new <nome> [--dir <pasta>] [--from <pasta>] [--packages <pasta>] [--ds <cliente>] [--no-install] [--dry-run]
```

- `<nome>`: o nome do produto, em kebab-case, começando com letra (`meu-produto`, `loja2`). Vira a pasta e o `name` do `package.json`.
- `--dir <pasta>`: a pasta onde criar `<nome>`. Padrão: a pasta atual. O destino (`<dir>/<nome>`) não pode existir com conteúdo (uma pasta vazia serve).
- `--from <pasta>`: um checkout do `matizze/prumo` de onde sai o starter (o próprio monorepo serve). Sem a opção, o comando clona o repositório (`git clone --depth 1`, com as credenciais do git de quem roda) numa pasta temporária, que apaga no fim. O repositório vem de `PRUMO_REPOSITORY` (padrão: `https://github.com/matizze/prumo.git`).
- `--packages <pasta>`: uma pasta com os tarballs `@matizze/prumo-*` (o `pnpm pack:all`, na raiz do monorepo, os gera). O `package.json` do produto ganha `pnpm.overrides` com `file:` para cada tarball, e não há `.npmrc`. É o que prova a instalação fora do monorepo antes da publicação.
- `--ds <cliente>`: o design system do cliente em vez do MaDS: `--ds gekom` troca o registry de UI `@mads` por `@gekom-ds` (veja abaixo). O nome é kebab-case, em minúsculas.
- `--no-install`: só cria os arquivos, sem o `pnpm install`.
- `--dry-run`: lista o que seria copiado, alterado e criado, sem escrever nada.

O que o comando faz, nesta ordem:

1. **Valida antes de escrever** (saída 2): o nome, a pasta de destino, a origem, a pasta de `--packages` (que precisa ter o tarball de cada pacote do Prumo que o starter usa) e, para instalar do registry, a variável `NODE_AUTH_TOKEN`. Nada é escrito se algo falha, e uma falha no meio da escrita apaga o que o comando criou.
2. **Copia `starter/`** sem `node_modules`, `dist`, `scripts/` (o gerador do starter, que só serve ao monorepo), arquivos de workspace (`pnpm-workspace.yaml`, `pnpm-lock.yaml`), `*.local` e `*.tsbuildinfo`.
3. **Troca o nome:** o `name` do `package.json`, o `<title>` do `index.html` (`meu-produto` vira `Meu Produto`), o título e a frase de abertura do `AGENTS.md` e o título do `README.md`. Tira o script `starter:build` do `package.json` e o `scripts/*.ts` do `tsconfig.node.json`.
4. **Resolve os pacotes do Prumo:** o `workspace:*` de cada `@matizze/prumo-*` vira `^<versão>`, lida do `packages/*/package.json` da origem. Com `--packages`, o `pnpm.overrides` aponta para os tarballs.
5. **Cria o `.npmrc`** (sem `--packages`) com `@matizze:registry=https://npm.pkg.github.com` e o token como `${NODE_AUTH_TOKEN}`, sem o valor no arquivo. O `pnpm install` lê a variável do ambiente: defina-a com um token `read:packages` antes de rodar o comando (ou use `--packages`, ou `--no-install`).
6. **Cria o `.env.local`** (cópia do `.env.example`, sem token) e o `.mcp.json` (o do starter, ou o padrão do shadcn).
7. **Roda `git init`** (sem commit: o produto decide o primeiro) **e `pnpm install`**, e mostra os próximos passos (`pnpm dev`, `pnpm exec prumo make:page`). Se o `pnpm install` falha, o produto fica criado e o comando sai com 1, dizendo como seguir.

```sh
prumo new meu-produto --dry-run                                  # o que seria feito
NODE_AUTH_TOKEN=... prumo new meu-produto                        # do GitHub Packages (depois da publicação)
prumo new meu-produto --from ~/Code/matizze/prumo --packages .packs   # de tarballs locais, sem rede para os pacotes do Prumo
```

**O registry de UI e o `--ds`.** O `components.json` do starter já traz o registry `@mads` (o design system da Matizze), com `MADS_REGISTRY_URL` e `MADS_REGISTRY_TOKEN` no `.env.local`, e a UI do starter (`src/components/ui`, `src/icons`, `src/styles`) é uma cópia do MaDS. Com `--ds <cliente>`, o `new` troca isso para o design system do cliente, num lugar só do código (`src/ds.ts`):

| O quê                         | `@mads` (padrão)                                                | `--ds gekom`                                           |
| ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| registry no `components.json` | `@mads`                                                         | `@gekom-ds` (`--ds acme-corp` vira `@acme-corp-ds`)    |
| URL e token                   | `MADS_REGISTRY_URL`, `MADS_REGISTRY_TOKEN`                      | `GEKOM_DS_REGISTRY_URL`, `GEKOM_DS_REGISTRY_TOKEN`     |
| `.env.example` e `.env.local` | a URL do registry do MaDS preenchida, token vazio               | as duas variáveis em branco: a URL do MaDS não serve   |
| `AGENTS.md` e `README.md`     | dizem que a UI é uma cópia do MaDS e de onde vêm os itens novos | dizem o mesmo com o registry e as variáveis do cliente |

O resto do produto não muda: a cópia do MaDS fica como base, e os itens novos vêm do registry do cliente (`prumo add @gekom-ds/<item>`). Um registry de cliente publica os itens com o namespace dele, inclusive nas `registryDependencies` (`@gekom-ds/utils`), como o MaDS faz com `@mads/utils`.

### prumo make:page

```sh
prumo make:page <nome> [--like <padrão ou tela>] [--root <pasta>] [--menu <grupo>] [--dry-run]
```

- `<nome>`: o nome da tela nova, em kebab-case (`produtos`, `pedidos-recentes`). Dele saem a pasta, o Pascal (`PedidosRecentes`), o namespace do i18n em camelCase (`pedidosRecentes`), o arquivo de mensagens e a rota.
- `--like <padrão ou tela>`: o padrão (`lista`) ou a tela de referência, uma pasta de `src/pages` do próprio projeto (`products-list`). O nome de um padrão vale mais que uma pasta com o mesmo nome. No app de referência, ele é fonte e destino ao mesmo tempo. Sem `--like`, num terminal interativo (entrada e saída são um terminal) o comando pergunta o padrão, com a opção "Tela mínima"; fora dele (CI, agentes), gera a tela mínima, a partir de `blank`. Cancelar a pergunta sai com 1, sem gerar nada.
- `--root <pasta>`: a pasta do projeto. Padrão: a pasta atual.
- `--menu <grupo>`: acrescenta o item da tela ao grupo do menu lateral (`ecommerce`) e o rótulo (`Pedidos recentes`) nas mensagens de todos os idiomas. Sem a opção, o menu não muda. Não vale para tela com parâmetro na rota.
- `--dry-run`: lista o que seria criado e alterado, sem escrever nada.

Os padrões e as telas de referência (a tabela está num só lugar do código, `src/patterns.ts`, e um teste confere que cada tela existe no app de referência):

| Padrão          | Tela de referência    | Particularidade que o comando trata                           |
| --------------- | --------------------- | ------------------------------------------------------------- |
| `dashboard`     | `sales-dashboard`     |                                                               |
| `lista`         | `products-list`       | arquivos auxiliares da tela (`csv.ts`, `labels.ts`) vão junto |
| `detalhe`       | `invoice-detail`      | parâmetro na rota (`/<nome>/:id`)                             |
| `formulario`    | `add-product`         |                                                               |
| `chat`          | `chat`                | casca de altura total (`<Private fill>`) clonada junto        |
| `configuracoes` | `ai-settings-general` | rota dentro de `<Route nest>`: a tela entra no mesmo `nest`   |
| `kanban`        | `task-kanban`         |                                                               |
| `autenticacao`  | `login`               | `AuthLayout`; sem arquivo de mensagens próprio (usa `auth`)   |
| `status`        | `error-404`           | `BareLayout`, sem casca e sem skeleton                        |
| `vazio`         | `empty-state-one`     |                                                               |
| (tela mínima)   | `blank`               | só o cabeçalho da página e um cartão; sem skeleton            |

O que o comando faz:

1. **Valida tudo antes de escrever.** Nome ou referência que não são kebab-case, tela que já existe, tela de referência ou mensagens dela que não existem, rota da referência que não está no `src/App.tsx`, grupo de menu que não existe: todos saem com código 2 e uma mensagem clara, sem tocar em nenhum arquivo (o `--dry-run` recusa o mesmo). Tudo é montado em memória e só vai para o disco no fim. Um `make:page` nunca deixa o projeto quebrado e sai com 0, então também são recusados:
   - **Nome que é palavra reservada do JavaScript** (`new`, `default`, `class`, `delete`, `let`, `static`, `enum`, `yield`, `await`...): o nome vira `import new from './new.json'` e a chave `new,` nas mensagens, um erro de sintaxe que derruba o i18n. A lista, uma só para os três comandos, está em `src/codemod/names.ts`.
   - **Nome que o projeto já registra:** `error404` e `error-404` dão o mesmo `Error404Page` e o mesmo namespace `error404`, e repetiriam o import do `App.tsx` e o import e a chave dos `index.ts` de mensagens.
   - **`--menu` com grupo que não existe** (ou que não tem subitens), **ou numa tela com parâmetro na rota** (`--like detalhe --menu ecommerce`, `/<nome>/:id`): o item do menu precisa de um caminho sem parâmetro. Também é recusado o item que repete o caminho ou a chave de rótulo de um que o menu já tem.
   - **Rota coberta por uma curinga ou por um parâmetro das irmãs:** `inbox-details` é recusado quando o `Switch` já tem `/inbox-details/*?`, porque o wouter escolhe a primeira rota que casa e uma das duas ficaria inalcançável. Contam as rotas irmãs (as do mesmo `<Route>` pai), com `/*?`, `/*`, `:param`, `:param?`, `:resto*` e `:resto+`; a curinga `/*` é tratada como `/*?`, pelo lado seguro.
2. **Copia e renomeia pela estrutura** (ts-morph, nunca busca e troca de texto): `src/pages/<tela>/` vira `src/pages/<nome>/`; os identificadores da tela (`<Pascal>Page`, `use<Pascal>Model`, `<Pascal>View`, `<Pascal>Skeleton`, e também as interfaces, os types e as funções que ela não exporta, como `<Pascal>FormProps`, e o apelido de um reexport, como `export { AuthSkeleton as <Pascal>Skeleton } from ...`) mudam com as referências; os arquivos com o prefixo da tela (`components/chat-header.tsx`) ganham o prefixo novo (`components/<nome>-header.tsx`), e os imports relativos acompanham; o namespace do i18n muda em `useTranslations`, `getTranslations` e nas chaves completas, também as que a tela guarda fora de `t(...)` (a mensagem de um schema do zod ou um `message:`, que o `useFieldError` traduz depois); cada story ganha o título `Pages/<Pascal>/<componente>`; a rota e o nome da suíte mudam nos testes. O componente da referência e o Pascal da tela vêm do `export default` do `index.tsx`, e não do nome da pasta: a tela `signup` exporta `SignUpPage`, com `useSignUpModel` e `SignUpView`. O componente precisa se chamar `<Pascal>Page`; sem `index.tsx`, sem export padrão com nome ou com outro nome, é erro de uso (código 2).
3. **Faz as costuras.** Copia o JSON de mensagens da referência para o namespace novo, nos dois idiomas, e o registra nos `index.ts` (em ordem alfabética); clona o `<Route>` da referência no `src/App.tsx`, com o mesmo layout, e acrescenta o import; com `--menu`, registra o item do menu.
4. **Confere.** Roda a análise do `prumo check` no projeto, mostra o resultado e imprime o comando dos testes da tela nova (`pnpm test src/pages/<nome>`; `pnpm --dir <pasta> ...` quando o projeto não é a pasta atual, com a pasta entre aspas se tiver espaço ou caractere especial). Não roda testes nem o verify, que são pesados.

A rota nova é `/<nome>` mais os parâmetros da rota da referência: `produtos --like products-list` gera `/produtos`, e `pedidos --like invoice-detail` gera `/pedidos/:id`. Se a tela de referência tem mais de uma rota no `App.tsx`, vale a que tem parâmetro e, depois, a primeira do arquivo. O `<Route>` clonado é o que usa o componente da referência: o mesmo `path` pode se repetir em outros `<Route>` do `App.tsx` (`/billing` no topo e dentro do nest de `/ai-settings`, `/` em três lugares), e a busca é pelo componente, e não pelo `path`. Nos testes e nos links, a troca depende da rota da referência:

- **Sem parâmetro** (`invoices`, `/invoices`): muda o literal igual à rota (`'/invoices'`) e a rota seguida de `?` (`/invoices?page=2`). Os subcaminhos (`/invoices/${invoice.id}`) ficam como estão, porque a rota nova não tem subrotas e eles apontam para o detalhe da referência (`/invoices/:id`), que existe. Trocá-los geraria um link para uma rota que o `App.tsx` não tem, e o teste gerado fixaria o endereço errado.
- **Com parâmetro** (`invoice-detail`, `/invoices/:id`): só o trecho fixo muda (`/invoices/inv_1` vira `/pedidos/inv_1`), e o link para a lista (`/invoices`) fica, porque a lista é outra tela.
- **Dentro de um `nest`:** o teste passa o endereço completo ao `renderWithProviders` (`/ai-chat/text`), e ele vira o endereço completo da tela nova (`/ai-chat/<nome>`), com as mesmas regras; senão o teste exercitaria a tela de origem.

A rota citada entre crases na descrição de uma story também muda.

Códigos de saída: 0 quando gerou (ou, com `--dry-run`, quando simulou) e o `check` não achou violação; 1 quando gerou, mas o `check` achou violação (a tela já está no projeto, e as violações saem no stderr); 2 para uso errado. Fica fora, por enquanto, a troca do domínio (`--domain`), que é de depois do portão ([docs/fase-2.md](../../docs/fase-2.md)).

**Rota aninhada.** Se a referência está dentro de um `<Route ... nest>` (as telas de configurações: `/ai-settings` mais `/general`), o `<Route>` novo entra no mesmo `nest`, com o caminho relativo a ele (`/<nome>`), e o endereço da tela é o prefixo mais o nome (`/ai-settings/<nome>`); `--menu` usa esse endereço completo. A rota de dentro de um `<Route>` que não é `nest` continua sendo erro de uso (código 2).

**Menu de seções do nest.** Se o `nest` da referência tem um layout em volta das seções (`AiSettingsLayout` em `/ai-settings`, `AiChatLayout` em `/ai-chat`), o resumo avisa: o layout pode ter um menu de seções próprio, uma lista fixa do componente (os `GROUPS` de `src/components/layout/ai-settings-layout.tsx`), que o `make:page` não edita. A tela nova só abre pela URL (`/ai-settings/<nome>`) até o item entrar na lista do layout, e quem faz isso é o produto. A detecção é simples: o componente que envolve as seções dentro do `<Route nest>`, sem olhar o código dele, então o aviso diz que o layout "pode ter" menu. `--menu` não resolve, porque ele acrescenta o item na barra lateral do app, e não no menu do layout.

**Tela sem mensagens próprias.** Se a referência não tem `src/messages/<idioma>/<tela>.json` em nenhum idioma (o login usa o namespace `auth`, de todas as telas de entrada), a tela nova usa os mesmos namespaces, não ganha arquivo de mensagens e o comando avisa. Ter o arquivo em só um dos idiomas continua sendo erro.

**Limites dos nomes.** A renomeação segue a sintaxe, sem checagem de tipos:

- **Nomes que não começam pelo Pascal da tela** não mudam: `ChatterProps` numa tela `chat` fica, e o que a tela importa de outro módulo (`ChatMessage`, de `@/schemas`) também.
- **O arquivo que um literal cita fora de um `import`** (`vi.mock('./components/chat-header')`, `import('./chat-header')`) não muda de nome, porque o ts-morph só atualiza as declarações de `import` e de `export ... from`; ele fica com o nome antigo e continua funcionando. O app de referência não tem nenhum caso. Arquivos que não são código (JSON, imagens, `README.md`) nunca mudam de nome, e o texto deles é copiado como está.
- **Um import com extensão** (`'./chat-header.tsx'`) é reescrito sem ela quando o arquivo muda de nome.
- **Chave de mensagem:** só vira a do namespace novo o literal cuja chave existe no JSON de mensagens da referência (`fileManager.renameDialog.required`). O texto que só se parece com ela, ou uma chave montada com substituição (`` `fileManager.status.${status}` ``), fica.
- **`--like inbox`:** a rota `/` repetida (são três no `App.tsx`) não o impede mais, mas ele continua recusado: o nest de `/inbox` tem a rota `/:id`, que casaria com qualquer rota nova ao lado dela (ver "Rota coberta por uma curinga ou por um parâmetro das irmãs"). Para gerar a partir da caixa de entrada, a rota `/:id` do nest tem que mudar antes.

**Formatação.** O nome novo muda o tamanho das linhas, e uma linha de código gerada pode passar do limite do prettier do projeto (aconteceu num teste de `configuracoes`). O comando não formata: rode o `prettier --write` do projeto nos arquivos novos, se o `format:check` fizer parte da CI.

### prumo make:domain

```sh
prumo make:domain <nome> [--entity <singular>] [--root <pasta>] [--dry-run]
```

- `<nome>`: o nome do domínio, no plural e em kebab-case (`suppliers`, `purchase-orders`). Dele saem a pasta do repositório (`src/repositories/<nome>/`), o arquivo de queries (`src/queries/<nome>.ts`), o `create<Pascal>Repository` e a chave do container e do `createQueryKeys` em camelCase (`purchaseOrders`).
- `--entity <singular>`: a entidade (`supplier`). Sem a opção, sai do nome pela regra de tirar o `s` final. Onde a regra erra, o comando recusa em vez de derivar um nome errado em silêncio: o plural que termina em `ies`, `us`, `ss`, `xes`, `ches`, `shes` ou `sses` (`categories` daria `categorie`, `status` daria `statu`) pede a entidade (`--entity category`), e a mensagem sugere a provável. Dela saem o schema (`src/schemas/entities/<entidade>.ts`), os tipos (`Supplier`, `SupplierListQuery`), as chaves (`supplierKeys`, `supplierQueries`), a constante das fixtures (`MOCK_SUPPLIERS`) e o código de erro (`SUPPLIER_NOT_FOUND`).
- `--root <pasta>`: a pasta do projeto. Padrão: a pasta atual.
- `--dry-run`: lista o que seria criado e alterado, sem escrever nada.

O que o comando faz:

1. **Valida tudo antes de escrever.** Nome ou entidade inválidos, singular que a regra não deriva ou deriva errado, domínio que já existe (a pasta do repositório, o arquivo de queries ou o schema da entidade), domínio de referência incompleto, índice que falta ou sem o formato esperado: tudo sai com código 2 e uma mensagem clara, sem tocar em arquivo (o `--dry-run` recusa o mesmo). Tudo é montado em memória e só vai para o disco no fim. Também são recusados:
   - **Singular ou plural que é palavra reservada** (`class`) **ou nome global** (`Date`, `Record`, `Promise`, `Map`...): o domínio vira tipos, constantes e variáveis locais com esse nome, e o tipo `Record` esconderia o `Record<...>` do TypeScript no arquivo gerado.
   - **Nome exportado que já existe:** `make:domain messages` geraria `messageSchema`, `MessageSchema` e `MOCK_MESSAGES`, que o domínio `messaging` já exporta, e os dois `export *` dariam o erro TS2308 no `tsc` e no build. Antes das costuras, o comando reúne os nomes que os arquivos novos exportam e confere contra os que `src/schemas/index.ts`, `src/repositories/index.ts` e `src/queries/index.ts` já exportam, seguindo os `export *` pelos arquivos (só os que o caminho toca, sem tsconfig). A mensagem lista os nomes por índice e sugere outro nome ou `--entity` (que muda só os nomes da entidade, como os do schema). **Limite:** os nomes saem da sintaxe, sem checagem de tipos, então o que vem de um pacote (`export * from '@matizze/prumo-core/data'`) ou de um apelido de caminho (`@/...`) não é seguido, e uma colisão com eles só aparece no `tsc`.
2. **Copia e renomeia pela estrutura** (ts-morph, nunca busca e troca de texto) o domínio de referência `customers`: `src/schemas/entities/customer.ts`, `src/repositories/customers/` e `src/queries/customers.ts`. Cada identificador com o nome da entidade ou do domínio troca a parte do nome (`Customer`, `ICustomersRepository`, `MockCustomersRepository`, `createCustomersRepository`, `MOCK_CUSTOMERS`, `customerKeys`, `customerQueries` e as variáveis locais); os exports do schema que o nome não cita (`addressSchema`) ganham o prefixo da entidade (`supplierAddressSchema`), senão os dois domínios exportariam o mesmo nome por `export *`. Nos literais mudam a chave do `createQueryKeys('customers', ...)`, o código de erro, o prefixo dos ids das fixtures (`cus_` vira `sup_`) e os títulos de `describe` e `it`; a mensagem do erro "não encontrado" vira `Registro não encontrado.`, porque cita a entidade em português. Os nomes citados em comentários (como `CUSTOMER_NOT_FOUND`) mudam também.
3. **Faz as costuras.** Export em `src/schemas/index.ts` (depois do último); import, `export *` e a entrada do mapa `factories` em `src/repositories/index.ts` (em ordem alfabética); e `export { <entidade>Keys, <entidade>Queries }` em `src/queries/index.ts` (em ordem alfabética, no formato das linhas existentes). O tipo do container acompanha o mapa sozinho.
4. **Registra no `registry.json`, se o projeto tem um.** Se há um item cujos `files` incluem `src/schemas/index.ts`, `src/repositories/index.ts` ou `src/queries/index.ts`, os arquivos novos que esse índice reexporta (o schema, a pasta do repositório, o arquivo de queries; sem os testes, que o registry não publica) entram no mesmo item, em ordem de caminho e no formato dos vizinhos (`type` e, se houver, `target`). O `registry.json` aparece entre os alterados, também no `--dry-run`. Sem `registry.json`, ou sem item que publique um desses índices, nada muda; um `registry.json` que não é JSON é erro de uso (código 2). O arquivo é regravado com `JSON.stringify`, no recuo que já tinha, então um registry formatado de outro jeito muda de formato. No app de referência, só o item `schemas` publica um índice: o schema novo entra nele, e o `src/registry.test.ts` continua verde sem costura à mão.
5. **Confere.** Roda a análise do `prumo check` no projeto. O catálogo **não traz testes nem stories** (o `registry.json` não os publica), e a saída final de quem instalou tela, domínio ou bloco diz isso e aponta onde está a receita para escrevê-los: o `AGENTS.md` do produto. Um bloco instalado sozinho, que nenhuma tela usa, já sai com a violação `shared-usage` ("precisa de 2 ou mais telas"), que é a regra do projeto e some quando as telas o usam.

Códigos de saída: 0 sem violação (e `--diff` e `--dry-run`, que não escrevem), 1 se o `check` do fim achar violação (os itens já foram instalados) ou se o git não conseguir baixar a origem, 2 para uso errado.

```sh
prumo add page-products-list --from ~/Code/matizze/prumo             # tela de lista, com os blocos, as mensagens e a rota
prumo add repo-tasks page-task-kanban --root apps/web --dry-run      # o que seria feito
prumo add task-menu --diff                                           # a diferença contra o bloco do projeto
prumo add page-login --overwrite                                     # troca os arquivos do projeto pelos do catálogo
```

**Para testar numa cópia do app de referência**, como o portão da fase: apague os arquivos de um item (e as costuras dele), rode `prumo add <item> --root apps/reference --from <checkout limpo>` e confira com `git diff`: os arquivos voltam iguais, e só mudam a posição das linhas nos índices e a das rotas no `App.tsx` (o `add` põe a rota depois da última rota do `<Switch>`, e as mensagens em ordem alfabética). Desfaça com `git checkout -- apps/reference && git clean -fd apps/reference`, só com a árvore limpa antes.

#### Itens de UI: `prumo add @mads/<item>`

Um item com namespace que não é o do catálogo (`@mads/button`, `@gekom-ds/card`) é do registry de UI do projeto, o do design system. O comando o entrega ao `shadcn` do próprio projeto (`node_modules/.bin/shadcn add <item>`, o mesmo que `pnpm exec shadcn add <item>`), com o `components.json` do produto, e não lê o catálogo: não precisa de `--from` nem de rede para o clone. Sem terminal (CI, agentes) ele passa `--yes` ao shadcn; num terminal, o shadcn pergunta. `--overwrite` vai adiante.

Antes de chamar o shadcn, o comando confere e recusa com código 2, dizendo o que fazer, tudo de uma vez:

- o `components.json` existe e tem o registry daquele namespace (se falta o `@mads`, a mensagem traz o trecho para acrescentar);
- as variáveis que o registry cita (`${MADS_REGISTRY_URL}`, `${MADS_REGISTRY_TOKEN}`) estão no ambiente ou num dos arquivos que o shadcn lê (`.env.local`, `.env.development.local`, `.env.development`, `.env`), e não vazias. **O token nunca aparece em saída nenhuma**, nem na mensagem do erro;
- o shadcn está instalado no projeto (é `devDependency` do starter).

`--dry-run` faz essas conferências e mostra o comando, sem rodar o shadcn nem tocar na rede. `--diff` não vale para itens de UI (o shadcn tem o `--diff <arquivo>` dele, e a mensagem o indica). Se o shadcn falha (token recusado, item que não existe), o comando sai com 1 e mostra o comando para rodar à mão.

Pode-se misturar os dois no mesmo pedido: `prumo add page-orders @mads/badge`. O comando valida o catálogo primeiro (um arquivo diferente ou um idioma que falta recusa antes de instalar a UI), instala a UI e então grava os itens, e conta a UI do pedido como presente para a conferência de "UI que falta".

**UI que falta num bloco.** Sem terminal, o comando recusa e diz o `prumo add @mads/<item>` que resolve (o namespace é o do registry de UI do projeto: `@gekom-ds` num produto criado com `--ds gekom`). Num terminal, ele pergunta se instala agora pelo registry; aceitando, confere as variáveis e o shadcn como acima, instala a UI e segue com os itens. Com `--dry-run` e `--diff` não pergunta.

```sh
prumo add @mads/button                        # só UI: o shadcn do projeto, sem ler o catálogo
prumo add @mads/button @mads/card --dry-run   # o comando do shadcn, sem rodar
prumo add page-orders @mads/badge             # a UI primeiro, o item do catálogo depois
prumo add @gekom-ds/card                      # produto criado com --ds gekom
```

### prumo promote

```sh
prumo promote <componente> --from <tela> [--root <pasta>] [--dry-run]
```

- `<componente>`: o componente, em kebab-case, como o arquivo (`resumo-do-pedido`).
- `--from <tela>`: a tela onde ele está, uma pasta de `src/pages` (`orders`). Obrigatória.
- `--root <pasta>`: a pasta do projeto. Padrão: a pasta atual.
- `--dry-run`: lista o que seria movido e alterado, sem escrever nada.

Quando uma segunda tela passa a usar um componente de `src/pages/<tela>/components/`, ele é de `src/components/shared/`. O comando move `<componente>.tsx` e o que vai ao lado dele (`<componente>.stories.tsx`, `<componente>.test.tsx`, `.spec.*` e `.mdx`) e ajusta, pela estrutura do código (ts-morph, no mesmo plano em memória dos outros comandos) e não por busca e troca de texto:

- **Os imports de quem usa o componente**, em qualquer tela, no layout e em outros módulos de `shared`, e também testes, stories, `import()` dinâmico, `export ... from`, tipos `import('...')` e `vi.mock`: viram `@/components/shared/<componente>`, escritos com o alias, relativos ou não.
- **Os imports relativos dos arquivos movidos** que deixam de resolver (`../../../lib/x` vira `../../lib/x`). O que o componente importa por alias ou por pacote não muda.
- **O título da story** que cita a tela (`Pages/<Tela>/<Pascal>`, o formato do `make:component`) vira `Patterns/<Tela>/<Pascal>`, o formato das stories de `src/components/shared`, que agrupam por assunto. Título que não cita a tela fica.
- **O `registry.json`**, se o projeto tem: o componente entra como bloco (`registry:block`) na ordem alfabética, com `registryDependencies` e `dependencies` lidas dos imports, e título e descrição provisórios para você editar (o teste do registry exige um bloco por arquivo de `shared`). O arquivo antigo sai da lista do item da tela, e todo item que importa o componente passa a depender do bloco.

**Recusa com código 2, sem escrever nada** (o `--dry-run` recusa o mesmo): nome inválido; tela ou componente que não existe; componente que já está em `shared`; **menos de duas telas usando o componente**, porque o `prumo check` exige 2 ou mais em `shared` e o `promote` não gera essa violação (a mensagem diz o que fazer: importar o componente da segunda tela, pelo caminho da tela de origem, e rodar de novo); componente (ou story ou teste dele) que importa algo da pasta da tela de origem além dos arquivos que se movem, porque o `shared` não depende de tela; nome que já existe em `shared`, na pasta ou como item do `registry.json`; título de story que outra story já usa. A contagem de telas é a da regra `shared-usage` do `prumo check`: testes e stories não contam, um módulo de `shared` vale pelas telas que o usam e a casca do layout conta como duas.

Ao terminar, roda a análise do `prumo check` e imprime o comando do teste da story. Códigos de saída: 0 sem violação (e `--dry-run`), 1 se o `check` do fim achar violação (o componente já foi movido), 2 para uso errado.

```sh
prumo promote resumo-do-pedido --from orders            # move para src/components/shared
prumo promote resumo-do-pedido --from orders --dry-run  # o que seria feito
```

### prumo doctor

```sh
prumo doctor [--root <pasta>]
```

- `--root <pasta>`: a pasta do projeto, a que tem o `package.json`. Padrão: a pasta atual.
- Uma linha por item, `ok`, `aviso` ou `erro`, e no fim a contagem. O comando não escreve nada e não usa a rede (o `pnpm --version` roda fora do projeto, com o download de versões desligado).
- **Node:** erro abaixo do Node 24 (o mínimo do Prumo, porque os comandos rodam `.ts` direto). Aviso se o `.nvmrc` do projeto (ou o de uma pasta acima, num monorepo) ou o `engines.node` (`>=N`) pedem outra versão.
- **pnpm:** erro se o pnpm não existe. Aviso se o `package.json` (ou o de uma pasta acima) não tem `packageManager`, se ele não é pnpm, ou se o pnpm instalado é de outra major ou mais antigo que o `packageManager`.
- **Pacotes do Prumo:** a versão instalada em `node_modules` de `@matizze/prumo-core`, `-rules`, `-testing` e `-cli` contra uma faixa compatível (`>=0.1.0 <0.2.0`), não contra a igualdade, porque os pacotes versionam separados. Atrás da faixa: aviso para atualizar o pacote. À frente: aviso para atualizar a CLI. A faixa do `@matizze/prumo-cli` é a da versão que está rodando. Só entram os pacotes que o projeto declara ou tem instalados; declarado e não instalado é erro (`pnpm install`).
- **Registry de UI:** o `components.json` precisa existir e ser JSON (erro se não); o registry de UI é o `@mads` ou o `@<cliente>-ds` (aviso se não há nenhum). As variáveis vêm das `${VARIAVEL}` da URL e dos headers do registry (`MADS_REGISTRY_URL` e `MADS_REGISTRY_TOKEN` no `@mads`, e as do cliente no `@<cliente>-ds`) e são lidas do ambiente e do `.env.local` (o ambiente vence). Variável ausente é aviso. **O token nunca aparece:** só "definido" ou "ausente", e a URL sai sem usuário e senha.
- **Projeto:** `.mcp.json` e `.env.local` ausentes são aviso.
- Código de saída: 0 sem erro (avisos não falham), 1 com erro, 2 para uso errado (opção desconhecida, pasta sem `package.json`).

As faixas dos pacotes estão em `src/doctor/ranges.ts`. O Changesets não mantém um campo próprio do `package.json`, então a tabela é do código, e o `ranges.test.ts` a compara com o `package.json` de cada pacote do workspace: quando um pacote sai da faixa, o teste falha e a faixa é revista junto com a versão.

### Núcleo do codemod (interno)

`src/codemod/` tem as peças dos comandos `make:*`, uma função por operação. O `make:page` as junta (`generatePage`, em `src/codemod/generate-page.ts`) o `make:domain` (`generateDomain`, em `src/codemod/generate-domain.ts`) e o `make:component` (`generateComponent`, em `src/codemod/generate-component.ts`) também.

- **Plano de mudanças** (`ChangePlan`): um `Project` do ts-morph em memória, sem tsconfig, sem checagem de tipos e sem ler o disco por conta própria; só entram nele as cópias e os arquivos de costura. Os arquivos que não são código (JSON de mensagens, imagens) ficam numa lista à parte. Nada é escrito até o `commit()`, e o `summary()` diz o que seria criado e alterado (o `--dry-run`).
- **Nomes** (`names.ts`): valida o nome (kebab-case: minúsculas, números e hífen, começando por letra) e deriva Pascal, camel e, para domínios, singular e plural (a regra tira o `s` final; um singular explícito vale mais).
- **Cópia e renomeação**: `copyPage` copia `src/pages/<ref>/**`; `referenceComponent` lê o componente da referência no `export default` do `index.tsx`; `renameExports` renomeia `<Pascal>Page`, `use<Pascal>Model` e os demais nomes com o prefixo (exportados, locais e apelidos de reexport), com as referências, pelo language service; `renameFiles` troca o prefixo dos nomes de arquivo e deixa o ts-morph atualizar os imports (por último, depois de todas as edições: mover um arquivo antes faz o ts-morph esbarrar em nós esquecidos); `replaceNamespace` troca o namespace do i18n (e as chaves que `messageKeys` lê do JSON da referência); `renameStoryTitles` dá a cada story o título `Pages/<Pascal>/<último segmento>`; `replaceRoute` troca a rota (e o endereço completo, num nest) e o nome da suíte nos testes (e a rota citada entre crases em textos corridos); `locateReferenceRoute` acha o `<Route>` da tela de referência no `App.tsx` e `deriveRoute` monta a rota nova.
- **Domínio** (`make:domain`): `copyDomain` copia o schema, a pasta do repositório e as queries da referência; `renameDomain` renomeia os identificadores, os literais e os comentários com o nome do domínio; `registerDomain` faz as costuras nos três índices (`registerSchema`, `registerRepository` e `registerQueries`).
- **Componente** (`make:component`): `renameComponent` renomeia o componente, o tipo das props, o import e o título da story (`renameStoryTitles` com o nome do componente) e a descrição dela.
- **Costuras do `prumo add`** (`add/` e `codemod/`): `readCatalog` lê e confere o `catalog/index.json`, `resolveItems` resolve as dependências, `splitRequested` e `planUi` (`add/ui.ts`) separam os itens de UI e os conferem antes de chamar o shadcn, `src/ds.ts` diz o registry e as variáveis do design system (`@mads` ou `@<cliente>-ds`), `resolveOrigin` acha a origem (pasta ou clone em cache), `planAdd` monta o plano (com a semeadura da camada de app e a promoção do bloco localizado, que usa o `promoteComponents` do `promote`, o mesmo codemod em lote); `addRoute` clona o `<Route>` do `App.tsx` da origem, `mergeBarrel` acrescenta os exports que faltam no barrel, `registerMessageNamespace` registra um namespace sem copiar JSON, `registerRepositoryEntry` e `registerQueriesEntry` registram um domínio com os nomes dados.
- **Costuras**: `registerMessages` (JSON nos dois idiomas e o `index.ts`, em ordem alfabética), `registerRoute` (clona o `<Route>` que o `locateReferenceRoute` achou, inclusive dentro de `nest`, e acrescenta o import) e `registerMenuItem` (item nos `subItems` de um grupo da barra lateral e o rótulo em `layout.nav.items`).

Os testes usam um app em miniatura em `src/codemod/__fixtures__/app` (fora do tsconfig, do lint e do Vitest).

No workspace, o bin roda o código-fonte em TypeScript (`src/bin.ts`), então precisa de um Node que execute `.ts` (Node 24 ou mais novo). No pacote empacotado, o bin é o `dist/bin.js`, JavaScript comum, que o Node roda dentro de `node_modules`. O cli não lê nada do pacote além do próprio `package.json` (a versão, no `prumo doctor`): o catálogo e o starter vêm sempre da origem (`--from` ou o clone em git do `matizze/prumo`), e o `src/packaging.test.ts` confere isso instalando o `dist/` num projeto vazio fora do monorepo.

### Portão da geração

O que a CLI gera tem que passar no `pnpm verify`, e a tela de referência pode mudar sem aviso. Por isso, na raiz do monorepo, o `pnpm verify:generated` (`scripts/verify-generated.sh`) cria uma worktree temporária, instala sem rede, gera nela uma tela de cada um dos dez padrões, a tela mínima, uma tela com `--menu`, um domínio e um componente, regera o starter (`starter/`, que é gerado do app) e roda o verify dos pacotes, o do app e o do starter, em etapas separadas (`prepare`, `run`, `run-starter` e `clean`). A CI tem o job "Geração", que faz a mesma geração direto no checkout. Quem muda uma tela de referência, o `customers` ou o `storage-card` roda o portão antes do pull request. O `src/gate.test.ts` confere que o script gera os dez padrões de `src/patterns.ts`.

### Portão do produto novo

O `pnpm verify:product` (`scripts/verify-product.sh`) prova o caminho inteiro de um produto novo, fora do monorepo. Em etapas, cada uma com menos de 10 minutos: `pack` (os tarballs do `pnpm pack:all` e o HEAD extraído com `git archive`), `new` (o `prumo new --from` o HEAD `--packages` os tarballs, e o `pnpm install`, sem rede quando o store já tem tudo), `generate` (com o `prumo` instalado no produto, o de `dist/`: `make:page --like lista --menu ecommerce`, `make:domain` e `make:component`, cada um com o `prumo check` sem violação), `run` (o `pnpm verify` do produto: typecheck, lint, `prumo check`, testes, stories nos dois temas e build), `add` (o `prumo add` de um bloco do catálogo, que o starter não traz, e typecheck e lint com ele) e `clean`. O script não edita arquivo nenhum do produto entre o `new` e o `verify`, e é o critério da Fase 3. O `add` vem depois do verify porque um bloco instalado sozinho não tem tela que o use, e o `prumo check` o acusa (`shared-usage`) até duas telas o usarem. O job "Produto novo" da CI faz o mesmo. O `src/product-gate.test.ts` confere as etapas e os comandos do script.

**O starter** (`starter/`) é montado por `starter/scripts/build.ts` a partir do app de referência e do catálogo, com o `prumo add` das dez telas dos padrões (veja [starter/scripts/README.md](../../starter/scripts/README.md)). O `src/starter.test.ts` roda o script com `--check` e falha quando o starter está fora de dia, e confere que o starter tem o que os `make:*` copiam (as dez telas, a tela `blank`, o domínio `customers` e o componente `storage-card`, de `src/pages/file-manager`).

**O empacotamento** é conferido pelo `src/packaging.test.ts`: ele roda `scripts/pack-packages.sh` numa pasta temporária (compila e roda o `pnpm pack` nos quatro pacotes) e confere cada tarball (`tar -tzf`): o `dist/` com o `.js` e o `.d.ts` de cada subcaminho do `exports`, nenhum `src/`, teste, fixture nem `tsconfig`, o `package.json` com `exports`, `types` e `bin` no `dist/`, o `workspace:*` trocado pela versão e nenhum import de `.ts` no que foi emitido. Depois instala o cli e o rules do tarball num projeto vazio e roda `--help`, `check`, `doctor` e o plugin de ESLint pelo `node`, sem type stripping. O teste leva uns 6 segundos (o build dos quatro pacotes).

**Origem no app de referência:** o roteiro de criação de tela, que era feito à mão (`docs/patterns.md` e `AGENTS.md`, agora com a CLI no começo da receita), e os testes `src/architecture.test.ts` e `src/i18n/messages.test.ts`.
