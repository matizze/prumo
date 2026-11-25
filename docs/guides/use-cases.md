# Use cases

Um **use case** é uma ação que o app faz com dados, com nome de verbo: `getStores`, `signIn`, `addItem`. Ele tem um **Input** e um **Output** (os dois são schemas zod) e um **`execute`**. É o único caminho do dado até a tela: a tela chama o use case, e o use case fala com a API (ou com o navegador, ou com outros use cases). O [porquê das camadas](../concepts/architecture.md#as-camadas-em-dois-minutos) está na arquitetura; este guia mostra como criar use cases, escolher os campos, mudar a forma do dado, filtrar a lista, guardar regras de negócio e apagar um domínio. Quem vem de um app com `make:repository` e `make:query` encontra o caminho em [Migrar para use cases](migrate-to-use-cases.md).

São duas camadas de dados, cada uma com o seu comando: `make:schema` (a **entidade**, a forma do dado, usada por vários use cases) e `make:usecase` (a **ação**, o que o app faz com ele).

## Um use case de cada vez

O nome é `<domínio>.<ação>`, em kebab-case: o domínio dá a pasta (`src/use-cases/auth/`), e a ação dá a classe (`SignInUseCase`) e a chave no registro (`signIn`, o que a tela lê de `useUseCases()`). As chaves são únicas no app, e o comando recusa uma repetida.

O verbo decide se é **leitura** (`get`, `list`, `search`, `find`, `check` e `count`: a tela usa com `useQuery`) ou **escrita** (o resto: `useMutation`); `--read` e `--write` forçam o tipo. Uma entrada de login:

```bash
pnpm exec prumo make:usecase auth.sign-in --input "email:string,password:string" --output "token:string"
```

```text
prumo make:usecase: auth.sign-in (escrita, POST /auth/sign-in).

Criados (5):
  src/use-cases/auth/index.ts
  src/use-cases/auth/sign-in.mock.ts
  src/use-cases/auth/sign-in.types.ts
  src/use-cases/auth/sign-in.usecase.test.ts
  src/use-cases/auth/sign-in.usecase.ts

Alterados (3):
  src/messages/en/errors.json
  src/messages/pt-BR/errors.json
  src/use-cases/index.ts

Próximo passo: no model da tela, const { signIn } = useUseCases() e useMutation({ mutationFn: (input) => signIn.execute(input) }).
```

| Opção                  | O que faz                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `--input <campos>`     | Os campos do Input (`"email:string,password:string"`, a mesma sintaxe do [`--fields`](#os-campos-do-schema---fields))           |
| `--output <campos>`    | Os campos do Output, ou o nome de uma entidade que já tem schema: `--output cliente`, ou `--output cliente[]` para a lista     |
| `--endpoint "<MÉTODO> <caminho>"` | O endereço da API (`"PATCH /livros/:id"`; cada `:parâmetro` sai do campo do Input de mesmo nome). Padrão: `GET /<domínio>/<ação>` na leitura e `POST /<domínio>/<ação>` na escrita |
| `--local`              | Um use case sem API, que usa o `storage` do navegador                                                                           |
| `--crud`               | Os cinco use cases de uma entidade, de uma vez ([abaixo](#criar-um-domínio-com-crud))                                           |

Sem `--input` e `--output`, o Input é um objeto vazio e o Output é `z.unknown()`, e o comando avisa para você preencher o `.types.ts`. Todas as opções estão na [referência](../reference/cli.md#prumo-makeusecase).

### O que sai de um use case

Cada ação tem quatro arquivos, um ao lado do outro:

```text
src/use-cases/auth/
  index.ts                 createAuthUseCases(deps) e as rotas de mock do domínio
  sign-in.types.ts         ENDPOINT, SignInInput e SignInOutput (e, na leitura, a chave de cache)
  sign-in.usecase.ts       SignInUseCase
  sign-in.mock.ts          a rota de mock do ENDPOINT
  sign-in.usecase.test.ts  o teste, contra o mock e, com API_TEST_URL, contra a API
```

O `execute` valida o Input com zod, chama o `http` no `ENDPOINT` e valida a resposta com o Output; um erro da API vira um `UIError` com código (`SIGN_IN_FAILED`), cujo texto o comando já põe nos `errors.json` dos dois idiomas. O `.mock.ts` devolve uma resposta de exemplo no formato do Output, e é ele que responde enquanto a API não existe:

```ts
// src/use-cases/auth/sign-in.mock.ts
export const signInRoutes = {
  [`${ENDPOINT.method} ${ENDPOINT.path}` as const]: (): SignInOutput => ({ token: 'Token 1' }),
}
```

O mock **não** é uma implementação à parte: o use case de verdade roda sobre um `http` de mentira (`createMockHttp`, do core). Com `VITE_DATA_SOURCE=http`, o mesmo código roda sobre a API ([Ligar uma API real](real-api.md)).

### Um use case sem API (`--local`)

Para dados que moram só no navegador, como o carrinho de uma loja:

```bash
pnpm exec prumo make:usecase cart.add-item --local --input "productId:string,quantity:int"
```

A classe recebe o `storage` (o `localStorage`, que o registro passa em `deps`), não tem `ENDPOINT`, mock nem erro de API, e o teste roda com o `localStorage` do jsdom. O `execute` guarda o Input no `storage` como exemplo, com o lugar da sua regra marcado num comentário:

```ts
// src/use-cases/cart/add-item.usecase.ts
export class AddItemUseCase implements IUseCase<AddItemInput, AddItemOutput> {
  readonly #storage: Storage

  constructor(storage: Storage) {
    this.#storage = storage
  }

  async execute(input: AddItemInput): Promise<AddItemOutput> {
    const parsed = AddItemInput.parse(input)
    // A regra do use case entra aqui. O exemplo guarda o Input no localStorage.
    this.#storage.setItem(STORAGE_KEY, JSON.stringify(parsed))
    // Troque o resultado de exemplo pelo que a regra calcula.
    return AddItemOutput.parse({})
  }
}
```

### Usar o use case na tela

O model pega o use case de `useUseCases()` e o liga ao TanStack Query: `useQuery` para leitura (a chave de cache é a `<ação>Key(input)` do `.types.ts`, com o domínio no prefixo) e `useMutation` para escrita. Uma escrita invalida o prefixo do domínio (`['livros']`) no `onSuccess`, e as listas e os detalhes se atualizam sozinhos. O `make:page --usecase` já gera o model assim: veja [Telas](pages.md#telas-a-partir-de-um-use-case).

## Criar um domínio com CRUD

```bash
pnpm exec prumo make:schema clientes --fields "nome:string,email:string,ativo:boolean"
pnpm exec prumo make:usecase clientes --crud
```

A ordem importa, porque o use case usa o schema: os campos dos testes e do mock saem dele. Se o schema falta, o comando recusa sem criar nada e diz o que rodar (`rode prumo make:schema clientes`).

O nome é o do domínio, **no plural e em kebab-case**. A entidade é o singular, e o Prumo a deriva tirando o `s` final: `clientes` → `cliente`, `pedidos-recentes` → `pedidos-recente`. Quando a regra erra, informe a entidade com `--entity`, **nos dois comandos**:

```bash
pnpm exec prumo make:schema paes --entity pao
pnpm exec prumo make:usecase paes --crud --entity pao
```

O comando recusa, em vez de adivinhar errado, os plurais terminados em `ies`, `us`, `ss`, `xes`, `ches`, `shes` e `sses` (`categories` daria `categorie`; `status` daria `statu`), e sugere o singular provável quando há um. Ele também recusa nomes que virariam palavra reservada ou nome global.

O que cada comando cria, para `clientes`:

| Comando                        | Arquivo                                                       | Conteúdo                                                                                   |
| ------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `make:schema`                  | `src/schemas/entities/cliente.ts`                             | `clienteSchema`, `ClienteSchema`, `clienteInputSchema`, `ClienteInput`, `ClienteSortKey`, `ClienteListQuery` |
| `make:usecase clientes --crud` | `src/use-cases/clientes/list-clientes.*`                      | O use case de listar: `.types.ts`, `.usecase.ts`, `.mock.ts` e `.usecase.test.ts`          |
|                                | `src/use-cases/clientes/{get,create,update,remove}-cliente.*` | Os outros quatro, com os mesmos quatro arquivos                                            |
|                                | `src/use-cases/clientes/collection.mock.ts`                   | `MOCK_CLIENTES` (os dados de exemplo) e a coleção em memória que os cinco mocks dividem    |
|                                | `src/use-cases/clientes/index.ts`                             | `createClientesUseCases` e as rotas de mock do domínio                                     |

Os comandos também registram o domínio: o `make:schema` em `src/schemas/index.ts`, o `make:usecase` em `src/use-cases/index.ts` (o registro que `useUseCases()` entrega às telas) e no `errors.json` de cada idioma (o texto de `CLIENTE_NOT_FOUND` e dos `_FAILED`). Rode `pnpm verify` para ver tudo junto.

## Os campos do schema (`--fields`)

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

O nome do campo é camelCase (começa com letra minúscula; só letras e números). Um `?` depois do nome torna o campo opcional (`apelido?:string` vira `z.string().optional()`). O comando recusa, sem escrever nada, `id` e `createdAt` (a API já os dá a todo registro), nomes repetidos, tipos desconhecidos e listas mal formadas.

### O leitor de campos

O `make:usecase --crud` não tem `--fields`: ele **lê os campos do schema** que o `make:schema` gerou, com o ts-morph, e a partir deles gera, coerentes entre si:

- **as fixtures** do mock: três registros com valores de exemplo por tipo (texto `Titulo 1`, número `10`, `20`, `30`, booleano alternado, datas crescentes, os valores do enum na ordem);
- **a coleção do mock**: a busca nos campos de texto (sem campo de texto, no `id`) e a ordem por cada campo da `<Entidade>SortKey`;
- **os tipos e os testes** dos use cases: o Input de `createCliente` e de `updateCliente` vem do `pick` do schema de entrada, e os testes de busca, ordem, criação e edição usam os campos lidos.

Isso significa que o schema pode ser **editado à mão** antes do `make:usecase --crud`, dentro do que o leitor entende:

- `id` e `createdAt` como `z.string()`, e campos em camelCase sem aspas;
- os tipos da tabela acima, na forma em que o `--fields` os escreve (o enum pode ocupar várias linhas e ter vírgula no fim);
- o `<entidade>InputSchema` escrito com `.pick({ campo: true, ... })` (um campo que o backend calcula fica de fora do `pick` e recebe um valor de exemplo no mock; `.omit(...)` não é lido);
- a `<Entidade>SortKey` como a união de nomes de campo (sem campo booleano).

Um campo que o leitor não reconhece, como `z.string().min(3)` ou `z.email()`, é **erro de uso**, com o arquivo, a linha e o nome do campo, e nada é criado. Para validar mais do que o tipo, gere o schema com o tipo simples, rode o `make:usecase --crud` e só então acrescente a validação ao schema.

Os textos de exemplo das fixtures são genéricos: troque pelos dados do seu produto, e os testes dos use cases continuam verdes enquanto as fixtures e os testes andam juntos.

## Os use cases do domínio

Cada use case é uma ação com nome de verbo, um Input, um Output e um `execute`. O `--crud` gera os cinco que um domínio costuma ter:

| Chave no registro | Endereço               | Input                                                  | Output                                     |
| ----------------- | ---------------------- | ------------------------------------------------------ | ------------------------------------------ |
| `listClientes`    | `GET /clientes`        | o `ClienteListQuery` do schema: `search`, `sort`, `page` e `page_size` | `Page<ClienteSchema>` (`{ items, total }`) |
| `getCliente`      | `GET /clientes/:id`    | `{ id }`                                               | `ClienteSchema`                            |
| `createCliente`   | `POST /clientes`       | o `ClienteInput` do schema                             | `ClienteSchema`                            |
| `updateCliente`   | `PATCH /clientes/:id`  | o `id` e o `ClienteInput` com todos os campos opcionais | `ClienteSchema`                           |
| `removeCliente`   | `DELETE /clientes/:id` | `{ id }`                                               | `void`                                     |

- `listClientes` aceita busca (`search`, sem diferenciar maiúsculas e acentos), ordem (`sort: { key, direction }`) e página (`page`, a partir de 1, e `page_size`). Devolve `{ items, total }`, em que `total` conta todos os itens que casam com a busca, antes de paginar.
- `updateCliente` é **parcial**: muda só os campos enviados e mantém os outros (um `PATCH`). Para mudar um ou dois campos, envie só eles: `updateCliente.execute({ id, status: 'cancelado' })`.
- Um registro que não existe é um `UIError` com o código `<ENTIDADE>_NOT_FOUND`, que a interface traduz (veja [Erros e notificações](errors-and-notifications.md)).
- O mock **não** é uma implementação à parte: o use case de verdade roda sobre um `http` de mentira (`createMockHttp`), que responde a cada endereço com o handler do `.mock.ts`. Os cinco mocks dividem uma coleção em memória, então criar e depois listar mostra o item novo.

Para uma ação que o CRUD não cobre (por exemplo, `list-by-city`), crie um use case avulso, que é registrado no mesmo domínio:

```bash
pnpm exec prumo make:usecase clientes.list-by-city --input "city:string" --output "cliente[]"
```

As telas usam o use case com `useQuery` (leitura) ou `useMutation` (escrita), e a chave de cache de cada leitura é a `<ação>Key(input)` do `.types.ts`, com o domínio no prefixo. Uma escrita invalida o prefixo do domínio (`['clientes']`) no `onSuccess`: as listas e os detalhes se atualizam sozinhos.

```ts
// src/pages/clientes/model.ts
const { listClientes, createCliente } = useUseCases()
const queryClient = useQueryClient()
const input = { search, sort: { key: 'name', direction: 'asc' }, page, page_size: 20 }

const list = useQuery({
  queryKey: listClientesKey(input),
  queryFn: () => listClientes.execute(input),
  placeholderData: keepPreviousData,
})
const create = useMutation({
  mutationFn: (input: ClienteInput) => createCliente.execute(input),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
})
```

O `placeholderData: keepPreviousData` mantém os dados anteriores enquanto uma consulta nova carrega: ao buscar, filtrar ou paginar, `list.isPending` só é `true` na primeira carga.

## Mudar a forma do dado

O caminho principal é pedir os campos na criação, com `--fields` no `make:schema`. Esta seção vale para mudar a forma **depois** de gerar os use cases: o domínio nasceu sem `--fields` (só com `id`, `name` e `createdAt`), ou o produto ganhou um campo. Os comandos não regeneram nada (nunca sobrescrevem arquivo), então a mudança é à mão: comece pelo schema e deixe o TypeScript apontar o resto.

**1. O schema e a entrada:**

```ts
// src/schemas/entities/cliente.ts
export const clienteSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  createdAt: z.string(),
})

/** O que se envia para criar ou editar: o `id` e a data são da API. */
export const clienteInputSchema = clienteSchema.pick({ name: true, email: true })
```

**2. As fixtures e a coleção do mock**, em `src/use-cases/clientes/collection.mock.ts`:

```ts
export const MOCK_CLIENTES: ClienteSchema[] = [
  { id: 'cliente-1', name: 'Ana Souza', email: 'ana@exemplo.com', createdAt: '2026-01-05T12:00:00.000Z' },
  // ...
]

export const clientesCollection = createMockCollection(MOCK_CLIENTES, {
  idPrefix: 'cliente',
  searchFields: (item) => [item.name, item.email],
  sortFields: {
    name: (item) => item.name,
    email: (item) => item.email, // a chave nova também entra em ClienteSortKey
    createdAt: (item) => item.createdAt,
  },
})
```

Se quiser buscar ou ordenar pelo campo novo, acrescente-o nessas duas listas e a chave em `ClienteSortKey`.

**3. Os testes:** `pnpm typecheck` aponta as chamadas de `createCliente` que agora precisam do `email` (o `updateCliente` é parcial e não reclama). Se você trocou os dados das fixtures, ajuste também os casos que dependem deles (a busca por `'EXEMPLO 2'` e a ordem esperada). **As fixtures e os testes andam juntos.**

### Onde o `name` aparece

Em um domínio criado sem `--fields`, trocar ou tirar o `name` (em vez de só acrescentar campos) mexe em todos estes lugares, e o `tsc` nem sempre acusa todos (um domínio criado com `--fields` já nasce sem eles):

| Onde                                                           | O que o cita                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/schemas/entities/cliente.ts`                              | `clienteSchema` e o `pick` do `clienteInputSchema`                           |
| `src/use-cases/clientes/collection.mock.ts`                    | o `name` de cada fixture, a busca e o acessor `name` da ordem                |
| `src/use-cases/clientes/*.usecase.test.ts`                     | a busca por `'EXEMPLO 2'`, a ordem esperada, o `name` do create e do update  |
| `src/pages/<tela>/view.tsx`, das telas geradas com `--usecase` | `item.name` na lista (e no detalhe, se a tela é de detalhe)                  |
| `src/pages/<tela>/index.test.tsx`, das telas de detalhe        | o texto `Exemplo 1`, que é o `name` da primeira fixture                      |

O `pnpm verify` (com o `typecheck` e os testes) mostra o que sobrou. **Só campo acrescentado** deixa as telas que usam o domínio compilando, e as que precisam do campo novo o recebem já tipado. Trocar ou tirar um campo quebra o que o citava: as views geradas (`item.name`), por exemplo.

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

E no Input do `list-clientes.types.ts`, que valida o Input com zod, acrescente o `status`.

**2. O filtro no mock**, em `list-clientes.mock.ts`. A coleção em memória busca, ordena e pagina, mas não conhece o filtro novo: tire o `status` da consulta, peça a lista sem página, filtre e pagine depois (o `paginate` é do `@matizze/prumo-core/mock`):

```ts
[`${ENDPOINT.method} ${ENDPOINT.path}` as const]: ({ query }: Call) => {
  const { status, page, page_size, ...rest } = query
  const { items } = clientesCollection.list(rest) // a busca e a ordem, em todas as páginas
  const filtered = status ? items.filter((item) => item.status === status) : items
  return paginate(filtered, page ? Number(page) : undefined, page_size ? Number(page_size) : undefined)
},
```

**3. O caso no teste do use case**, que a API real também vai cumprir (com `API_TEST_URL`):

```ts
it('filtra pelo status', async () => {
  const { items, total } = await subject.listClientes.execute({ status: 'ativo' })
  expect(total).toBe(2)
  expect(items.every((item) => item.status === 'ativo')).toBe(true)
})
```

A chave de cache já leva o Input inteiro (`listClientesKey(input)`), então o filtro novo entra na chave e na busca sem mais nada. Na API real, o Input de uma leitura vai como query string da URL, e o campo novo vira um parâmetro sem outra mudança.

### Consultas que dependem de "hoje"

Uma consulta como "atrasados" ou "vencem esta semana" depende da data de hoje, e um mock que chama `new Date()` dá um resultado que muda com o dia, o que quebra o teste. Passe a data **no Input**, e o mock e o teste ficam determinísticos:

```ts
// no Input do use case
today?: string // data ISO (yyyy-mm-dd); o chamador informa

// no mock, no mesmo filtro do passo anterior
const filtered = items.filter((item) => !today || item.dueDate < today)

// no teste, com as datas das fixtures
const { items } = await subject.listClientes.execute({ today: '2026-03-01' })
expect(items.map((item) => item.id)).toEqual(['cliente-2'])
```

A tela passa a data de verdade (`today: new Date().toISOString().slice(0, 10)`); o teste, uma data fixa. Para somar dias a uma data no mock e nas fixtures, há o `addDays` do `@matizze/prumo-core/mock`, e para formatar a data sem erro de fuso, o `@matizze/prumo-core/date`.

## Regras de negócio e operações entre domínios

O CRUD de um domínio não sabe de regra: "um cliente pode ter no máximo 3 pedidos em aberto" e "cancelar um pedido devolve o item ao estoque" não são `list` nem `create`. O Prumo não gera nem cobra um lugar para elas; a convenção que funciona tem três peças, de baixo para cima.

**1. Regras como funções puras, em `src/rules/`.** Recebem os dados (e "hoje") como argumento e devolvem uma decisão: nada de hook, use case, `new Date()` nem `fetch`. Por serem puras, o teste é uma chamada de função:

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

**2. Operações entre domínios como um use case próprio.** Uma operação que lê ou grava em mais de um domínio (fazer um pedido olha pedidos e clientes; cancelar mexe em pedidos e estoque) não pertence a um domínio só. Ela vira um use case (`pedidos.place-order`), que **recebe os outros use cases pelo construtor**, aplica as regras e devolve o resultado. Como todo use case, ele não importa de React nem do TanStack: o `prumo/use-case-imports` do ESLint confere.

```ts
// src/use-cases/pedidos/place-order.usecase.ts
import { UIError } from '@matizze/prumo-core/errors'
import type { IUseCase } from '@matizze/prumo-core/use-cases'
import { verificarPedido, LIMITE_DE_PEDIDOS_EM_ABERTO } from '@/rules'
import type { PlaceOrderInput, PlaceOrderOutput } from './place-order.types'

export class PlaceOrderUseCase implements IUseCase<PlaceOrderInput, PlaceOrderOutput> {
  readonly #getCliente: IUseCase<{ id: string }, ClienteSchema>
  readonly #listPedidos: IUseCase<ListPedidosInput, Page<PedidoSchema>>
  readonly #createPedido: IUseCase<CreatePedidoInput, PedidoSchema>

  constructor(deps: { getCliente: ...; listPedidos: ...; createPedido: ... }) {
    // guarda os três use cases
  }

  async execute(input: PlaceOrderInput): Promise<PlaceOrderOutput> {
    const hoje = input.hoje ?? new Date().toISOString().slice(0, 10)
    await this.#getCliente.execute({ id: input.clienteId }) // CLIENTE_NOT_FOUND, se não existir
    const { items } = await this.#listPedidos.execute({ clienteId: input.clienteId, emAberto: true })

    const recusa = verificarPedido(items, hoje)
    if (recusa) throw new UIError(recusa, 'Pedido recusado.', { limite: LIMITE_DE_PEDIDOS_EM_ABERTO })

    return this.#createPedido.execute({ clienteId: input.clienteId, produto: input.produto, criadoEm: hoje })
  }
}
```

A tela usa o use case como qualquer outro (`useMutation`) e invalida os domínios afetados no `onSuccess` (`['pedidos']` e `['clientes']`).

A recusa é um `UIError` com código, como qualquer erro de domínio (veja [Erros e notificações](errors-and-notifications.md)): a mutation falha, o `createQueryClient` notifica o texto traduzido e a tela pode mostrá-lo no formulário. O texto leva o valor: `"PEDIDO_LIMITE_ATINGIDO": "Você já tem {limite} pedidos em aberto"`. Os use cases de CRUD continuam sem saber de regra: só leem e gravam.

**3. O model liga e desliga as ações com as mesmas regras.** A tela não precisa tentar a operação para saber que ela vai ser recusada: o model chama a regra e mostra o motivo, traduzido pelo `getErrorMessage`, que aceita o código solto:

```ts
// src/pages/cliente/model.ts
const t = useTranslations('cliente')
const filtro = { clienteId: id, emAberto: true }
const pedidos = useQuery({ queryKey: listPedidosKey(filtro), queryFn: () => listPedidos.execute(filtro) })
const { placeOrder, listPedidos } = useUseCases()
const fazerPedido = useMutation({ mutationFn: (input: PlaceOrderInput) => placeOrder.execute(input) })

const recusa = verificarPedido(pedidos.data?.items ?? [], new Date().toISOString().slice(0, 10))

return {
  canOrder: recusa === null,
  // o motivo do botão desligado, no idioma ativo e com o limite no texto
  orderBlockedReason: recusa ? getErrorMessage(recusa, { limite: LIMITE_DE_PEDIDOS_EM_ABERTO }) : undefined,
  onOrder: (produto: string) => fazerPedido.mutate({ clienteId: id, produto }),
}
```

A regra roda duas vezes, na tela (para o botão) e na operação (para valer de verdade), e é a **mesma função**: por isso a regra mora fora dos dois. Se a API também confere a regra, a conferência do servidor é a que protege os dados; a do app é conveniência.

**Os testes.** A regra, sem React. A operação, com o `execute` do use case contra o mock (o teste do use case roda sobre o `http` de mentira), conferindo a recusa e o efeito nos dois domínios:

```ts
it('recusa o pedido e não grava nada', async () => {
  // ... deixa o cliente com 3 pedidos em aberto no mock

  await expect(
    subject.execute({ clienteId: 'cliente-1', produto: 'Caneta', hoje: '2026-11-22' }),
  ).rejects.toMatchObject({ code: 'PEDIDO_LIMITE_ATINGIDO' })
})
```

O `prumo check` e o ESLint não olham `src/rules` (a pasta é livre): o único cuidado é manter as regras puras, sem importar de `@/use-cases` nem de `@/pages`. Nenhum comando do Prumo mexe nessas pastas.

## Validar a entrada

O use case já valida o Input com zod no `execute` (um Input inválido rejeita, antes de qualquer chamada à API). O `clienteInputSchema` é o mesmo schema zod: use-o no model para mostrar o erro de cada campo do formulário antes de chamar o use case:

```ts
import { z } from 'zod'

const result = clienteInputSchema.safeParse({ name, email })
if (!result.success) return setErrors(z.flattenError(result.error).fieldErrors)
create.mutate(result.data)
```

Para que as mensagens de validação saiam traduzidas, escreva-as como chaves de texto (`z.string().min(1, 'validation.required')`) e use o `useFieldError` do i18n (veja [Textos e idiomas](i18n.md#mensagens-de-validação)).

## Apagar um domínio

1. Apague `src/use-cases/<domínio>/` e `src/schemas/entities/<entidade>.ts`.
2. Tire o import, o `...create<Domínio>UseCases(deps)` e as rotas de mock do domínio em `src/use-cases/index.ts`, e as linhas do domínio em `src/schemas/index.ts`.
3. Tire as telas que o usam (`src/pages/<tela>` e a rota em `src/App.tsx`) e o texto `<ENTIDADE>_NOT_FOUND` dos `errors.json`.
4. Rode `pnpm verify`: o `tsc` aponta o que ainda usa o domínio.
