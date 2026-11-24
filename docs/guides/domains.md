# Domínios de dados

Um domínio é um conjunto de dados do produto, como clientes, pedidos ou produtos. No Prumo, cada camada do domínio tem o seu comando: `make:schema` (a forma do dado), `make:repository` (de onde ele vem) e `make:query` (como a tela o lê e o grava). Este guia mostra os três, como mudar a forma do dado, o teste de contrato e o uso das queries e mutations nas telas.

## Criar um domínio

```bash
pnpm exec prumo make:schema clientes --fields "nome:string,email:string,ativo:boolean"
pnpm exec prumo make:repository clientes
pnpm exec prumo make:query clientes
```

A ordem importa, porque cada camada usa a de baixo: o repositório lê o schema, e a query usa o repositório. Se uma camada falta, o comando recusa sem criar nada e diz o que rodar (`rode prumo make:schema clientes`).

O nome é o do domínio, **no plural e em kebab-case**. A entidade é o singular, e o Prumo a deriva tirando o `s` final: `clientes` → `cliente`, `pedidos-recentes` → `pedidos-recente`. Quando a regra erra, informe a entidade com `--entity`, **nos três comandos** (o `make:repository` e o `make:query` precisam da mesma entidade do schema):

```bash
pnpm exec prumo make:schema paes --entity pao
pnpm exec prumo make:repository paes --entity pao
pnpm exec prumo make:query paes --entity pao
```

O comando recusa, em vez de adivinhar errado, os plurais terminados em `ies`, `us`, `ss`, `xes`, `ches`, `shes` e `sses` (`categories` daria `categorie`; `status` daria `statu`), e sugere o singular provável quando há um. Ele também recusa nomes que virariam palavra reservada do JavaScript (`new`, `class`, `default`) ou esconderiam um nome global (`Date`, `Record`, `Promise`).

O que cada comando cria, para `clientes`:

| Comando           | Arquivo                                                  | Conteúdo                                                                                   |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `make:schema`     | `src/schemas/entities/cliente.ts`                        | `clienteSchema`, `ClienteSchema`, `clienteInputSchema`, `ClienteInput`, `ClienteSortKey`, `ClienteListQuery` |
| `make:repository` | `src/repositories/clientes/repository.contract.ts`       | A interface `IClientesRepository`                                                          |
|                   | `src/repositories/clientes/repository.mock.ts`           | `MockClientesRepository`, a implementação em memória                                       |
|                   | `src/repositories/clientes/fixtures.ts`                  | `MOCK_CLIENTES`, os dados de exemplo                                                       |
|                   | `src/repositories/clientes/index.ts`                     | `createClientesRepository`, a fábrica que o container chama                                |
|                   | `src/repositories/clientes/repository.contract.test.ts`  | O contrato, rodado contra o mock                                                           |
| `make:query`      | `src/queries/clientes.ts`                                | `clienteKeys`, `clienteQueries` e os hooks                                                 |

Os comandos também registram o domínio: o `make:schema` em `src/schemas/index.ts`, o `make:repository` no container (`src/repositories/index.ts`) e no `errors.json` de cada idioma (o texto de `CLIENTE_NOT_FOUND`), o `make:query` em `src/queries/index.ts`. Rode os testes do repositório com `pnpm test src/repositories/clientes`. Todos aceitam `--dry-run`, que lista o que seria criado sem escrever nada.

## Os campos do domínio (`--fields`)

Só o `make:schema` recebe `--fields`. Passe os campos da entidade no formato `nome:tipo` separados por vírgula (entre aspas, por causa do `?` e das vírgulas):

```bash
pnpm exec prumo make:schema livros --fields "titulo:string,autor:string,ano:int,disponivel:boolean,publicadoEm:date,situacao:enum(lido|lendo|desejado),apelido?:string"
```

Sem `--fields`, a entidade tem um campo de texto, `name`.

| Tipo       | No schema (zod)        | Exemplo de valor                |
| ---------- | ---------------------- | ------------------------------- |
| `string`   | `z.string()`           | `'Titulo 1'`                    |
| `number`   | `z.number()`           | `10`                            |
| `int`      | `z.number().int()`     | `10`, `20`, `30`                |
| `boolean`  | `z.boolean()`          | `true`                          |
| `date`     | `z.iso.date()`         | `'2026-01-05'` (`AAAA-MM-DD`)   |
| `datetime` | `z.iso.datetime()`     | `'2026-01-05T12:00:00.000Z'`    |
| `enum(a\|b\|c)` | `z.enum(['a', 'b', 'c'])` | `'a'`, `'b'`, `'c'`      |

O enum leva os valores entre parênteses, separados por `|` (no mínimo dois, sem repetir, cada um com letras, números e `_`, começando por letra), por exemplo `status:enum(ativo|inativo|pendente)`. Por isso a lista vai entre aspas, como no exemplo acima.

O nome do campo é camelCase (começa com letra minúscula; só letras e números). Um `?` depois do nome torna o campo opcional (`apelido?:string` vira `z.string().optional()`). O comando recusa, sem escrever nada, `id` e `createdAt` (o repositório já os dá a todo registro), nomes repetidos, tipos desconhecidos e listas mal formadas.

### O leitor de campos

O `make:repository` não tem `--fields`: ele **lê os campos do schema** que o `make:schema` gerou, com o ts-morph, e a partir deles gera, coerentes entre si:

- **as fixtures**: três registros com valores de exemplo por tipo (texto `Titulo 1`, número `10`, `20`, `30`, booleano alternado, datas crescentes, os valores do enum na ordem);
- **o mock**: a busca nos campos de texto (sem campo de texto, no `id`), a ordem por cada campo da `<Entidade>SortKey`, e `create` e `update` com os campos do `pick` do schema de entrada;
- **o teste de contrato**: busca, ordem, criação e edição usam os campos lidos.

Isso significa que o schema pode ser **editado à mão** antes do `make:repository`, dentro do que o leitor entende:

- `id` e `createdAt` como `z.string()`, e campos em camelCase sem aspas;
- os tipos da tabela acima, na forma em que o `--fields` os escreve (o enum pode ocupar várias linhas e ter vírgula no fim);
- o `<entidade>InputSchema` escrito com `.pick({ campo: true, ... })` (um campo que o backend calcula fica de fora do `pick` e recebe um valor de exemplo no mock; `.omit(...)` não é lido);
- a `<Entidade>SortKey` como a união de nomes de campo (sem campo booleano).

Um campo que o leitor não reconhece, como `z.string().min(3)` ou `z.email()`, é **erro de uso**, com o arquivo, a linha e o nome do campo, e nada é criado. Para validar mais do que o tipo, gere o schema com o tipo simples, rode os três comandos e só então acrescente o `.min(3)` ou o `z.email()` ao schema (veja [Mudar a forma do dado](#mudar-a-forma-do-dado)). O `make:query` não lê os campos, e o `make:page --query` só procura um campo de texto para mostrar (se não o acha, a tela mostra o `id` e o comando avisa).

Com muitos campos, o `pick` do schema de entrada, a busca do mock e a entrada do teste de contrato saem quebrados em várias linhas quando passam de cerca de 100 colunas. O gerador não formata o resto do código: rode o formatador do projeto, se tiver um.

Os textos de exemplo das fixtures são genéricos: troque pelos dados do seu produto. O contrato continua verde enquanto as fixtures e o contrato andam juntos (veja abaixo).

## Fontes de dados

O `make:repository` cria o repositório com a fonte `mock`, a padrão e a dos testes. A opção `--data-source` acrescenta outra implementação do mesmo contrato:

```bash
pnpm exec prumo make:repository clientes --data-source http      # fetch na API
pnpm exec prumo make:repository clientes --data-source storage   # o mock gravando no localStorage
```

| Fonte     | Para quê                                                                                     |
| --------- | -------------------------------------------------------------------------------------------- |
| `mock`    | Construir e testar as telas antes de a API existir (em memória, com latência simulada)       |
| `storage` | Uma demonstração que lembra os dados entre recargas, sem backend (`localStorage`)            |
| `http`    | A API de verdade: o backend responde no formato do app e o repositório só valida a resposta  |

Se o repositório já existe, o comando acrescenta só a fonte; se não existe, cria o repositório completo e a fonte. O app escolhe a fonte pela variável `VITE_DATA_SOURCE` (`mock` quando falta), e as telas não sabem qual é. O guia [Ligar uma API real](real-api.md) mostra o `.env`, o token e o contrato contra uma API de teste.

## O contrato

O contrato é a interface que **qualquer** implementação do repositório cumpre, a em memória hoje e a HTTP amanhã:

```ts
export interface IClientesRepository {
  list(query?: ClienteListQuery): Promise<Page<ClienteSchema>>
  /** Rejeita com `UIError('CLIENTE_NOT_FOUND')` quando o id não existe. */
  get(id: string): Promise<ClienteSchema>
  create(input: ClienteInput): Promise<ClienteSchema>
  /** Muda só os campos enviados e devolve o registro inteiro. Rejeita com `UIError('CLIENTE_NOT_FOUND')` quando o id não existe. */
  update(id: string, input: Partial<ClienteInput>): Promise<ClienteSchema>
  /** Rejeita com `UIError('CLIENTE_NOT_FOUND')` quando o id não existe. */
  remove(id: string): Promise<void>
}
```

- `list` aceita busca (`search`, sem diferenciar maiúsculas e acentos), ordem (`sort: { key, direction }`) e página (`page`, a partir de 1, e `page_size`). Devolve `{ items, total }`, em que `total` conta todos os itens que casam com a busca, antes de paginar. Sem `page_size`, devolve tudo.
- `update` é **parcial**: muda só os campos enviados e mantém os outros (um `PATCH`, na API real). Para mudar um ou dois campos (devolver, cancelar, quitar), envie só eles: `update.mutate({ id, input: { status: 'cancelado' } })`. Não há um método `patch` à parte.
- Um registro que não existe é um `UIError` com o código `<ENTIDADE>_NOT_FOUND`, que a interface traduz (veja [Erros e notificações](errors-and-notifications.md)).

O **teste de contrato** (`repository.contract.test.ts`) descreve esse comportamento uma vez, com o `defineContractSuite` do `@matizze/prumo-testing`, e o roda contra cada implementação com o `runContractSuite`. Hoje, contra o mock:

```ts
const clientesContract = defineContractSuite<IClientesRepository>(
  'IClientesRepository contract',
  ({ repo }) => {
    it('busca pelo nome, sem diferenciar maiúsculas e acentos', async () => {
      const { items } = await repo.list({ search: 'EXEMPLO 2' })
      expect(items.map((item) => item.name)).toEqual(['Exemplo 2'])
    })
    // ...
  },
)

runContractSuite(clientesContract, {
  name: 'MockClientesRepository',
  create: () => new MockClientesRepository({ latencyMs: 0 }),
})
```

Cada teste recebe uma instância nova do repositório, então um teste que cria ou remove registros não afeta o seguinte. Quando a implementação HTTP existir, ela roda o mesmo contrato (veja [Ligar uma API real](real-api.md#5-rode-o-contrato-contra-uma-api-de-teste)).

## Mudar a forma do dado

O caminho principal é pedir os campos na criação, com `--fields` no `make:schema` (seção anterior). Esta seção vale para mudar a forma **depois** de gerar o repositório: o domínio nasceu sem `--fields` (só com `id`, `name` e `createdAt`), ou o produto ganhou um campo. Os comandos não regeneram nada (nunca sobrescrevem arquivo), então a mudança é à mão: comece pelo schema e deixe o TypeScript apontar o resto.

**1. O schema e a entrada:**

```ts
// src/schemas/entities/cliente.ts
export const clienteSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  createdAt: z.string(),
})

/** O que se envia para criar ou editar: o `id` e a data são do repositório. */
export const clienteInputSchema = clienteSchema.pick({ name: true, email: true })
```

**2. As fixtures:**

```ts
// src/repositories/clientes/fixtures.ts
export const MOCK_CLIENTES: ClienteSchema[] = [
  { id: 'cliente-1', name: 'Ana Souza', email: 'ana@exemplo.com', createdAt: '2026-01-05T12:00:00.000Z' },
  // ...
]
```

**3. O mock**, que monta o registro a partir da entrada:

```ts
// src/repositories/clientes/repository.mock.ts
const item: ClienteSchema = {
  id: `cliente-${this.sequence}`,
  ...input,
  createdAt: new Date().toISOString(),
}
// e no update:
const updated = { ...item, ...input }
```

**4. O contrato:** `pnpm typecheck` aponta as chamadas de `create` que agora precisam do `email` (o `update` é parcial e não reclama). Se você trocou os nomes das fixtures, ajuste também os casos que dependem deles (a busca por `'EXEMPLO 2'` e a ordem esperada). **As fixtures e o contrato andam juntos.**

**5. A busca e a ordem do `list`**, no mock, que hoje supõem o `name`:

```ts
// src/repositories/clientes/repository.mock.ts
const filtered = this.items.filter((item) => matchesSearch([item.name, item.email], query.search))
const sorted = sortBy(filtered, query.sort, {
  name: (item) => item.name,
  email: (item) => item.email, // a chave nova também entra em ClienteSortKey
  createdAt: (item) => item.createdAt,
})
```

Se quiser buscar ou ordenar pelo campo novo, acrescente-o nessas duas listas e a chave em `ClienteSortKey`.

### Onde o `name` aparece

Em um domínio criado sem `--fields`, trocar ou tirar o `name` (em vez de só acrescentar campos) mexe em todos estes lugares, e o `tsc` nem sempre acusa todos (um domínio criado com `--fields` já nasce sem eles):

| Onde                                                                        | O que o cita                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/schemas/entities/cliente.ts`                                           | `clienteSchema` e o `pick` do `clienteInputSchema`                  |
| `src/repositories/clientes/fixtures.ts`                                     | o `name` de cada fixture                                            |
| `repository.mock.ts`, `create`                                              | `name: input.name`, se você não usa `...input`                      |
| `repository.mock.ts`, `list`                                                | a busca (`matchesSearch([item.name], ...)`) e o acessor `name` do `sortBy` |
| `repository.contract.test.ts`                                               | a busca por `'EXEMPLO 2'`, a ordem esperada, o `name` do `create` e do `update` |
| `src/pages/<tela>/view.tsx`, das telas geradas com `--query`               | `item.name` na lista (e no detalhe, se a tela é de detalhe)         |
| `src/pages/<tela>/index.test.tsx`, das telas de detalhe geradas com `--query`  | o texto `Exemplo 1`, que é o `name` da primeira fixture              |
| `src/queries/clientes.ts`                                                   | `ClienteListQuery` e `ClienteSortKey`, se citam o campo             |

O `pnpm verify` (com o `typecheck` e os testes) mostra o que sobrou.

Rode `pnpm verify`. **Só campo acrescentado** deixa as telas que usam o domínio compilando, e as que precisam do campo novo o recebem já tipado. Trocar ou tirar um campo quebra o que o citava: as views geradas com `--query` (`item.name`), por exemplo.

## Filtros na consulta da lista

A consulta (`ClienteListQuery`) vem com `search`, `sort`, `page` e `page_size`. Um domínio sem texto para buscar (empréstimos, reservas) precisa de outros filtros, e o caminho é sempre o mesmo, de baixo para cima:

**1. O campo na consulta**, em `src/schemas/entities/cliente.ts`:

```ts
export interface ClienteListQuery extends PageQuery {
  /** Busca pelo nome, sem diferenciar maiúsculas e acentos. */
  search?: string
  status?: 'ativo' | 'inativo' // novo
  sort?: Sort<ClienteSortKey>
}
```

**2. O filtro no mock**, antes de ordenar e paginar:

```ts
const filtered = this.items
  .filter((item) => matchesSearch([item.name], query.search))
  .filter((item) => !query.status || item.status === query.status)
```

Se o domínio não tem texto, tire a linha da busca (e o `search` da consulta) em vez de deixá-la sem efeito.

**3. O caso no contrato**, que a implementação HTTP também vai cumprir:

```ts
it('filtra pelo status', async () => {
  const { items, total } = await repo.list({ status: 'ativo' })
  expect(total).toBe(2)
  expect(items.every((item) => item.status === 'ativo')).toBe(true)
})
```

A query key já leva a consulta inteira (`['list', query]`), então o filtro novo entra na chave e na busca sem mais nada. Na API real, o campo vira um parâmetro da URL no `list` do repositório HTTP (veja [Ligar uma API real](real-api.md)).

### Consultas que dependem de "hoje"

Uma consulta como "atrasados" ou "vencem esta semana" depende da data de hoje, e um mock que chama `new Date()` dá um resultado que muda com o dia, o que quebra o teste de contrato. Passe a data **na consulta**, e o mock e o contrato ficam determinísticos:

```ts
// no ClienteListQuery
today?: string // data ISO (yyyy-mm-dd); o chamador informa

// no mock
.filter((item) => !query.today || item.dueDate < query.today)

// no contrato, com as datas das fixtures
const { items } = await repo.list({ today: '2026-03-01' })
expect(items.map((item) => item.id)).toEqual(['cliente-2'])
```

A tela passa a data de verdade (`today: new Date().toISOString().slice(0, 10)`); o teste, uma data fixa. Para somar dias a uma data no mock e nas fixtures, há o `addDays` do `@matizze/prumo-core/mock`, e para formatar a data sem erro de fuso, o `@matizze/prumo-core/date`.

## Queries

`src/queries/clientes.ts` tem três camadas, da mais baixa para a mais alta.

**As query keys**, criadas pelo `createQueryKeys` do core. Toda chave começa pelo nome do domínio:

```ts
export const clienteKeys = createQueryKeys('clientes', {
  list: (query: ClienteListQuery = {}) => ['list', query] as const,
  detail: (id: string) => ['detail', id] as const,
})

clienteKeys.all            // ['clientes']: invalida o domínio inteiro
clienteKeys.list({})       // ['clientes', 'list', {}]
clienteKeys.detail('42')   // ['clientes', 'detail', '42']
```

**As queries** (`clienteQueries`), objetos `queryOptions` que recebem o repositório. Servem para usar fora de um hook, como num prefetch:

```ts
await queryClient.prefetchQuery(clienteQueries.detail(repositories.clientes, id))
```

**Os hooks**, que as telas usam:

| Hook                      | O que faz                                                                     |
| ------------------------- | ----------------------------------------------------------------------------- |
| `useClientesList(query?, options?)` | A lista, com busca, ordem, página e filtros; `options` vai para o `useQuery` |
| `useClienteDetail(id)`    | Um registro                                                                   |
| `useCreateCliente()`      | Mutation de criar; recebe um `ClienteInput`                                   |
| `useUpdateCliente()`      | Mutation de editar; recebe `{ id, input }`, com `input` parcial               |
| `useRemoveCliente()`      | Mutation de remover; recebe o `id`                                            |

**A lista mantém os dados anteriores** enquanto uma consulta nova carrega (`placeholderData: keepPreviousData`): ao buscar, filtrar ou paginar, `list.isPending` só é `true` na primeira carga, e a tela não volta para "Carregando…". `list.isPlaceholderData` diz que o que aparece ainda é o da consulta anterior (use para esmaecer a lista ou desligar o botão da página). O segundo parâmetro aceita as opções do `useQuery` (`enabled`, `staleTime`, `select`...) e vale mais que o padrão:

```ts
const list = useClientesList({ search }, { enabled: search.length >= 3 })
```

Para voltar ao carregando a cada consulta, tire a linha `placeholderData` do hook gerado.

**As mutations** atualizam o cache ao terminar:

- `useCreateCliente` e `useUpdateCliente` invalidam `clienteKeys.all`: as listas e os detalhes do domínio se atualizam sozinhos.
- `useRemoveCliente` tira do cache o detalhe do registro removido (`removeQueries`) e invalida só as listas (`clienteKeys.lists`). Invalidar tudo faria o detalhe aberto do registro removido ser buscado de novo, falhar com `CLIENTE_NOT_FOUND` e virar uma notificação de erro.

`useUpdateCliente` recebe `{ id, input }` com `input` parcial (só o que mudou).

Os hooks pegam o repositório de `useRepositories()`, nunca de um import. É isso que permite ao teste e à configuração de ambiente trocar a implementação sem mudar a tela.

### Usar numa tela

```ts
// src/pages/clientes/model.ts
const list = useClientesList({ search, sort: { key: 'name', direction: 'asc' }, page, page_size: 20 })
const create = useCreateCliente()

return {
  items: list.data?.items ?? [],
  total: list.data?.total ?? 0,
  loading: list.isPending,
  onCreate: (input: ClienteInput) => create.mutate(input),
  creating: create.isPending,
}
```

### Uma consulta nova

Para uma operação que o CRUD não cobre (por exemplo, `listByCity`), siga as camadas de baixo para cima:

1. Acrescente o método ao **contrato** (`IClientesRepository`).
2. Implemente no **mock** e escreva o caso no **teste de contrato**.
3. Crie a **chave** (`byCity: (city: string) => ['by-city', city] as const`), a **query** e o **hook** em `src/queries/clientes.ts`.
4. Exporte o hook em `src/queries/index.ts`, se quiser usá-lo pelo índice.

## Regras de negócio e operações entre domínios

O CRUD de um domínio não sabe de regra: "um cliente pode ter no máximo 3 pedidos em aberto" e "cancelar um pedido devolve o item ao estoque" não são `list` nem `create`. O Prumo não gera nem cobra um lugar para elas; a convenção que funciona tem três peças, de baixo para cima.

**1. Regras como funções puras, em `src/rules/`.** Recebem os dados (e "hoje") como argumento e devolvem uma decisão: nada de hook, repositório, `new Date()` nem `fetch`. Por serem puras, o teste é uma chamada de função:

```ts
// src/rules/pedido.ts
import { daysBetween } from '@matizze/prumo-core/date'
import type { PedidoSchema } from '@/schemas'

/** Códigos estáveis de recusa: cada um tem texto em `errors.<CODE>` nos dois idiomas. */
export type CodigoDeRecusa = 'PEDIDO_LIMITE_ATINGIDO' | 'CLIENTE_COM_ATRASO'

export const LIMITE_DE_PEDIDOS_EM_ABERTO = 3

/** Devolve o código da recusa, ou `null` quando o cliente pode fazer um pedido novo. */
export function verificarPedido(emAberto: PedidoSchema[], hoje: string): CodigoDeRecusa | null {
  if (emAberto.some((pedido) => daysBetween(pedido.vencimento, hoje) > 0)) return 'CLIENTE_COM_ATRASO'
  if (emAberto.length >= LIMITE_DE_PEDIDOS_EM_ABERTO) return 'PEDIDO_LIMITE_ATINGIDO'
  return null
}
```

```ts
// src/rules/pedido.test.ts
it('recusa o quarto pedido em aberto', () => {
  const emAberto = [pedido('1'), pedido('2'), pedido('3')]
  expect(verificarPedido(emAberto, '2026-11-22')).toBe('PEDIDO_LIMITE_ATINGIDO')
})
```

Para onde "hoje" vem, veja [Consultas que dependem de "hoje"](#consultas-que-dependem-de-hoje): a regra recebe a data, e quem chama decide se é a de verdade ou uma fixa do teste. Os valores que o texto da recusa precisa (o limite) vão nos `params` do `UIError`.

**2. Operações entre domínios como mutations em `src/queries/<nome>.ts`.** Uma operação que lê ou grava em mais de um domínio (fazer um pedido olha pedidos e clientes; cancelar mexe em pedidos e estoque) não pertence à `queries/<domínio>.ts` de nenhum deles. Ela ganha um arquivo próprio, que **pega os repositórios do container**, aplica as regras e **invalida os domínios afetados**:

```ts
// src/queries/vendas.ts
import { UIError } from '@matizze/prumo-core/errors'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/providers/repository'
import type { RepositoryContainer } from '@/repositories'
import { verificarPedido, LIMITE_DE_PEDIDOS_EM_ABERTO } from '@/rules'
import { clienteKeys } from './clientes'
import { pedidoKeys } from './pedidos'

type Repositorios = Pick<RepositoryContainer, 'clientes' | 'pedidos'>

export interface FazerPedidoInput {
  clienteId: string
  produto: string
  /** O dia de hoje (`AAAA-MM-DD`); sem ele, vale o dia da máquina. */
  hoje?: string
}

/** A operação em si, sem React: recebe os repositórios, então o teste não precisa de provedor. */
export async function fazerPedido(repositorios: Repositorios, input: FazerPedidoInput) {
  const hoje = input.hoje ?? new Date().toISOString().slice(0, 10)
  await repositorios.clientes.get(input.clienteId) // CLIENTE_NOT_FOUND, se não existir
  const { items } = await repositorios.pedidos.list({ clienteId: input.clienteId, emAberto: true })

  const recusa = verificarPedido(items, hoje)
  if (recusa) throw new UIError(recusa, 'Pedido recusado.', { limite: LIMITE_DE_PEDIDOS_EM_ABERTO })

  return repositorios.pedidos.create({ clienteId: input.clienteId, produto: input.produto, criadoEm: hoje })
}

/** O hook: pega os repositórios do container e invalida o que a operação mexeu. */
export function useFazerPedido() {
  const repositories = useRepositories()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: FazerPedidoInput) => fazerPedido(repositories, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pedidoKeys.all })
      void queryClient.invalidateQueries({ queryKey: clienteKeys.all })
    },
  })
}
```

A recusa é um `UIError` com código, como qualquer erro de domínio (veja [Erros e notificações](errors-and-notifications.md)): a mutation falha, o `createQueryClient` notifica o texto traduzido e a tela pode mostrá-lo no formulário. O texto leva o valor: `"PEDIDO_LIMITE_ATINGIDO": "Você já tem {limite} pedidos em aberto"`. Os repositórios continuam sem saber de regra: só leem e gravam.

**3. O model liga e desliga as ações com as mesmas regras.** A tela não precisa tentar a operação para saber que ela vai ser recusada: o model chama a regra e mostra o motivo, traduzido pelo `getErrorMessage`, que aceita o código solto:

```ts
// src/pages/cliente/model.ts
const t = useTranslations('cliente')
const pedidos = usePedidosList({ clienteId: id, emAberto: true })
const fazerPedido = useFazerPedido()

const recusa = verificarPedido(pedidos.data?.items ?? [], new Date().toISOString().slice(0, 10))

return {
  canOrder: recusa === null,
  // o motivo do botão desligado, no idioma ativo e com o limite no texto
  orderBlockedReason: recusa ? getErrorMessage(recusa, { limite: LIMITE_DE_PEDIDOS_EM_ABERTO }) : undefined,
  onOrder: (produto: string) => fazerPedido.mutate({ clienteId: id, produto }),
}
```

A regra roda duas vezes, na tela (para o botão) e na operação (para valer de verdade), e é a **mesma função**: por isso a regra mora fora dos dois. Se a API também confere a regra, a conferência do servidor é a que protege os dados; a do app é conveniência.

**Os testes.** A regra, sem React. A operação, com os repositórios em memória (`fazerPedido(createRepositories(), { ... })` ou os do `renderHookWithProviders`), conferindo a recusa e o efeito nos dois domínios:

```ts
it('recusa o pedido e não grava nada', async () => {
  const repositorios = createRepositories({ latencyMs: 0 })
  // ... deixa o cliente com 3 pedidos em aberto

  await expect(
    fazerPedido(repositorios, { clienteId: 'cliente-1', produto: 'Caneta', hoje: '2026-11-22' }),
  ).rejects.toMatchObject({ code: 'PEDIDO_LIMITE_ATINGIDO' })
})
```

O `prumo check` e o ESLint não olham `src/rules` (a pasta é livre), nem a regra de camadas se aplica a ela: o único cuidado é manter as regras puras, sem importar de `@/queries` nem de `@/pages`. Nenhum comando do Prumo mexe nessas pastas.

## Validar a entrada

O `clienteInputSchema` é um schema zod. Use-o no model para validar um formulário antes de chamar a mutation:

```ts
import { z } from 'zod'

const result = clienteInputSchema.safeParse({ name, email })
if (!result.success) return setErrors(z.flattenError(result.error).fieldErrors)
create.mutate(result.data)
```

Para que as mensagens de validação saiam traduzidas, escreva-as como chaves de texto (`z.string().min(1, 'validation.required')`) e use o `useFieldError` do i18n (veja [Textos e idiomas](i18n.md#mensagens-de-validação)).

## Apagar um domínio

1. Apague `src/repositories/<domínio>/`, `src/queries/<domínio>.ts` e `src/schemas/entities/<entidade>.ts`.
2. Tire o import, o `export *` e a entrada do mapa `factories` em `src/repositories/index.ts`.
3. Tire as linhas do domínio em `src/schemas/index.ts` e `src/queries/index.ts`.
4. Tire as telas que o usam (`src/pages/<tela>` e a rota em `src/App.tsx`) e o texto `<ENTIDADE>_NOT_FOUND` dos `errors.json`.
5. Rode `pnpm verify`: o `tsc` aponta o que ainda usa o domínio.
