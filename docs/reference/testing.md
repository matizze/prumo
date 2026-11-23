# Referência do `@matizze/prumo-testing`

Utilitários de teste sem interface, para o Vitest com jsdom: o `renderWithProviders` e o `renderHookWithProviders` com rota em memória, o setup do DOM, um `matchMedia` controlável, a promise controlada pelo teste e o teste de contrato de repositórios.

```bash
pnpm add -D @matizze/prumo-testing
```

| Subcaminho                         | Conteúdo                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `@matizze/prumo-testing`           | `createRenderWithProviders`, `createRenderHookWithProviders`, `createTestQueryClient`, `createTestRepositories`, `createDeferred` |
| `@matizze/prumo-testing/dom`       | `setupDom`, `installMatchMedia`, `setMediaQuery`, `resetMatchMedia`                            |
| `@matizze/prumo-testing/contract`  | `defineContractSuite`, `runContractSuite`                                                      |

**Peer dependencies:** `react` e `react-dom` ^19.3, `@tanstack/react-query` ^5.105, `@testing-library/react` ^16.3, `vitest` ^5.1 e `wouter` ^3.13. O pacote usa as instâncias do app e não importa nada dele (nenhum `@/`): o que é do app entra por parâmetro.

---

## Render

### `createRenderWithProviders(binding)`

```ts
function createRenderWithProviders<C extends object, P extends object = {}>(binding: {
  Providers: ComponentType<{ children: ReactNode; repositories: C } & P>
  createRepositories: (overrides?: Partial<C>) => C
  createQueryClient: () => QueryClient
}): (ui: ReactElement, options?: RenderWithProvidersOptions<C, P>) => RenderWithProvidersResult<C>
```

Cria o `renderWithProviders` do app. O pacote põe o que é comum a todo app (o `QueryClientProvider` e o `Router` em memória do wouter), e o app liga o resto:

| Campo                 | O que o app passa                                                                       |
| --------------------- | --------------------------------------------------------------------------------------- |
| `Providers`           | Os provedores do app (i18n, tema, repositórios), que recebem o container em `repositories` e as `providerProps` do teste |
| `createRepositories`  | Cria o container em memória, aplicando os `overrides` do teste                          |
| `createQueryClient`   | Cria o `QueryClient` de um teste                                                        |

O app liga uma vez, num arquivo próprio (o `prumo new` cria `src/test/render.tsx`), e os testes importam dele:

```tsx
export const renderWithProviders = createRenderWithProviders<RepositoryContainer>({
  Providers,
  createRepositories: (overrides) => ({
    ...createRepositories({ dataSource: 'mock', latencyMs: 0 }),
    ...overrides,
  }),
  createQueryClient: () =>
    createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
})
```

### `renderWithProviders(ui, options?)`

**Opções** (`RenderWithProvidersOptions<C, P>`): as do `render` do Testing Library, menos `wrapper`, e mais:

| Opção          | Padrão                         | Descrição                                     |
| -------------- | ------------------------------ | --------------------------------------------- |
| `path`         | `'/'`                          | A rota inicial do Router em memória           |
| `repositories` | `{}`                           | Os repositórios que trocam os do container    |
| `queryClient`  | um novo, de `createQueryClient` | O `QueryClient` do teste                     |
| `providerProps` | `{}`                          | As opções do app para este teste, do tipo `P`, repassadas aos `Providers` (a sessão, por exemplo) |

**Resultado** (`RenderWithProvidersResult<C>`): o resultado do `render` do Testing Library, e mais:

| Campo          | Descrição                                                                           |
| -------------- | ----------------------------------------------------------------------------------- |
| `queryClient`  | O `QueryClient` usado                                                               |
| `repositories` | O container usado, com os `overrides` aplicados                                     |
| `history`      | As rotas visitadas; navegar com `replace` troca a última                            |
| `navigate`     | Navega na rota em memória (`navigate(path, { replace? })`)                          |
| `currentPath`  | Devolve a última rota do `history`                                                  |

A ordem dos provedores, de fora para dentro: `QueryClientProvider`, `Router`, `Providers` do app. Assim, um provedor do app pode usar o `QueryClient` e a rota (a sessão que limpa o cache ao sair, por exemplo).

**Opções do app por teste (`P`).** O segundo parâmetro de tipo, opcional, declara o que muda de teste para teste e só o app conhece, como a sessão. O `Providers` do app passa a receber essas props junto de `repositories`, e cada teste as escolhe em `providerProps`. O pacote não lê esse objeto, só o repassa; sem `P`, o `Providers` recebe apenas `repositories`, como antes. Veja [Provedores do app nos testes](../guides/test.md#provedores-do-app-nos-testes).

```tsx
interface TestProviderProps {
  session?: Session
}

export const renderWithProviders = createRenderWithProviders<RepositoryContainer, TestProviderProps>(binding)

renderWithProviders(<EmprestimosPage />, { providerProps: { session } })
```

### `createRenderHookWithProviders(binding)`

```ts
function createRenderHookWithProviders<C extends object, P extends object = {}>(
  binding: RenderWithProvidersBinding<C, P>,
): <Result, Props = undefined>(
  hook: (props: Props) => Result,
  options?: RenderHookWithProvidersOptions<C, Props, P>,
) => RenderHookWithProvidersResult<C, Result, Props>
```

Cria o `renderHookWithProviders` do app, com a **mesma ligação** do `createRenderWithProviders` (guarde-a numa constante e passe às duas funções): os mesmos `Providers`, repositórios em memória, `QueryClient` sem retry e rota em memória. Serve para testar um hook de query ou de mutation sem montar um componente de mentira.

**Opções** (`RenderHookWithProvidersOptions<C, Props, P>`): as do `renderHook` do Testing Library (`initialProps`, `reactStrictMode`), menos `wrapper`, mais `path`, `repositories`, `queryClient` e `providerProps`, que valem como no `renderWithProviders`.

**Resultado** (`RenderHookWithProvidersResult<C, Result, Props>`): o do `renderHook` (`result`, `rerender`, `unmount`) e os campos `queryClient`, `repositories`, `history`, `navigate` e `currentPath` do `renderWithProviders`.

### `createTestQueryClient(createQueryClient)`

```ts
function createTestQueryClient(createQueryClient: (defaultOptions: DefaultOptions) => QueryClient): QueryClient
```

Um `QueryClient` isolado, sem retry em queries e mutations, para a falha aparecer na hora. Recebe a fábrica do `QueryClient` do app, para manter o tratamento de erro dele se quiser.

### `createTestRepositories(createContainer, overrides?)`

```ts
function createTestRepositories<C extends object>(createContainer: () => C, overrides?: Partial<C>): C
```

O container do app com os `overrides` aplicados por cima.

### `createDeferred()`

```ts
function createDeferred<T = void>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}
```

Uma promise que o teste resolve ou rejeita quando quiser, para conferir a tela durante uma operação assíncrona. Veja [Testes](../guides/test.md#estado-de-carregamento).

---

## DOM

### `setupDom(options?)`

```ts
function setupDom(options?: { asyncUtilTimeout?: number; onReset?: () => void }): void
```

Prepara o jsdom. Chame uma vez, no arquivo de `setupFiles` do Vitest.

- Instala o `window.matchMedia` controlável e o `window.scrollTo` e o `document.elementFromPoint`, que o jsdom não implementa.
- Configura o `asyncUtilTimeout` do Testing Library (padrão **5000 ms**; o padrão da biblioteca, 1 s, é curto para uma tela inteira na primeira renderização numa máquina carregada).
- Registra um `afterEach` que, na ordem: desmonta os componentes (`cleanup`), zera o `matchMedia`, chama o `onReset`, limpa os cookies e o `localStorage` e tira a classe e o estilo do `<html>`.

O `onReset` é o lugar de desfazer o que o app grava no storage (o idioma, por exemplo), antes da limpeza. O `@testing-library/jest-dom`, o idioma de partida e o `fake-indexeddb`, se o app usar, ficam no setup do app.

### `installMatchMedia()`, `setMediaQuery(query, matches)` e `resetMatchMedia()`

Um `window.matchMedia` controlável. Toda consulta começa sem casar (`matches: false`, o equivalente a desktop e tema claro).

- **`installMatchMedia()`** instala o `matchMedia` (o `setupDom` já chama).
- **`setMediaQuery(query, matches)`** define se a consulta casa e notifica quem escuta `change` nela, como o navegador. A mesma `MediaQueryList` reflete o valor atual.
- **`resetMatchMedia()`** esquece os valores e os ouvintes (o `setupDom` chama depois de cada teste).

```ts
setMediaQuery('(prefers-color-scheme: dark)', true)
```

---

## Teste de contrato

O contrato de um repositório é o que o app espera dele, não o que uma implementação faz. Ele é declarado uma vez e roda contra cada implementação (o mock, a HTTP, a IndexedDB).

### `defineContractSuite(name, cases)`

```ts
function defineContractSuite<R extends object>(
  name: string,
  cases: (context: { repo: R; create: () => R }) => void,
): ContractSuite<R>
```

Declara o contrato. `cases` registra os `it` e `describe` do Vitest e recebe:

- **`repo`**: o repositório do teste em andamento, uma instância nova por teste, criada antes dele. É uma referência estável que repassa tudo para a instância do teste atual, então se usa como uma variável comum: `vi.spyOn(repo, 'list')` vê as chamadas (use o spy que o `spyOn` devolve), `repo.list = ...` troca o método só naquele teste, `repo instanceof MockRepository` vale, e os métodos saem presos à instância (`repo.list === repo.list`). Ler métodos de `repo` fora de um teste ou de um hook lança erro. Uma propriedade não configurável é recusada.
- **`create`**: cria mais uma instância no estado de partida, para o teste que precisa de duas.

Os `beforeEach` e `afterEach` declarados em `cases` (um relógio falso, por exemplo) rodam **antes** da criação do repositório, e os `afterEach`, **depois** do `dispose`.

### `runContractSuite(suite, implementation)`

```ts
function runContractSuite<R extends object>(
  suite: ContractSuite<R>,
  implementation: {
    name: string
    create: () => R
    dispose?: () => void | Promise<void>
  },
): void
```

Roda o contrato contra uma implementação, num `describe` com o título `<nome do contrato>: <nome da implementação>`. Chame uma vez por implementação.

| Campo     | Descrição                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `name`    | O nome da implementação, que entra no título (`MockClientesRepository`)                                     |
| `create`  | Cria uma instância nova, no estado de partida. Chamado uma vez por teste e a cada `create` do contexto     |
| `dispose` | Libera o que as instâncias do teste deixaram (um banco, uma API de teste). Roda depois de cada teste, também quando ele falha |

**Os dados.** Os casos que dependem dos dados do mock (as fixtures) só valem para uma implementação que parte dos mesmos dados: semeie a outra implementação com as mesmas fixtures no `create`, ou deixe esses casos fora do contrato dela. Os casos que não dependem de dados (ordenação, validação, erros, concorrência) valem para qualquer implementação.

**Fora do contrato.** O teste da fábrica (`create<Domínio>Repository`) e o de migração de um banco não são do contrato, porque não valem para toda implementação: ficam num `describe` próprio do mesmo arquivo.

```ts
const clientesContract = defineContractSuite<IClientesRepository>(
  'IClientesRepository contract',
  ({ repo }) => {
    it('lista as fixtures, com ids únicos', async () => {
      const { items, total } = await repo.list()
      expect(total).toBe(MOCK_CLIENTES.length)
      expect(new Set(items.map((item) => item.id)).size).toBe(MOCK_CLIENTES.length)
    })
  },
)

runContractSuite(clientesContract, {
  name: 'MockClientesRepository',
  create: () => new MockClientesRepository({ latencyMs: 0 }),
})
```
