# @matizze/prumo-cli

O comando prumo: new, make, add, promote, check e doctor.

**Situação:** Fase 2 em andamento. O `prumo` é uma árvore de comandos ([citty](https://github.com/unjs/citty)) e hoje tem o `prumo check`, o `prumo make:page` (com os dez padrões e a escolha no terminal, por [@clack/prompts](https://github.com/bombshell-dev/clack)), o `prumo make:domain` e o `prumo make:component`; o núcleo do codemod ([ts-morph](https://ts-morph.com), em `src/codemod/`) é o que os três usam ([docs/fase-2.md](../../docs/fase-2.md)). O plano está na seção 9 de [docs/plano-prumo.md](../../docs/plano-prumo.md).

## Comandos

| Comando                                            | O que faz                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prumo make:page <nome> [--like <padrão ou tela>]` | Gera uma tela nova a partir de um dos dez padrões ou de uma tela de referência do projeto: copia a pasta, renomeia pela estrutura do código e faz as costuras (mensagens, rota e, com `--menu`, o menu lateral). Sem `--like`, pergunta o padrão no terminal ou gera a tela mínima      |
| `prumo make:domain <nome> [--entity <singular>]`   | Gera um domínio de dados novo a partir do domínio `customers` do projeto: o schema, o repositório (contrato, mock com latência, fixtures e teste de contrato) e as queries, renomeados pela estrutura do código, e as costuras nos três índices (`schemas`, `repositories` e `queries`) |
| `prumo make:component <nome> --page <tela>`        | Gera um componente e a story dele em `src/pages/<tela>/components/`, a partir de um componente pequeno do projeto (`storage-card`), renomeado pela estrutura do código. A story tem play function e roda com o axe nos dois temas                                                       |
| `prumo check`                                      | Analisa o projeto inteiro e lista as violações da arquitetura: as pastas de `src/components`, o uso de `components/shared` pelas telas, a estrutura de cada tela e os textos completos nos idiomas                                                                                      |

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
- As verificações, as pastas e os idiomas vêm de [`@matizze/prumo-rules/check`](../rules/README.md#análise-do-projeto-prumo-check), com os padrões da arquitetura do Prumo. O arquivo de configuração chega na Fase 2.

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

1. **Valida tudo antes de escrever.** Nome ou referência que não são kebab-case, tela que já existe, tela de referência ou mensagens dela que não existem, rota da referência que não está no `src/App.tsx`, grupo de menu que não existe: todos saem com código 2 e uma mensagem clara, sem tocar em nenhum arquivo. Tudo é montado em memória e só vai para o disco no fim.
2. **Copia e renomeia pela estrutura** (ts-morph, nunca busca e troca de texto): `src/pages/<tela>/` vira `src/pages/<nome>/`; os identificadores exportados (`<Pascal>Page`, `use<Pascal>Model`, `<Pascal>View`, `<Pascal>Skeleton`) mudam com as referências; o namespace do i18n muda em `useTranslations`, `getTranslations` e nas chaves completas; cada story ganha o título `Pages/<Pascal>/<componente>`; a rota e o nome da suíte mudam nos testes.
3. **Faz as costuras.** Copia o JSON de mensagens da referência para o namespace novo, nos dois idiomas, e o registra nos `index.ts` (em ordem alfabética); clona o `<Route>` da referência no `src/App.tsx`, com o mesmo layout, e acrescenta o import; com `--menu`, registra o item do menu.
4. **Confere.** Roda a análise do `prumo check` no projeto, mostra o resultado e imprime o comando dos testes da tela nova (`pnpm test src/pages/<nome>`; `pnpm --dir <pasta> ...` quando o projeto não é a pasta atual). Não roda testes nem o verify, que são pesados.

A rota nova é `/<nome>` mais os parâmetros da rota da referência: `produtos --like products-list` gera `/produtos`, e `pedidos --like invoice-detail` gera `/pedidos/:id`. Se a tela de referência tem mais de uma rota no `App.tsx`, vale a que tem parâmetro e, depois, a primeira do arquivo. Numa tela com parâmetro, só o trecho fixo da rota muda nos testes e nos links (`/invoices/inv_1` vira `/pedidos/inv_1`), e o link para a lista (`/invoices`) fica, porque a lista é outra tela. A rota citada entre crases na descrição de uma story também muda.

Códigos de saída: 0 quando gerou (ou, com `--dry-run`, quando simulou) e o `check` não achou violação; 1 quando gerou, mas o `check` achou violação (a tela já está no projeto, e as violações saem no stderr); 2 para uso errado. Fica fora, por enquanto, a troca do domínio (`--domain`), que é de depois do portão ([docs/fase-2.md](../../docs/fase-2.md)).

**Rota aninhada.** Se a referência está dentro de um `<Route ... nest>` (as telas de configurações: `/ai-settings` mais `/general`), o `<Route>` novo entra no mesmo `nest`, com o caminho relativo a ele (`/<nome>`), e o endereço da tela é o prefixo mais o nome (`/ai-settings/<nome>`); `--menu` usa esse endereço completo. A rota de dentro de um `<Route>` que não é `nest` continua sendo erro de uso (código 2).

**Tela sem mensagens próprias.** Se a referência não tem `src/messages/<idioma>/<tela>.json` em nenhum idioma (o login usa o namespace `auth`, de todas as telas de entrada), a tela nova usa os mesmos namespaces, não ganha arquivo de mensagens e o comando avisa. Ter o arquivo em só um dos idiomas continua sendo erro.

**Formatação.** O nome novo muda o tamanho das linhas, e uma linha de código gerada pode passar do limite do prettier do projeto (aconteceu num teste de `configuracoes`). O comando não formata: rode o `prettier --write` do projeto nos arquivos novos, se o `format:check` fizer parte da CI.

### prumo make:domain

```sh
prumo make:domain <nome> [--entity <singular>] [--root <pasta>] [--dry-run]
```

- `<nome>`: o nome do domínio, no plural e em kebab-case (`suppliers`, `purchase-orders`). Dele saem a pasta do repositório (`src/repositories/<nome>/`), o arquivo de queries (`src/queries/<nome>.ts`), o `create<Pascal>Repository` e a chave do container e do `createQueryKeys` em camelCase (`purchaseOrders`).
- `--entity <singular>`: a entidade (`supplier`). Sem a opção, sai do nome pela regra de tirar o `s` final; quando a regra erra (`categories` daria `categorie`), informe a entidade (`--entity category`). Dela saem o schema (`src/schemas/entities/<entidade>.ts`), os tipos (`Supplier`, `SupplierListQuery`), as chaves (`supplierKeys`, `supplierQueries`), a constante das fixtures (`MOCK_SUPPLIERS`) e o código de erro (`SUPPLIER_NOT_FOUND`).
- `--root <pasta>`: a pasta do projeto. Padrão: a pasta atual.
- `--dry-run`: lista o que seria criado e alterado, sem escrever nada.

O que o comando faz:

1. **Valida tudo antes de escrever.** Nome ou entidade inválidos, singular que a regra não deriva, domínio que já existe (a pasta do repositório, o arquivo de queries ou o schema da entidade), domínio de referência incompleto, índice que falta ou sem o formato esperado: tudo sai com código 2 e uma mensagem clara, sem tocar em arquivo. Tudo é montado em memória e só vai para o disco no fim.
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

1. **Valida tudo antes de escrever.** Nome ou tela inválidos, tela que não existe, nome do componente de referência, componente ou story que já existem, título de story que a tela já usa, referência ausente: tudo sai com código 2 e uma mensagem clara, sem tocar em arquivo. Tudo é montado em memória e só vai para o disco no fim.
2. **Copia e renomeia** o componente e a story.
3. **Confere.** Roda a análise do `prumo check` e imprime o comando do teste da story (`pnpm test:storybook <arquivo>`, que roda os dois temas; sem esse script no projeto, `pnpm exec vitest run <arquivo>`). Não roda o teste, que sobe o Chromium.

Códigos de saída: 0 quando gerou (ou, com `--dry-run`, quando simulou) e o `check` não achou violação; 1 quando gerou, mas o `check` achou violação; 2 para uso errado.

### Núcleo do codemod (interno)

`src/codemod/` tem as peças dos comandos `make:*`, uma função por operação. O `make:page` as junta (`generatePage`, em `src/codemod/generate-page.ts`) o `make:domain` (`generateDomain`, em `src/codemod/generate-domain.ts`) e o `make:component` (`generateComponent`, em `src/codemod/generate-component.ts`) também.

- **Plano de mudanças** (`ChangePlan`): um `Project` do ts-morph em memória, sem tsconfig, sem checagem de tipos e sem ler o disco por conta própria; só entram nele as cópias e os arquivos de costura. Os arquivos que não são código (JSON de mensagens, imagens) ficam numa lista à parte. Nada é escrito até o `commit()`, e o `summary()` diz o que seria criado e alterado (o `--dry-run`).
- **Nomes** (`names.ts`): valida o nome (kebab-case: minúsculas, números e hífen, começando por letra) e deriva Pascal, camel e, para domínios, singular e plural (a regra tira o `s` final; um singular explícito vale mais).
- **Cópia e renomeação**: `copyPage` copia `src/pages/<ref>/**`; `renameExports` renomeia `<Pascal>Page`, `use<Pascal>Model` e os demais exportados com o prefixo, com as referências, pelo language service; `replaceNamespace` troca o namespace do i18n; `renameStoryTitles` dá a cada story o título `Pages/<Pascal>/<último segmento>`; `replaceRoute` troca a rota e o nome da suíte nos testes (e a rota citada entre crases em textos corridos); `findReferenceRoute` acha a rota da tela de referência no `App.tsx` e `deriveRoute` monta a rota nova.
- **Domínio** (`make:domain`): `copyDomain` copia o schema, a pasta do repositório e as queries da referência; `renameDomain` renomeia os identificadores, os literais e os comentários com o nome do domínio; `registerDomain` faz as costuras nos três índices (`registerSchema`, `registerRepository` e `registerQueries`).
- **Componente** (`make:component`): `renameComponent` renomeia o componente, o tipo das props, o import e o título da story (`renameStoryTitles` com o nome do componente) e a descrição dela.
- **Costuras**: `registerMessages` (JSON nos dois idiomas e o `index.ts`, em ordem alfabética), `registerRoute` (clona o `<Route>` da referência no `App.tsx`, inclusive dentro de `nest`, e acrescenta o import) e `registerMenuItem` (item nos `subItems` de um grupo da barra lateral e o rótulo em `layout.nav.items`).

Os testes usam um app em miniatura em `src/codemod/__fixtures__/app` (fora do tsconfig, do lint e do Vitest).

O bin roda o código-fonte em TypeScript, então precisa de um Node que execute `.ts` (Node 24 ou mais novo).

**Origem no app de referência:** o roteiro de criação de tela, hoje feito à mão (`docs/patterns.md` e `AGENTS.md`), e os testes `src/architecture.test.ts` e `src/i18n/messages.test.ts`.
