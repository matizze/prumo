# @matizze/prumo-cli

O comando prumo: new, make, add, promote, check e doctor.

**Situação:** Fase 2 concluída. O `prumo` é uma árvore de comandos ([citty](https://github.com/unjs/citty)) com o `prumo check` e os três comandos que geram código: `prumo make:page` (os dez padrões de tela e a escolha no terminal, por [@clack/prompts](https://github.com/bombshell-dev/clack)), `prumo make:domain` e `prumo make:component`. Os três renomeiam pela estrutura do código ([ts-morph](https://ts-morph.com), em `src/codemod/`), nunca por busca e troca de texto, e fazem as costuras que eram manuais. O portão da fase está cumprido: uma tela de cada padrão, um domínio e um componente gerados pela CLI passam no `pnpm verify` (`pnpm verify:generated`, na raiz do monorepo; o resultado está em [docs/fase-2.md](../../docs/fase-2.md#resultado)). Faltam o `new`, o `add`, o `promote` e o `doctor` (Fase 3), a troca de domínio da tela gerada (`--domain`) e o arquivo de configuração do `check`. O plano está na seção 9 de [docs/plano-prumo.md](../../docs/plano-prumo.md).

## Comandos

| Comando                                            | O que faz                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prumo make:page <nome> [--like <padrão ou tela>]` | Gera uma tela nova a partir de um dos dez padrões ou de uma tela de referência do projeto: copia a pasta, renomeia pela estrutura do código e faz as costuras (mensagens, rota e, com `--menu`, o menu lateral). Sem `--like`, pergunta o padrão no terminal ou gera a tela mínima      |
| `prumo make:domain <nome> [--entity <singular>]`   | Gera um domínio de dados novo a partir do domínio `customers` do projeto: o schema, o repositório (contrato, mock com latência, fixtures e teste de contrato) e as queries, renomeados pela estrutura do código, e as costuras nos três índices (`schemas`, `repositories` e `queries`) |
| `prumo make:component <nome> --page <tela>`        | Gera um componente e a story dele em `src/pages/<tela>/components/`, a partir de um componente pequeno do projeto (`storage-card`), renomeado pela estrutura do código. A story tem play function e roda com o axe nos dois temas                                                       |
| `prumo check`                                      | Analisa o projeto inteiro e lista as violações da arquitetura: as pastas de `src/components`, o uso de `components/shared` pelas telas, a estrutura de cada tela e os textos completos nos idiomas                                                                                      |

Os três comandos `make:*` geram a partir do próprio projeto (no app de referência, fonte e destino são o mesmo) e fazem sozinhos as costuras:

| Comando          | Gera a partir de                         | Costuras automáticas                                                                                                                           |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `make:page`      | a tela do padrão (`--like`) ou a `blank` | mensagens nos dois idiomas e os `index.ts` delas, o `<Route>` no `src/App.tsx` (com o layout da referência) e, com `--menu`, o menu            |
| `make:domain`    | o domínio `customers`                    | os exports de `src/schemas/index.ts` e de `src/queries/index.ts`, e o import, o `export *` e o mapa `factories` de `src/repositories/index.ts` |
| `make:component` | o componente `storage-card`, com a story | nenhuma: o componente e a story ficam em `src/pages/<tela>/components/`, com o título da story único                                           |

Exemplos (no app de referência, `pnpm exec prumo ...` dentro de `apps/reference`; em outro projeto, `prumo ... --root <pasta>`):

```sh
prumo make:page produtos --like lista --menu ecommerce   # tela de lista em /produtos, com item no menu
prumo make:page pedidos --like detalhe --dry-run         # só lista o que seria feito (/pedidos/:id)
prumo make:domain suppliers                              # domínio de fornecedores (entidade supplier)
prumo make:domain companies --entity company             # quando tirar o "s" não dá o singular
prumo make:component resumo-do-pedido --page produtos    # componente e story em src/pages/produtos/components
prumo check                                              # a arquitetura do projeto inteiro
```

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
   - **Rota coberta por uma curinga ou por um parâmetro das irmãs:** `inbox-details` é recusado quando o `Switch` já tem `/inbox-details/*?`, porque o wouter escolhe a primeira rota que casa e uma das duas ficaria inalcançável. Contam as rotas irmãs (as do mesmo `<Route>` pai), com `/*?`, `/*`, `:param`, `:param?`, `:resto*` e `:resto+`; a curinga `/*` é tratada como `/*?`, pelo lado seguro.
2. **Copia e renomeia pela estrutura** (ts-morph, nunca busca e troca de texto): `src/pages/<tela>/` vira `src/pages/<nome>/`; os identificadores da tela (`<Pascal>Page`, `use<Pascal>Model`, `<Pascal>View`, `<Pascal>Skeleton`, e também as interfaces, os types e as funções que ela não exporta, como `<Pascal>FormProps`, e o apelido de um reexport, como `export { AuthSkeleton as <Pascal>Skeleton } from ...`) mudam com as referências; os arquivos com o prefixo da tela (`components/chat-header.tsx`) ganham o prefixo novo (`components/<nome>-header.tsx`), e os imports relativos acompanham; o namespace do i18n muda em `useTranslations`, `getTranslations` e nas chaves completas, também as que a tela guarda fora de `t(...)` (a mensagem de um schema do zod ou um `message:`, que o `useFieldError` traduz depois); cada story ganha o título `Pages/<Pascal>/<componente>`; a rota e o nome da suíte mudam nos testes. O componente da referência e o Pascal da tela vêm do `export default` do `index.tsx`, e não do nome da pasta: a tela `signup` exporta `SignUpPage`, com `useSignUpModel` e `SignUpView`. O componente precisa se chamar `<Pascal>Page`; sem `index.tsx`, sem export padrão com nome ou com outro nome, é erro de uso (código 2).
3. **Faz as costuras.** Copia o JSON de mensagens da referência para o namespace novo, nos dois idiomas, e o registra nos `index.ts` (em ordem alfabética); clona o `<Route>` da referência no `src/App.tsx`, com o mesmo layout, e acrescenta o import; com `--menu`, registra o item do menu.
4. **Confere.** Roda a análise do `prumo check` no projeto, mostra o resultado e imprime o comando dos testes da tela nova (`pnpm test src/pages/<nome>`; `pnpm --dir <pasta> ...` quando o projeto não é a pasta atual). Não roda testes nem o verify, que são pesados.

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
4. **Confere.** Roda a análise do `prumo check` no projeto, mostra o resultado e imprime o comando dos testes do domínio novo (`pnpm test src/repositories/<nome>`). Não roda testes nem o verify, que são pesados.

**Depois de gerar.** Os campos, as fixtures (com os nomes de pessoas) e o texto da mensagem de erro são os de `customers`: o produto edita o schema e as fixtures. O teste de contrato gerado passa porque as fixtures vêm junto, e confere os dados delas (as 18 linhas, a busca por `emilia`), então ajuste-o junto com as fixtures.

**Os testes de índice do app de referência.** Um domínio novo toca dois testes do app: o `src/repositories/index.test.ts` (os domínios do container) e o `src/queries/keys.test.ts` (o snapshot das chaves). Os dois listam explicitamente os domínios do app de referência que protegem, então um domínio gerado entra no container e nas exports sem quebrá-los (na CI, o Vitest não grava snapshot novo, e um grupo sem snapshot falharia). Para congelar as chaves de um domínio novo, acrescente o grupo (`supplierKeys`) à lista `PROTECTED` do `keys.test.ts` e grave o snapshot (`vitest -u`).

Códigos de saída: 0 quando gerou (ou, com `--dry-run`, quando simulou) e o `check` não achou violação; 1 quando gerou, mas o `check` achou violação; 2 para uso errado.

### prumo make:component

```sh
prumo make:component <nome> --page <tela> [--root <pasta>] [--dry-run]
```

- `<nome>`: o nome do componente, em kebab-case (`resumo-do-pedido`). Dele saem os arquivos (`resumo-do-pedido.tsx` e `resumo-do-pedido.stories.tsx`) e o componente em Pascal (`ResumoDoPedido`).
- `--page <tela>`: a tela que recebe o componente, uma pasta de `src/pages` (`orders`). Obrigatória.
- `--root <pasta>`: a pasta do projeto. Padrão: a pasta atual.
- `--dry-run`: lista o que seria criado, sem escrever nada.

**A fonte** é um componente real do app de referência, o `storage-card` (`src/pages/file-manager/components/`): pequeno, só de apresentação (sem i18n e sem dados) e com uma story que tem play function e passa no axe nos dois temas. O comando o copia, com a story, para `src/pages/<tela>/components/`, e renomeia pela estrutura do código (ts-morph): o componente e o tipo das props (`StorageCard` e `StorageCardProps` viram `<Pascal>` e `<Pascal>Props`), o import da story (`./storage-card` vira `./<nome>`), o título da story (`Pages/<PascalDaTela>/<Pascal>`, porque título repetido quebra o Storybook) e a descrição da story, que citava a tela e o assunto da referência e vira um texto neutro para o produto trocar. Não há arquivo de modelo no pacote: a fonte é o próprio projeto, como nos outros comandos, e o teste que gera a partir do app de referência avisa se o componente mudar.

**O componente novo não precisa ser usado pela tela**, e a pasta `components` é criada se a tela ainda não tiver. As props (ícone, tom, título, uso, arquivos e tamanho), o visual e os textos da story são os da referência, e o produto os edita. Um componente usado por duas ou mais telas é de `src/components/shared`, e quem move é o `prumo promote` (Fase 3); por isso o comando não tem `--shared`.

O que o comando faz:

1. **Valida tudo antes de escrever.** Nome ou tela inválidos, tela que não existe, nome do componente de referência, componente ou story que já existem, título de story que a tela já usa, referência ausente: tudo sai com código 2 e uma mensagem clara, sem tocar em arquivo (o `--dry-run` recusa o mesmo). Tudo é montado em memória e só vai para o disco no fim. Também são recusados o nome que é palavra reservada ou nome global (`Date`, `Promise`...) e o nome cujo Pascal repete um identificador do topo da story ou do componente de referência, lidos dos arquivos e não de uma lista: a story exporta `Default` e `Video` e importa `FolderIcon` e `PlayIcon`, então `video` geraria `import { Video } from './video'` ao lado de `export const Video: Story`, e `folder-icon` duplicaria `FolderIcon`.
2. **Copia e renomeia** o componente e a story.
3. **Confere.** Roda a análise do `prumo check` e imprime o comando do teste da story (`pnpm test:storybook <arquivo>`, que roda os dois temas; sem esse script no projeto, `pnpm exec vitest run <arquivo>`). Não roda o teste, que sobe o Chromium.

Códigos de saída: 0 quando gerou (ou, com `--dry-run`, quando simulou) e o `check` não achou violação; 1 quando gerou, mas o `check` achou violação; 2 para uso errado.

### Núcleo do codemod (interno)

`src/codemod/` tem as peças dos comandos `make:*`, uma função por operação. O `make:page` as junta (`generatePage`, em `src/codemod/generate-page.ts`) o `make:domain` (`generateDomain`, em `src/codemod/generate-domain.ts`) e o `make:component` (`generateComponent`, em `src/codemod/generate-component.ts`) também.

- **Plano de mudanças** (`ChangePlan`): um `Project` do ts-morph em memória, sem tsconfig, sem checagem de tipos e sem ler o disco por conta própria; só entram nele as cópias e os arquivos de costura. Os arquivos que não são código (JSON de mensagens, imagens) ficam numa lista à parte. Nada é escrito até o `commit()`, e o `summary()` diz o que seria criado e alterado (o `--dry-run`).
- **Nomes** (`names.ts`): valida o nome (kebab-case: minúsculas, números e hífen, começando por letra) e deriva Pascal, camel e, para domínios, singular e plural (a regra tira o `s` final; um singular explícito vale mais).
- **Cópia e renomeação**: `copyPage` copia `src/pages/<ref>/**`; `referenceComponent` lê o componente da referência no `export default` do `index.tsx`; `renameExports` renomeia `<Pascal>Page`, `use<Pascal>Model` e os demais nomes com o prefixo (exportados, locais e apelidos de reexport), com as referências, pelo language service; `renameFiles` troca o prefixo dos nomes de arquivo e deixa o ts-morph atualizar os imports (por último, depois de todas as edições: mover um arquivo antes faz o ts-morph esbarrar em nós esquecidos); `replaceNamespace` troca o namespace do i18n (e as chaves que `messageKeys` lê do JSON da referência); `renameStoryTitles` dá a cada story o título `Pages/<Pascal>/<último segmento>`; `replaceRoute` troca a rota (e o endereço completo, num nest) e o nome da suíte nos testes (e a rota citada entre crases em textos corridos); `locateReferenceRoute` acha o `<Route>` da tela de referência no `App.tsx` e `deriveRoute` monta a rota nova.
- **Domínio** (`make:domain`): `copyDomain` copia o schema, a pasta do repositório e as queries da referência; `renameDomain` renomeia os identificadores, os literais e os comentários com o nome do domínio; `registerDomain` faz as costuras nos três índices (`registerSchema`, `registerRepository` e `registerQueries`).
- **Componente** (`make:component`): `renameComponent` renomeia o componente, o tipo das props, o import e o título da story (`renameStoryTitles` com o nome do componente) e a descrição dela.
- **Costuras**: `registerMessages` (JSON nos dois idiomas e o `index.ts`, em ordem alfabética), `registerRoute` (clona o `<Route>` que o `locateReferenceRoute` achou, inclusive dentro de `nest`, e acrescenta o import) e `registerMenuItem` (item nos `subItems` de um grupo da barra lateral e o rótulo em `layout.nav.items`).

Os testes usam um app em miniatura em `src/codemod/__fixtures__/app` (fora do tsconfig, do lint e do Vitest).

O bin roda o código-fonte em TypeScript, então precisa de um Node que execute `.ts` (Node 24 ou mais novo).

### Portão da geração

O que a CLI gera tem que passar no `pnpm verify`, e a tela de referência pode mudar sem aviso. Por isso, na raiz do monorepo, o `pnpm verify:generated` (`scripts/verify-generated.sh`) cria uma worktree temporária, instala sem rede, gera nela uma tela de cada um dos dez padrões, a tela mínima, uma tela com `--menu`, um domínio e um componente, e roda o `pnpm verify`. A CI tem o job "Geração", que faz a mesma geração direto no checkout. Quem muda uma tela de referência, o `customers` ou o `storage-card` roda o portão antes do pull request. O `src/gate.test.ts` confere que o script gera os dez padrões de `src/patterns.ts`.

**Origem no app de referência:** o roteiro de criação de tela, que era feito à mão (`docs/patterns.md` e `AGENTS.md`, agora com a CLI no começo da receita), e os testes `src/architecture.test.ts` e `src/i18n/messages.test.ts`.
