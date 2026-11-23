# Referência do `@matizze/prumo-core`

A infraestrutura sem interface de um app do Prumo. Cada módulo tem um subcaminho próprio, para que importar um não traga as dependências dos outros. Nenhum módulo renderiza elemento visual: o `AuthGuard` e os provedores renderizam só os `children` (e o `fallback` que o produto passa).

```bash
pnpm add @matizze/prumo-core
```

| Subcaminho                                          | Conteúdo                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`@matizze/prumo-core/repositories`](#repositories) | `createRepositoryContainer`, `resolveDataSource`, `createRepositoryContext`       |
| [`@matizze/prumo-core/query`](#query)               | `createQueryKeys`, `createQueryClient`, `QueryProvider`, `ErrorMeta`               |
| [`@matizze/prumo-core/i18n`](#i18n)                 | `defineI18n`, `createFormat`, `resolveLocale` e os tipos de mensagens              |
| [`@matizze/prumo-core/errors`](#errors)             | `UIError`, `createErrorMessage`                                                    |
| [`@matizze/prumo-core/date`](#date)                 | `addDays`, `daysBetween`, `parseLocalDate`                                        |
| [`@matizze/prumo-core/data`](#data)                 | `pageSchema`, `Page`, `PageQuery`, `Sort`, `SortDirection`, `DateRange`           |
| [`@matizze/prumo-core/mock`](#mock)                 | `wait`, `normalize`, `matchesSearch`, `sortBy`, `paginate`, `sum`, `addDays`      |
| [`@matizze/prumo-core/auth`](#auth)                 | `AuthGuard`, `useAuthOrigin`, `safeRedirectPath`, `buildLoginRedirect`, `readOrigin` |

**Peer dependencies:** `react` ^19.3, `@tanstack/react-query` ^5.105, `zod` ^4.6, `i18next` ^26.4, `react-i18next` ^17.0, `i18next-icu` ^2.5, `i18next-browser-languagedetector` ^8.2 e `wouter` ^3.13. O projeto instala as que os módulos que usa pedem.

---

## repositories

O container de repositórios: um objeto com um repositório por domínio, criado a partir de um mapa de fábricas, e o contexto React que o entrega às queries.

### `createRepositoryContainer(factories, options)`

```ts
function createRepositoryContainer<S extends string, F extends RepositoryFactories<S>>(
  factories: F,
  options: RepositoryOptions<S>,
): RepositoryContainerOf<F>
```

Chama cada fábrica com as mesmas `options` e devolve o container. O tipo do container sai do mapa: cada chave guarda o que a fábrica dela devolve.

```ts
const factories = {
  clientes: createClientesRepository,
  pedidos: createPedidosRepository,
}

export type RepositoryContainer = RepositoryContainerOf<typeof factories>
// { clientes: IClientesRepository; pedidos: IPedidosRepository }

const repositories = createRepositoryContainer(factories, { dataSource: 'memory' })
```

### `resolveDataSource(value, sources, fallback, name?)`

```ts
function resolveDataSource<S extends string>(
  value: string | undefined,
  sources: readonly S[],
  fallback: S,
  name?: string, // padrão: 'dataSource'
): S
```

Converte um texto de configuração (uma variável de ambiente, por exemplo) numa fonte de dados válida. Valor vazio ou ausente devolve o `fallback`. Valor fora de `sources` **lança um erro** (`Invalid <name> "<valor>". Expected one of: ...`), para a inicialização falhar em vez de cair em silêncio em outra fonte.

```ts
resolveDataSource(import.meta.env.VITE_DATA_SOURCE, ['memory', 'http'], 'memory', 'VITE_DATA_SOURCE')
```

### `createRepositoryContext(createDefault?)`

```ts
function createRepositoryContext<C>(createDefault?: () => C): {
  RepositoryProvider: (props: RepositoryProviderProps<C>) => ReactElement
  useRepositories: () => C
}
```

Cria o contexto de repositórios do app, tipado pelo container.

- **`RepositoryProvider`** recebe `children` e, opcionalmente, `value` (o container; os testes passam um). Sem `value`, cria o container com `createDefault`, uma vez por montagem. Sem `value` e sem `createDefault`, lança um erro.
- **`useRepositories()`** devolve o container. Fora de um `RepositoryProvider`, lança `useRepositories must be used within a RepositoryProvider`.

```ts
export const { RepositoryProvider, useRepositories } =
  createRepositoryContext<RepositoryContainer>(createRepositories)
```

### Tipos

| Tipo                          | Descrição                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `RepositoryOptions<S>`        | `{ dataSource: S; latencyMs?: number }`: o que toda fábrica recebe. `latencyMs` é a latência dos mocks (padrão de cada mock: 300; use 0 nos testes). |
| `RepositoryFactories<S>`      | `Record<string, (options: RepositoryOptions<S>) => unknown>`: o mapa de fábricas.                                |
| `RepositoryContainerOf<F>`    | O container tipado de um mapa de fábricas.                                                                       |
| `RepositoryProviderProps<C>`  | `{ children: ReactNode; value?: C }`.                                                                            |

---

## query

Query keys por domínio, o `QueryClient` com padrões de cache e notificação de erro, e o provedor.

### `createQueryKeys(domain, definitions?)`

```ts
function createQueryKeys<const D extends string, const Defs extends Record<string, KeyDefinition>>(
  domain: D,
  definitions?: Defs,
): QueryKeys<D, Defs>
```

Cria as query keys de um domínio. Toda chave começa pelo nome do domínio, então invalidar `keys.all` atinge o domínio inteiro, e invalidar uma chave mais curta atinge as que começam por ela.

Cada definição é uma tupla fixa ou uma função que devolve as partes da chave depois do domínio. A tupla de uma função precisa de `as const` para manter os tipos literais. A chave `all` é reservada: ela existe em todo domínio, e o TypeScript recusa uma definição com esse nome.

```ts
const productKeys = createQueryKeys('products', {
  lists: ['list'],
  list: (query: ProductListQuery = {}) => ['list', query] as const,
  detail: (id: string) => ['detail', id] as const,
})

productKeys.all            // ['products']
productKeys.lists          // ['products', 'list']
productKeys.list({ page: 2 }) // ['products', 'list', { page: 2 }]
productKeys.detail('42')   // ['products', 'detail', '42']
```

### `createQueryClient(options)`

```ts
function createQueryClient(options: QueryClientOptions): QueryClient

interface QueryClientOptions {
  notify: (message: string) => void
  getErrorMessage: (error: unknown) => string
  defaultOptions?: DefaultOptions
}
```

Cria o `QueryClient` do app:

- **Padrões de cache:** `staleTime` de 30 s, `gcTime` de 5 min, `retry` 1 e sem refetch ao voltar o foco da janela. O `defaultOptions` sobrescreve os padrões (os testes desligam o retry) sem perder o tratamento de erro.
- **Notificação global de erro:** chama `notify(getErrorMessage(erro))` na falha de um refetch de uma query que já tem dados, e no erro de qualquer mutation. A falha da carga inicial não notifica: a tela a mostra.
- **Controle por `meta`:** `meta.silent` desliga a notificação; `meta.errorMessage` troca o texto.

### `ErrorMeta`

```ts
interface ErrorMeta {
  /** Texto da notificação no lugar da mensagem derivada do erro. */
  errorMessage?: string
  /** Sem notificação: a própria tela já mostra o erro. */
  silent?: boolean
}
```

O tipo do `meta` de toda query e mutation do projeto (o core o registra no `Register` do TanStack Query). Para acrescentar campos, estenda a interface por *declaration merging* no módulo `@matizze/prumo-core/query`; veja [Erros e notificações](../guides/errors-and-notifications.md#acrescentar-campos-ao-meta). O projeto não declara outro `Register`.

### `QueryProvider`

```tsx
function QueryProvider(props: { children: ReactNode; createClient: () => QueryClient }): ReactElement
```

O provedor do TanStack Query com um `QueryClient` novo por montagem, criado por `createClient`.

---

## i18n

O i18n de um app, sobre o i18next com ICU, ligado por uma única chamada e tipado pelas mensagens.

### `defineI18n(config)`

```ts
function defineI18n<M extends Record<string, MessageTree>, D extends keyof M & string>(
  config: I18nConfig<M, D>,
): I18nKit<M[D], keyof M & string>
```

**Configuração (`I18nConfig`):**

| Campo             | Tipo                                             | Padrão     | Descrição                                                                  |
| ----------------- | ------------------------------------------------ | ---------- | -------------------------------------------------------------------------- |
| `messages`        | `{ [idioma]: MessageTree }`                      | (obrigatório) | As mensagens de cada idioma, importadas estaticamente                   |
| `defaultLocale`   | um idioma de `messages`                          | (obrigatório) | O idioma padrão; as mensagens dele são a fonte dos tipos das chaves    |
| `languages`       | `{ [idioma]: { name, shortName } }`              | (obrigatório) | O nome de cada idioma para o seletor; a ordem das chaves é a do seletor |
| `storageKey`      | `string`                                         | `'locale'` | A chave do `localStorage` com o idioma escolhido                           |
| `rtlLocales`      | idiomas de `messages`                            | `[]`       | Idiomas escritos da direita para a esquerda                                |
| `defaultCurrency` | `string`                                         | `'BRL'`    | A moeda de `format.currency()` sem código                                  |

A inicialização é **síncrona**: o `t` funciona logo depois da chamada. O idioma é detectado pelo `localStorage` e depois pelo navegador, aproximado por `resolveLocale`; sem equivalente, vale o `defaultLocale`. O `<html lang>` e o `<html dir>` acompanham o idioma ativo.

**O kit (`I18nKit`):**

| Membro                         | Descrição                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `I18nProvider`                 | O provedor. Aceita `i18n` para usar outra instância (testes de detecção).                        |
| `useTranslations(namespace?)`  | O tradutor `t(key, values?)` de um namespace, com as chaves tipadas. Re-renderiza ao trocar o idioma. |
| `getTranslations(namespace?)`  | O mesmo, fora de componentes.                                                                   |
| `useLocale()` / `getLocale()`  | O idioma ativo, sempre um idioma suportado.                                                     |
| `useChangeLocale()`            | Devolve `(locale) => Promise`, que troca o idioma e o grava no `localStorage`.                  |
| `useFormat()` / `getFormat()`  | Os formatadores do idioma ativo (veja `createFormat`).                                          |
| `useFieldError()`              | Devolve `(error?: { message?: string }) => { message } \| undefined`: troca uma chave de texto pela tradução; texto que não é chave passa sem mudança. |
| `languages`                    | `{ id, name, shortName, dir }[]`, na ordem de `config.languages`.                               |
| `getLanguage(locale)`          | Os metadados de um idioma.                                                                      |
| `routing`                      | `{ locales, defaultLocale }`.                                                                   |
| `isLocale(value)`              | Se o valor é um idioma suportado (type guard).                                                  |
| `isRtl(locale)`                | Se o idioma é escrito da direita para a esquerda.                                               |
| `resolveLocale(code)`          | Aproxima um código para um idioma suportado.                                                    |
| `i18n`                         | A instância do i18next, criada na chamada.                                                      |
| `createI18n()`                 | Cria uma instância nova, para testes que exercitam a detecção do zero.                          |
| `LOCALE_STORAGE_KEY`           | A chave do `localStorage` em uso.                                                               |

```ts
export const { I18nProvider, useTranslations, useFormat, i18n } = defineI18n({
  messages: { 'pt-BR': ptBR, en },
  defaultLocale: 'pt-BR',
  languages: {
    'pt-BR': { name: 'Português (Brasil)', shortName: 'PT' },
    en: { name: 'English', shortName: 'EN' },
  },
})

const t = useTranslations('clientes')
t('title')
t('count', { count: 3 })
```

### `createFormat(locale, options?)`

```ts
function createFormat<L extends string>(locale: L, options?: { defaultCurrency?: string }): Format<L>
```

Formatadores `Intl` ligados a um idioma, com as instâncias reaproveitadas por idioma e opções. Em componentes, prefira o `useFormat()` do kit.

| Formatador                              | Exemplo (`pt-BR`)                                   |
| --------------------------------------- | --------------------------------------------------- |
| `number(value, options?)`               | `1234.5` → `1.234,5`                                |
| `compact(value, options?)`              | `12400` → `12 mil`                                  |
| `percent(value, options?)`              | `0.253` → `25,3%` (o valor é uma fração)            |
| `currency(value, currency?, options?)`  | `99.9` → `R$ 99,90`; com `'USD'`, `US$ 99,90`       |
| `date(value, options?)`                 | `22 de nov. de 2026` (padrão `dateStyle: 'medium'`) |
| `dateTime(value, options?)`             | `22 de nov. de 2026, 14:30`                         |
| `time(value, options?)`                 | `14:30`                                             |
| `relative(value, now?)`                 | `há 1 hora`, `amanhã`: a maior unidade que cabe     |

Os formatadores de data aceitam `Date`, número ou texto ISO. Texto só com a data (`AAAA-MM-DD`) é lido como **data local** (o dia escrito, em qualquer fuso; uma data que não existe, como `2026-02-31`, é inválida); texto com hora, `Date` e número são um instante, mostrado no fuso local.

### `resolveLocale(code, supported)`

```ts
function resolveLocale(code: string, supported: readonly string[]): string
```

Converte um código do navegador ou do `localStorage` num idioma suportado: primeiro a igualdade sem diferença de caixa (`pt-br` → `pt-BR`), depois a mesma língua-base (`pt` e `pt-PT` → `pt-BR`; `en-US` → `en`). Sem equivalente, devolve o código sem mudança.

### Tipos

| Tipo                      | Descrição                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `MessageTree`             | Objetos aninhados cujas folhas são textos: o formato dos JSONs de mensagens.                    |
| `NamespaceOf<M>`          | Os namespaces válidos de `M` (`'clientes'`, `'clientes.form'`).                                  |
| `MessageKeyOf<M, N>`      | As chaves válidas dentro de um namespace.                                                       |
| `TranslatorOf<M, N>`      | `(key: MessageKeyOf<M, N>, values?: TranslationValues) => string`.                              |
| `TranslationValues`       | `Record<string, string \| number \| Date>`: os valores das variáveis ICU.                       |
| `LanguageOf<L>`           | `{ id: L; name: string; shortName: string; dir: 'ltr' \| 'rtl' }`.                               |
| `Format<L>`               | O que `createFormat` devolve.                                                                   |

---

## errors

### `UIError`

```ts
class UIError extends Error {
  code: string
  params?: Record<string, unknown>
  constructor(code: string, message: string, params?: Record<string, unknown>)
}
```

Um erro que pode chegar à interface. O repositório lança um `UIError` com um código estável (`CLIENTE_NOT_FOUND`), e a interface mostra o texto da chave `errors.<CODE>` no idioma ativo. A `message` é para logs e testes, nunca para a tela. O `name` é `'UIError'`.

`params` (opcional) leva os valores que o texto precisa: `new UIError('LOAN_LIMIT', 'limite', { limite: 3 })` com `"LOAN_LIMIT": "Você já tem {limite} livros emprestados"`. Quem cria `new UIError(code, message)` não muda nada.

### `createErrorMessage(i18n, options?)`

```ts
function createErrorMessage(
  i18n: i18n,
  options?: { prefix?: string; fallbackKey?: string },
): (error: unknown, params?: Record<string, unknown>) => string
```

Cria o `getErrorMessage` do app: o texto de um erro no idioma ativo da instância. Aceita um `UIError` **ou um código solto** (`getErrorMessage('LOAN_LIMIT', { limite: 3 })`, para o motivo de um botão desligado, sem montar um `UIError`). O segundo argumento são os valores do texto (variáveis ICU); eles valem mais que os `params` do `UIError`.

| Erro                                  | Texto                                       |
| ------------------------------------- | ------------------------------------------- |
| `UIError` cuja chave `<prefix><code>` existe | A tradução dessa chave               |
| Texto (código solto) cuja chave `<prefix><texto>` existe | A tradução dessa chave  |
| `UIError` ou texto sem tradução, ou outro erro | A tradução de `fallbackKey`        |

Padrões: `prefix: 'errors.'` e `fallbackKey: 'errors.generic'`. Na criação, confere que a `fallbackKey` existe nas mensagens da instância e **lança um erro** se não existir. A instância precisa estar inicializada (a do `defineI18n` já está).

---

## data

### `pageSchema(item)`

```ts
function pageSchema<T extends z.ZodType>(item: T) // o schema de { items: T[]; total: number }
```

O schema zod de uma página de listagem: `{ items, total }`, com `total` inteiro. Use para validar a resposta de uma API.

### Tipos

| Tipo               | Definição                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `Page<T>`          | `{ items: T[]; total: number }`. `total` conta todos os itens que casam com a consulta, sem paginar. |
| `PageQuery`        | `{ page?: number; page_size?: number }`. `page` começa em 1; sem `page_size`, a consulta devolve tudo. |
| `Sort<K>`          | `{ key: K; direction: SortDirection }`.                                                         |
| `SortDirection`    | `'asc' \| 'desc'`.                                                                              |
| `DateRange`        | `{ from: string; to: string }`: datas ISO (AAAA-MM-DD), inclusivo.                              |

---

## date

Datas `AAAA-MM-DD` sem depender do fuso, para o código de produção (as regras de negócio) e para os mocks.

| Função                       | Descrição                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `addDays(isoDate, days)`     | Soma dias a uma data ISO e devolve `AAAA-MM-DD`, em UTC (`days` negativo volta no tempo).                      |
| `daysBetween(from, to)`      | Quantos dias há de `from` até `to`: positivo quando `to` é depois. Só a data conta; o horário de verão não interfere. |
| `parseLocalDate(value)`      | O `Date` à meia-noite **local** quando `value` é `AAAA-MM-DD`; `Date`, número e texto com hora seguem o `Date`. Data inexistente vira `Invalid Date`. É o que o `format.date` usa. |

```ts
import { addDays, daysBetween } from '@matizze/prumo-core/date'

const dueDate = addDays('2026-11-22', 14) // '2026-12-06'
const lateDays = daysBetween(dueDate, '2026-12-10') // 4
```

---

## mock

Utilitários para os repositórios em memória.

| Função                                          | Descrição                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `wait(ms)`                                      | Espera `ms` milissegundos (a latência simulada).                                                           |
| `normalize(text)`                               | Minúsculas, sem acentos e sem espaços nas pontas: `' Ação '` → `'acao'`.                                    |
| `matchesSearch(fields, search?)`                | Verdadeiro quando `search` está vazio ou aparece em algum dos campos, sem diferenciar maiúsculas e acentos. |
| `sortBy(items, sort, accessors, { locale? })`   | Uma cópia ordenada; sem `sort`, a ordem original. Números pelo valor; texto pelo idioma (padrão `'pt-BR'`), com números naturais ("Item 9" antes de "Item 10"). |
| `paginate(items, page?, pageSize?)`             | Um `Page<T>`: a fatia da página (que começa em 1) e o `total` de antes da fatia. Sem `pageSize`, tudo.     |
| `sum(values)`                                   | A soma de uma lista de números.                                                                             |
| `addDays(isoDate, days)`                        | Soma dias a uma data ISO e devolve `AAAA-MM-DD`, em UTC. Mora em [`/date`](#date); segue exportado aqui por compatibilidade. |

```ts
async list(query: ClienteListQuery = {}): Promise<Page<ClienteSchema>> {
  await wait(this.latencyMs)
  const filtered = this.items.filter((item) => matchesSearch([item.name], query.search))
  const sorted = sortBy(filtered, query.sort, {
    name: (item) => item.name,
    createdAt: (item) => item.createdAt,
  })
  return paginate(sorted, query.page, query.page_size)
}
```

---

## auth

### `AuthGuard`

```tsx
function AuthGuard(props: AuthGuardProps): ReactElement | null

interface AuthGuardProps {
  children: ReactNode
  isAuthenticated: boolean
  isLoading: boolean
  redirectTo?: string   // padrão: '/login'
  keepOrigin?: boolean  // padrão: false
  fallback?: ReactNode  // padrão: null
}
```

Guarda de rota: mostra `children` só com a sessão aberta.

- Enquanto `isLoading`, mostra o `fallback` e não redireciona.
- Sem sessão, não mostra nada e navega para `redirectTo` **trocando** a entrada atual do histórico, para o "voltar" não cair de novo na rota protegida.

O guarda não conhece a autenticação do produto: o produto passa o estado da sessão. Usa o `useLocation` do wouter. Veja [Telas](../guides/pages.md#rotas-protegidas).

Com `keepOrigin`, o guarda leva a rota pedida (caminho e query) até o login, no parâmetro `next`: de `/clientes?page=2` para `/login?next=%2Fclientes%3Fpage%3D2`. Sem ele, o redirecionamento é só `redirectTo`, como sempre foi. Se o guarda já está na rota do login, não anexa a origem de novo.

### `useAuthOrigin(fallback?, param?)`

```ts
function useAuthOrigin(fallback = '/', param = 'next'): string
```

Para a tela de login: a rota guardada em `?next=`, já conferida, ou `fallback` quando não há ou não é segura. Só vale caminho relativo do próprio app.

### `safeRedirectPath(value, fallback?)`, `buildLoginRedirect(redirectTo, origin, param?)`, `readOrigin(search, fallback?, param?)`

```ts
function safeRedirectPath(value: string | null | undefined, fallback = '/'): string
function buildLoginRedirect(redirectTo: string, origin: string, param = 'next'): string
function readOrigin(search: string, fallback = '/', param = 'next'): string
```

Os ajudantes puros por trás do guarda e do hook, para quem lê a origem fora do React.

- `safeRedirectPath` devolve `value` só se começar com `/` e for do próprio app; recusa `https://…`, `//…`, barra invertida, `javascript:` e caracteres de controle (redirecionamento aberto) e devolve `fallback`.
- `buildLoginRedirect` anexa a origem codificada ao `redirectTo` (descarta uma origem insegura).
- `readOrigin` lê o parâmetro de uma query (com ou sem `?`) e devolve um caminho seguro ou `fallback`.
