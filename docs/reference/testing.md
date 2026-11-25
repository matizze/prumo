# Referência do `@matizze/prumo-testing`

Utilitários de teste sem interface, para o Vitest com jsdom: o `renderWithProviders` e o `renderHookWithProviders` com rota em memória, o setup do DOM, um `matchMedia` controlável, a promise controlada pelo teste e o teste de contrato de repositórios e de use cases.

```bash
pnpm add -D @matizze/prumo-testing
```

| Subcaminho                         | Conteúdo                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `@matizze/prumo-testing`           | `createRenderWithProviders`, `createRenderHookWithProviders`, `createTestQueryClient`, `createTestUseCases`, `createDeferred` |
| `@matizze/prumo-testing/dom`       | `setupDom`, `installMatchMedia`, `setMediaQuery`, `resetMatchMedia`                            |
| `@matizze/prumo-testing/contract`  | `defineContractSuite`, `runContractSuite`                                                      |

**Peer dependencies:** `react` e `react-dom` ^19.3, `@tanstack/react-query` ^5.105, `@testing-library/react` ^16.3, `vitest` ^5.1 e `wouter` ^3.13. O pacote usa as instâncias do app e não importa nada dele (nenhum `@/`): o que é do app entra por parâmetro.

---

## Render

### `createRenderWithProviders(binding)`

```ts
function createRenderWithProviders<U extends object = {}, P extends object = {}>(binding: {
  Providers: ComponentType<{ children: ReactNode; useCases: U } & P>
  createUseCases: (overrides?: Partial<U>) => U
  createQueryClient: () => QueryClient
}): (ui: ReactElement, options?: RenderWithProvidersOptions<U, P>) => RenderWithProvidersResult<U>
```

Cria o `renderWithProviders` do app. O pacote põe o que é comum a todo app (o `QueryClientProvider` e o `Router` em memória do wouter), e o app liga o resto:

| Campo               | O que o app passa                                                                       |
| ------------------- | --------------------------------------------------------------------------------------- |
| `Providers`         | Os provedores do app (i18n, tema, use cases), que recebem o container em `useCases` e as `providerProps` do teste |
| `createUseCases`    | Cria o container de use cases, com o `http` de mentira, aplicando os `overrides` do teste |
| `createQueryClient` | Cria o `QueryClient` de um teste                                                        |

Os parâmetros de tipo são `U` (os use cases) e `P` (as opções por teste), nessa ordem. Quando o app declara `U`, o `createUseCases` é **obrigatório**: sem ele, o container de use cases seria vazio e o código não compila. Só o app sem use cases (`U` omitido, o padrão `NoContainer`) dispensa a fábrica.

O app liga uma vez, num arquivo próprio (o `prumo new` cria `src/test/render.tsx`), e os testes importam dele:

```tsx
export const renderWithProviders = createRenderWithProviders<UseCases>({
  Providers, // recebe `useCases` e monta o UseCasesProvider
  createUseCases: (overrides) =>
    createTestUseCases(() => createUseCases({ http: createMockHttp(routes) }), overrides),
  createQueryClient: () =>
    createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
})

renderWithProviders(<LoginPage />, {
  useCases: {
    signIn: {
      execute: async () => {
        throw new UIError('AUTH_INVALID_CREDENTIALS')
      },
    },
  },
})
```

### `renderWithProviders(ui, options?)`

**Opções** (`RenderWithProvidersOptions<U, P>`): as do `render` do Testing Library, menos `wrapper`, e mais:

| Opção          | Padrão                         | Descrição                                     |
| -------------- | ------------------------------ | --------------------------------------------- |
| `path`         | `'/'`                          | A rota inicial do Router em memória           |
| `useCases`     | `{}`                           | Os use cases que trocam os do container       |
| `queryClient`  | um novo, de `createQueryClient` | O `QueryClient` do teste                     |
| `providerProps` | `{}`                          | As opções do app para este teste, do tipo `P`, repassadas aos `Providers` (a sessão, por exemplo) |

**Resultado** (`RenderWithProvidersResult<U>`): o resultado do `render` do Testing Library, e mais:

| Campo          | Descrição                                                                           |
| -------------- | ----------------------------------------------------------------------------------- |
| `queryClient`  | O `QueryClient` usado                                                               |
| `useCases`     | O container de use cases usado, com os `overrides` aplicados                        |
| `history`      | As rotas visitadas; navegar com `replace` troca a última                            |
| `navigate`     | Navega na rota em memória (`navigate(path, { replace? })`)                          |
| `currentPath`  | Devolve a última rota do `history`                                                  |

A ordem dos provedores, de fora para dentro: `QueryClientProvider`, `Router`, `Providers` do app. Assim, um provedor do app pode usar o `QueryClient` e a rota (a sessão que limpa o cache ao sair, por exemplo).

**Opções do app por teste (`P`).** O segundo parâmetro de tipo, opcional, declara o que muda de teste para teste e só o app conhece, como a sessão. O `Providers` do app passa a receber essas props junto de `useCases`, e cada teste as escolhe em `providerProps`. O pacote não lê esse objeto, só o repassa; sem `P`, o `Providers` recebe apenas `useCases`. Veja [Provedores do app nos testes](../guides/test.md#provedores-do-app-nos-testes).

```tsx
interface TestProviderProps {
  session?: Session
}

export const renderWithProviders = createRenderWithProviders<UseCases, TestProviderProps>(binding)

renderWithProviders(<EmprestimosPage />, { providerProps: { session } })
```

### `createRenderHookWithProviders(binding)`

```ts
function createRenderHookWithProviders<U extends object = {}, P extends object = {}>(
  binding: RenderWithProvidersBinding<U, P>,
): <Result, Props = undefined>(
  hook: (props: Props) => Result,
  options?: RenderHookWithProvidersOptions<U, Props, P>,
) => RenderHookWithProvidersResult<U, Result, Props>
```

Cria o `renderHookWithProviders` do app, com a **mesma ligação** do `createRenderWithProviders` (guarde-a numa constante e passe às duas funções): os mesmos `Providers`, use cases sobre o `http` de mentira, `QueryClient` sem retry e rota em memória. Serve para testar um hook de query ou de mutation sem montar um componente de mentira.

**Opções** (`RenderHookWithProvidersOptions<U, Props, P>`): as do `renderHook` do Testing Library (`initialProps`, `reactStrictMode`), menos `wrapper`, mais `path`, `useCases`, `queryClient` e `providerProps`, que valem como no `renderWithProviders`.

**Resultado** (`RenderHookWithProvidersResult<U, Result, Props>`): o do `renderHook` (`result`, `rerender`, `unmount`) e os campos `queryClient`, `useCases`, `history`, `navigate` e `currentPath` do `renderWithProviders`.

### `createTestQueryClient(createQueryClient)`

```ts
function createTestQueryClient(createQueryClient: (defaultOptions: DefaultOptions) => QueryClient): QueryClient
```

Um `QueryClient` isolado, sem retry em queries e mutations, para a falha aparecer na hora. Recebe a fábrica do `QueryClient` do app, para manter o tratamento de erro dele se quiser.

### `createTestUseCases(createContainer, overrides?)`

```ts
function createTestUseCases<U extends object>(createContainer: () => U, overrides?: Partial<U>): U
```

O container de use cases do app com os `overrides` aplicados por cima: O `createContainer` do app monta os use cases com o `http` de mentira (`createMockHttp`) e sem latência.

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

O contrato de um use case é o que o app espera dele, não o que uma implementação faz. Ele é declarado uma vez e roda contra cada implementação: o use case sobre o `http` de mentira e sobre a API real. As funções são genéricas (`R extends object`) e não sabem o que a instância é.

### `defineContractSuite(name, cases)`

```ts
function defineContractSuite<R extends object>(
  name: string,
  cases: (context: { subject: R; create: () => R }) => void,
): ContractSuite<R>
```

Declara o contrato. `cases` registra os `it` e `describe` do Vitest e recebe:

- **`subject`**: o objeto do contrato no teste em andamento (o use case), uma instância nova por teste, criada antes dele. É uma referência estável que repassa tudo para a instância do teste atual, então se usa como uma variável comum: `vi.spyOn(subject, 'execute')` vê as chamadas (use o spy que o `spyOn` devolve), `subject.execute = ...` troca o método só naquele teste, `subject instanceof SignInUseCase` vale, e os métodos saem presos à instância (`subject.execute === subject.execute`). Ler métodos de `subject` fora de um teste ou de um hook lança erro. Uma propriedade não configurável é recusada.
- **`create`**: cria mais uma instância no estado de partida, para o teste que precisa de duas.

Os `beforeEach` e `afterEach` declarados em `cases` (um relógio falso, por exemplo) rodam **antes** da criação da instância, e os `afterEach`, **depois** do `dispose`.

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
| `name`    | O nome da implementação, que entra no título (`SignInUseCase (mock)`)                                     |
| `create`  | Cria uma instância nova, no estado de partida. Chamado uma vez por teste e a cada `create` do contexto     |
| `dispose` | Libera o que as instâncias do teste deixaram (um banco, uma API de teste). Roda depois de cada teste, também quando ele falha |

**Os dados.** Os casos que dependem dos dados do mock (as fixtures) só valem para uma implementação que parte dos mesmos dados: semeie a outra implementação com as mesmas fixtures no `create`, ou deixe esses casos fora do contrato dela. Os casos que não dependem de dados (ordenação, validação, erros, concorrência) valem para qualquer implementação.

O contrato roda contra o `http` de mentira e, quando há uma API de teste, contra a real:

```ts
const signInContract = defineContractSuite<IUseCase<SignInRequest, SignInResponse>>(
  'SignInUseCase contract',
  ({ subject: signIn }) => {
    it('devolve o token e o usuário', async () => {
      const output = await signIn.execute({ email: 'ana@x.com', password: '12345678' })
      expect(output.token).not.toBe('')
    })

    it('recusa a senha errada com AUTH_INVALID_CREDENTIALS', async () => {
      await expect(
        signIn.execute({ email: 'ana@x.com', password: 'errada123' }),
      ).rejects.toMatchObject({
        code: 'AUTH_INVALID_CREDENTIALS',
      })
    })
  },
)

runContractSuite(signInContract, {
  name: 'SignInUseCase (mock)',
  create: () => new SignInUseCase(createMockHttp(signInRoutes)),
})

if (process.env.API_TEST_URL) {
  runContractSuite(signInContract, {
    name: 'SignInUseCase (API)',
    create: () => new SignInUseCase(createHttp({ baseUrl: process.env.API_TEST_URL ?? '' })),
  })
}
```
