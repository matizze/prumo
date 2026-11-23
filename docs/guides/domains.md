# Domínios de dados

Um domínio é um conjunto de dados do produto, como clientes, pedidos ou produtos. Este guia mostra como criar um domínio, mudar a forma do dado, entender o teste de contrato e usar as queries e mutations nas telas.

## Criar um domínio

```bash
pnpm exec prumo make:domain clientes
```

O nome é o do domínio, **no plural e em kebab-case**. A entidade é o singular, e o Prumo a deriva tirando o `s` final: `clientes` → `cliente`, `pedidos-recentes` → `pedidos-recente`. Quando a regra erra, informe a entidade com `--entity`:

```bash
pnpm exec prumo make:domain categories --entity category
pnpm exec prumo make:domain pedidos-recentes --entity pedido-recente
```

O comando recusa, em vez de adivinhar errado, os plurais terminados em `ies`, `us`, `ss`, `xes`, `ches`, `shes` e `sses` (`categories` daria `categorie`; `status` daria `statu`), e sugere o singular provável quando há um. Ele também recusa nomes que virariam palavra reservada do JavaScript (`new`, `class`, `default`) ou esconderiam um nome global (`Date`, `Record`, `Promise`).

O que é criado, para `clientes`:

| Arquivo                                                  | Conteúdo                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/schemas/entities/cliente.ts`                        | `clienteSchema`, `ClienteSchema`, `clienteInputSchema`, `ClienteInput`, `ClienteListQuery` |
| `src/repositories/clientes/repository.contract.ts`       | A interface `IClientesRepository`                                                         |
| `src/repositories/clientes/repository.mock.ts`           | `MockClientesRepository`, a implementação em memória                                      |
| `src/repositories/clientes/fixtures.ts`                  | `MOCK_CLIENTES`, os dados de exemplo                                                      |
| `src/repositories/clientes/index.ts`                     | `createClientesRepository`, a fábrica que o container chama                               |
| `src/repositories/clientes/repository.contract.test.ts`  | O contrato, rodado contra o mock                                                          |
| `src/queries/clientes.ts`                                | `clienteKeys`, `clienteQueries` e os hooks                                                |

E registra o domínio em `src/schemas/index.ts`, `src/queries/index.ts` e no container (`src/repositories/index.ts`). Rode os testes dele com `pnpm test src/repositories/clientes`.

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

Cada teste recebe uma instância nova do repositório, então um teste que cria ou remove registros não afeta o seguinte. Quando a implementação HTTP existir, ela roda o mesmo contrato (veja [Ligar uma API real](real-api.md#6-rode-o-contrato-contra-a-api)).

## Mudar a forma do dado

O domínio nasce com `id`, `name` e `createdAt`. Para acrescentar um campo, comece pelo schema e deixe o TypeScript apontar o resto.

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

Trocar ou tirar o `name` (em vez de só acrescentar campos) mexe em todos estes lugares, e o `tsc` nem sempre acusa todos:

| Onde                                                                        | O que o cita                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/schemas/entities/cliente.ts`                                           | `clienteSchema` e o `pick` do `clienteInputSchema`                  |
| `src/repositories/clientes/fixtures.ts`                                     | o `name` de cada fixture                                            |
| `repository.mock.ts`, `create`                                              | `name: input.name`, se você não usa `...input`                      |
| `repository.mock.ts`, `list`                                                | a busca (`matchesSearch([item.name], ...)`) e o acessor `name` do `sortBy` |
| `repository.contract.test.ts`                                               | a busca por `'EXEMPLO 2'`, a ordem esperada, o `name` do `create` e do `update` |
| `src/pages/<tela>/view.tsx`, das telas geradas com `--domain`               | `item.name` na lista (e no detalhe, se a tela é de detalhe)         |
| `src/pages/<tela>/index.test.tsx`, das telas de detalhe geradas com `--domain`  | o texto `Exemplo 1`, que é o `name` da primeira fixture              |
| `src/queries/clientes.ts`                                                   | `ClienteListQuery` e `ClienteSortKey`, se citam o campo             |

O `pnpm verify` (com o `typecheck` e os testes) mostra o que sobrou.

Rode `pnpm verify`. **Só campo acrescentado** deixa as telas que usam o domínio compilando, e as que precisam do campo novo o recebem já tipado. Trocar ou tirar um campo quebra o que o citava: as views geradas com `--domain` (`item.name`), por exemplo.

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
4. Rode `pnpm verify`: o `tsc` aponta o que ainda usa o domínio.
