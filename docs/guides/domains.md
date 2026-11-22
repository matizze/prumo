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
  /** Rejeita com `UIError('CLIENTE_NOT_FOUND')` quando o id não existe. */
  update(id: string, input: ClienteInput): Promise<ClienteSchema>
  /** Rejeita com `UIError('CLIENTE_NOT_FOUND')` quando o id não existe. */
  remove(id: string): Promise<void>
}
```

- `list` aceita busca (`search`, sem diferenciar maiúsculas e acentos), ordem (`sort: { key, direction }`) e página (`page`, a partir de 1, e `page_size`). Devolve `{ items, total }`, em que `total` conta todos os itens que casam com a busca, antes de paginar. Sem `page_size`, devolve tudo.
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

**4. O contrato:** `pnpm typecheck` aponta as chamadas de `create` e `update` que agora precisam do `email`. Se você trocou os nomes das fixtures, ajuste também os casos que dependem deles (a busca por `'EXEMPLO 2'` e a ordem esperada). **As fixtures e o contrato andam juntos.**

**5.** Se quiser ordenar pelo campo novo, acrescente a chave em `ClienteSortKey` e o acessor no `sortBy` do mock.

Rode `pnpm verify`. Telas que usam o domínio continuam compilando, e as que precisam do campo novo o recebem já tipado.

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
| `useClientesList(query?)` | A lista, com busca, ordem e página                                            |
| `useClienteDetail(id)`    | Um registro                                                                   |
| `useCreateCliente()`      | Mutation de criar; recebe um `ClienteInput`                                   |
| `useUpdateCliente()`      | Mutation de editar; recebe `{ id, input }`                                    |
| `useRemoveCliente()`      | Mutation de remover; recebe o `id`                                            |

As três mutations invalidam `clienteKeys.all` ao terminar, então as listas e os detalhes do domínio se atualizam sozinhos.

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
