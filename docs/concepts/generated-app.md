# Anatomia do app gerado

Este documento descreve, arquivo por arquivo, o app que o `prumo new` cria e o que os geradores acrescentam depois. Leia para saber o que cada arquivo faz, o que você pode mudar à vontade e quais pontos os geradores precisam encontrar.

## Visão geral

```text
meu-app/
  .gitignore
  .mcp.json                       registra o servidor MCP do Prumo para agentes de IA
  AGENTS.md                       guia do projeto para agentes de IA
  README.md
  eslint.config.js                ESLint com o plugin do Prumo
  index.html
  package.json                    scripts e dependências fixadas
  tsconfig.json                   TypeScript estrito, alias @/
  vite.config.ts                  Vite e Vitest (jsdom)
  src/
    main.tsx                      monta o app
    App.tsx                       as rotas                              ← ponto de registro
    i18n.ts                       o i18n tipado (exporta também a instância i18n)
    errors.ts                     getErrorMessage: o texto traduzido de um erro
    http/
      api.ts                      a instância da API (createHttp, VITE_API_URL)
      errors.ts                   withErrors: o HttpError vira UIError (NOT_FOUND, UNAUTHORIZED...)
      errors.test.ts              o teste da tradução
    providers/
      app.tsx                     QueryClient, i18n e use cases
      use-cases/index.ts          UseCasesProvider e useUseCases
    pages/home/                   a tela inicial, na rota /
      index.tsx  model.ts  view.tsx  index.test.tsx
    messages/
      pt-BR/index.ts  pt-BR/errors.json  pt-BR/home.json                 ← ponto de registro
      en/index.ts     en/errors.json     en/home.json                    ← ponto de registro
    use-cases/
      index.ts                    o registro: createUseCases, mockRoutes   ← ponto de registro
      deps.ts                     as dependências dos use cases (http e storage)
      options.ts                  as fontes de dados (mock e http)
    schemas/index.ts              índice dos schemas                   ← ponto de registro
    test/
      render.tsx                  renderWithProviders e renderHookWithProviders
      setup.ts                    setup do Vitest (idioma fixado em pt-BR)
```

Os comandos `make:*` acrescentam as camadas de cima a esse esqueleto. Depois de um `make:schema livros`, de um `make:usecase livros --crud` e `make:usecase auth.sign-in`, e de um `make:page livros --usecase livros.list-livros` e `make:page auth.login --usecase auth.sign-in`, o app fica assim (só o que mudou):

```text
  src/
    App.tsx                         as rotas /livros e /auth/login
    http/api.ts                     a camada de baixo: a instância da API
    schemas/
      index.ts                      export * from './entities/livro'
      entities/livro.ts             livroSchema, livroInputSchema, LivroListQuery...
    use-cases/
      index.ts                      o registro: createUseCases e mockRoutes
      auth/
        index.ts                    createAuthUseCases(deps) e authRoutes
        types/sign-in.ts            ENDPOINT, SignInRequest e SignInResponse (zod)
        services/sign-in.usecase.ts SignInUseCase (execute)
        services/sign-in.usecase.test.ts  o teste, contra o mock (e contra a API, com API_TEST_URL)
        mocks/sign-in.ts            a resposta de mentira do ENDPOINT
      livros/
        index.ts                    createLivrosUseCases(deps) e livrosRoutes
        mocks/collection.ts         os dados de exemplo e a coleção em memória dos cinco mocks
        types/{list-livros,get-livro,create-livro,update-livro,remove-livro}.ts
        services/{list-livros,...}.usecase.ts  e  .usecase.test.ts
        mocks/{list-livros,...}.ts
    pages/
      auth/login/                   a tela em subpasta (a pasta auth só agrupa): index, model, view e teste
      livros/                       a lista: index, model, view e teste
    messages/<idioma>/
      auth-login.json  livros.json  os textos das telas
      errors.json                   um texto por código de erro (NOT_FOUND, REQUEST_FAILED...)
```

Os arquivos marcados como **ponto de registro** são os que os geradores editam para ligar o que criam (uma rota, um namespace de textos, um domínio). Você pode editá-los, desde que mantenha a forma descrita em [Pontos de registro](#pontos-de-registro).

## Configuração

### `package.json`

```json
{
  "packageManager": "pnpm@10.x.x",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc",
    "lint": "eslint .",
    "check": "prumo check",
    "test": "vitest run",
    "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm check"
  }
}
```

- O `verify` roda os testes antes do `check`: um componente `shared` recém-gerado, por exemplo, faz o `check` falhar (a `shared-usage` é esperada), e os testes rodam mesmo assim. O `verify` continua falhando se o `check` falhar.
- O `packageManager` fixa a versão do pnpm que criou o app.
- As bibliotecas de terceiros entram com versões fixadas pelos modelos do Prumo, e os quatro pacotes `@matizze/prumo-*` como `^<versão>`.
- Dependências de execução: `@matizze/prumo-core`, React, React DOM, wouter, TanStack Query, zod, i18next, react-i18next, `i18next-icu` e `i18next-browser-languagedetector`.
- Dependências de desenvolvimento: os outros três pacotes do Prumo (`cli`, `rules`, `testing`), Vite, Vitest, jsdom, Testing Library, ESLint, typescript-eslint e TypeScript.

### `tsconfig.json`

TypeScript estrito, com `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` e `verbatimModuleSyntax`. O alias `@/*` aponta para `src/*`. Na prática:

- importe tipos com `import type`;
- não use `enum`, `namespace` nem propriedades no construtor (`constructor(private x)`), que não são sintaxe apagável;
- acesso por índice (`items[0]`) é `T | undefined`.

### `vite.config.ts`

O plugin do React, o alias `@` e a configuração do Vitest: ambiente `jsdom`, `setupFiles: ['./src/test/setup.ts']` e testes em `src/**/*.test.{ts,tsx}`.

### `eslint.config.js`

As configurações recomendadas do ESLint, do typescript-eslint e do `react-hooks`, mais `prumo.configs.recommended`, que liga as regras de camada `prumo/no-cross-page-import`, `prumo/page-structure`, `prumo/no-http-in-page` e `prumo/use-case-imports`.

### `.mcp.json`

O `.mcp.json` registra o servidor MCP `prumo` (`pnpm exec prumo mcp`, por stdio) para os agentes de IA que leem esse arquivo na raiz do projeto. O servidor oferece como ferramentas os geradores (`make_schema`, `make_usecase` e `make_page`), o `check` e o `list`. Veja [`prumo mcp`](../reference/cli.md#prumo-mcp).

### `AGENTS.md`

O `AGENTS.md` descreve as camadas, os comandos e o servidor MCP para agentes de IA. Veja o guia [Agentes de IA](../guides/ai-agents.md).

## O código

### `src/main.tsx` e `src/App.tsx`

O `main.tsx` monta o `<App />` dentro do `<AppProvider>`. O `App.tsx` declara as rotas com o `<Switch>` do wouter:

```tsx
import { Route, Switch } from 'wouter'
import HomePage from '@/pages/home'

export default function App() {
  return (
    <Switch>
      <Route path="/">
        <HomePage />
      </Route>
    </Switch>
  )
}
```

### `src/i18n.ts`

Liga o i18n ao app com o `defineI18n` do core. As mensagens do idioma padrão (`pt-BR`) são a fonte dos tipos: o `useTranslations` só aceita namespaces e chaves que existem nelas.

```ts
export const { I18nProvider, useTranslations, i18n } = defineI18n({
  messages: { 'pt-BR': ptBR, en },
  defaultLocale: 'pt-BR',
  languages: {
    'pt-BR': { name: 'Português (Brasil)', shortName: 'PT' },
    en: { name: 'English', shortName: 'EN' },
  },
})
```

O `defineI18n` devolve mais do que o app exporta de início: `useFormat`, `useLocale`, `useChangeLocale`, `useFieldError` e outros (a instância `i18n` já é exportada, para o `src/errors.ts` e o setup dos testes). Exporte o que for usar. Veja [Textos e idiomas](../guides/i18n.md).

### `src/errors.ts` e as mensagens de erro

O tratamento de erro já vem ligado, como o guia [Erros e notificações](../guides/errors-and-notifications.md) manda: o namespace `errors` nos dois idiomas (`src/messages/<idioma>/errors.json`, com o texto genérico `generic`) e o `getErrorMessage` do app, criado com o `createErrorMessage` do core a partir da instância `i18n`:

```ts
export const getErrorMessage = createErrorMessage(i18n)
```

O `errors.json` já traz o texto dos códigos genéricos que o `http` do app lança (`INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` e `REQUEST_FAILED`), e o `make:usecase` não o altera: os use cases não tratam erro, e quem traduz o status em código é o `src/http/errors.ts`.

### `src/providers/app.tsx`

Envolve o app com o `QueryProvider` (o `QueryClient` do core, com cache de 30 s e notificação global de erro), o `I18nProvider` e o `UseCasesProvider`:

```tsx
function createClient() {
  return createQueryClient({
    // Sem interface no projeto, o erro vai para o console: troque pela notificação do seu design system
    notify: (message) => console.error(message),
    getErrorMessage,
  })
}
```

O `getErrorMessage` vem do `src/errors.ts` e traduz o código do erro (nunca mostra o texto técnico). O `notify` é o ponto que o produto troca: a notificação do design system. Veja [Erros e notificações](../guides/errors-and-notifications.md).

### `src/http/api.ts`

A instância da API, criada com o `createHttp` do `@matizze/prumo-core/http`: o endereço vem da `VITE_API_URL` (padrão `/api`, o mesmo domínio do app; vazia vale como ausente), e um comentário mostra onde ligar a sessão (o token e a renovação depois de um 401) quando o app tiver login. O registro de use cases a usa quando a fonte é `http`.

### Os use cases

O registro dos use cases, como o `createAllServices` do pratigo:

```ts
export function createUseCases(deps: UseCaseDeps) {
  return {
    ...createAuthUseCases(deps),
    ...createLivrosUseCases(deps),
  }
}

export type UseCases = ReturnType<typeof createUseCases>

export function createAppUseCases(options: Partial<UseCaseOptions> = {}): UseCases {
  const dataSource =
    options.dataSource ??
    resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')
  const http =
    dataSource === 'http' ? api : createMockHttp(mockRoutes, { latencyMs: options.latencyMs ?? 300 })
  return createUseCases({ http, storage: localStorage })
}
```

- **`createUseCases(deps)`** espalha o `create<Domínio>UseCases(deps)` de cada domínio, e o tipo `UseCases` sai dele: registrar um domínio é acrescentar uma linha. As `deps` (`deps.ts`) são o `http` (o transporte) e o `storage` (a Web Storage API, para os use cases `--local`).
- **`mockRoutes`** junta as rotas de mock de todos os domínios (`...authRoutes`, `...livrosRoutes`).
- **`createAppUseCases(options)`** monta o container: a fonte vem da `VITE_DATA_SOURCE`: `http` usa a API, `mock` (o padrão, sem a variável) usa o `http` de mentira, e qualquer outro valor lança o erro do `resolveDataSource`. No `mock`, o `http` é o `createMockHttp(mockRoutes, { latencyMs })`, e no `http`, a instância `api`; os dois passam pelo `withErrors` (`src/http/errors.ts`), então lançam os mesmos erros. O código dos use cases é o mesmo nos dois (o mock fica no transporte, não no use case).
- **`UseCasesProvider` e `useUseCases()`** (`src/providers/use-cases/index.ts`), do `createUseCasesContext` do core, entregam o container às telas. Os testes passam outro ao `UseCasesProvider`, ou trocam um use case pelo `useCases` do `renderWithProviders`.

Cada domínio tem a pasta `src/use-cases/<domínio>/`, criada pelo [`prumo make:usecase`](../reference/cli.md#prumo-makeusecase) com o primeiro use case dele: o `index.ts` (`create<Domínio>UseCases(deps)` e `<domínio>Routes`) e, por ação, `types/<ação>.ts`, `services/<ação>.usecase.ts`, `mocks/<ação>.ts` e `services/<ação>.usecase.test.ts`.

### `src/test/render.tsx` e `setup.ts`

O `renderWithProviders` e o `renderHookWithProviders` (para testar hooks) do app, criados com o `createRenderWithProviders` e o `createRenderHookWithProviders` do `@matizze/prumo-testing`: renderiza com o i18n, os use cases sobre o `http` de mentira (`mock`) **sem latência**, um `QueryClient` **sem retry** e uma rota em memória. O `setup.ts` fixa o idioma padrão do app (`pt-BR`, já que o jsdom diz `en-US`) e desmonta os componentes depois de cada teste. Veja [Testes](../guides/test.md).

## O que cada comando acrescenta

### `prumo make:page <tela>`

```text
src/pages/<tela>/index.tsx         a rota: chama o model e entrega à view
src/pages/<tela>/model.ts          use<Tela>Model: os textos (e, com --usecase, os dados do use case)
src/pages/<tela>/view.tsx          <Tela>View: HTML semântico, recebe o model por props
src/pages/<tela>/index.test.tsx    renderiza a tela e confere o título
src/messages/<idioma>/<tela>.json  os textos, em cada idioma do projeto
```

Altera `src/App.tsx` (a rota `/<tela>`, ou a de `--path`) e o `index.ts` de cada idioma (o namespace).

Com `prumo make:page auth.login` (ou `auth/login`), a tela fica em `src/pages/auth/login/`, a rota é `/auth/login`, o componente é `AuthLoginPage` e as mensagens são `src/messages/<idioma>/auth-login.json`.

### `prumo make:schema <domínio> [--entity <singular>] [--fields <campos>]`

```text
src/schemas/entities/<entidade>.ts   o schema zod, o de entrada, os tipos, a SortKey e a ListQuery
```

Altera `src/schemas/index.ts` (um `export *`). Com `--fields "titulo:string,ano:int"`, o schema sai com esses campos em vez de `name` (veja [Use cases](../guides/use-cases.md#os-campos-do-schema---fields)).

### `prumo make:usecase <domínio.ação> [--input ...] [--output ...] [--endpoint ...] [--local]`

```text
src/use-cases/<domínio>/types/<ação>.ts                  ENDPOINT, <Ação>Request, <Ação>Response e (na leitura) a chave de cache
src/use-cases/<domínio>/services/<ação>.usecase.ts       a classe <Ação>UseCase
src/use-cases/<domínio>/services/<ação>.usecase.test.ts  o teste, contra o mock e, com API_TEST_URL, contra a API
src/use-cases/<domínio>/mocks/<ação>.ts                  a rota de mock do ENDPOINT (fora do --local)
src/use-cases/<domínio>/index.ts                         create<Domínio>UseCases e <domínio>Routes (com o primeiro use case do domínio)
```

Altera o `index.ts` do domínio e o `src/use-cases/index.ts` (import, `...create<Domínio>UseCases(deps)` e `...<domínio>Routes`, em ordem alfabética) (não mexe nos `errors.json`). Veja a [referência](../reference/cli.md#prumo-makeusecase).

### `prumo make:usecase <domínio> --crud [--entity <singular>]`

```text
src/use-cases/<domínio>/{types,services,mocks}/{list,get,create,update,remove}-<entidade>.*  os cinco use cases, com os quatro arquivos de sempre
src/use-cases/<domínio>/mocks/collection.ts                                                   as fixtures e a coleção em memória que os mocks dividem
```

Precisa do schema e lê os campos dele. Altera o registro como o `make:usecase`.

## Pontos de registro

Os geradores editam alguns arquivos pela árvore de sintaxe do TypeScript (com o ts-morph), não por texto solto. Eles toleram formatação diferente, comentários e código seu em volta, mas precisam encontrar certas formas. Se você reescrever um desses arquivos, mantenha:

| Arquivo                         | O que o gerador procura                                                                                         | Usado por      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------- |
| `src/App.tsx`                   | Um `<Switch>` (o mais externo do arquivo) com as rotas. A rota nova entra depois da última `<Route>` com `path`; uma rota curinga, sem `path`, continua por último. | `make:page`    |
| `src/messages/<idioma>/index.ts` | `import <namespace> from './<tela>.json'` e um `export default { ... }` com os namespaces. Um idioma é uma pasta com `index.ts`. | `make:page`    |
| `src/use-cases/index.ts`        | O `const mockRoutes = { ... }` e a função `createUseCases` terminando em `return { ... }`, mais os imports relativos dos domínios. | `make:usecase` |
| `src/use-cases/<domínio>/index.ts` | A função `create<Domínio>UseCases` terminando em `return { ... }` e o `const <domínio>Routes = { ... }`.     | `make:usecase` |
| `src/schemas/index.ts`          | Um arquivo de `export * from './entities/<entidade>'` (pode começar vazio).                                    | `make:schema`  |

Além desses, o código gerado importa alguns módulos do app, que precisam existir com esses nomes:

| Import                                    | Quem usa                         |
| ----------------------------------------- | -------------------------------- |
| `useTranslations` de `@/i18n`             | o model de toda tela             |
| `renderWithProviders` de `@/test/render`  | o teste de toda tela             |
| `useUseCases` de `@/providers/use-cases` | o model das telas de use case |

Quando um ponto de registro falta ou não tem a forma esperada, o gerador recusa com uma mensagem clara e código de saída 2, **sem escrever nada**: todas as mudanças são montadas em memória e só vão para o disco se nada falhar.

## O que você pode mudar à vontade

- O conteúdo de qualquer tela, domínio ou componente gerado: o model, a view, o schema, as fixtures, o mock, os testes.
- O caminho de uma rota no `App.tsx` (`/clientes` para `/clientes/:id`, por exemplo), e envolver o `<Switch>` com a casca do layout.
- O `providers/app.tsx`: a notificação, a tradução do erro, provedores novos (tema, autenticação: veja [Login e sessão](../guides/auth.md), que põe a sessão em `src/providers/session/`).
- O `eslint.config.js`, o `vite.config.ts` e o `tsconfig.json`, mantendo o plugin do Prumo e o alias `@/`.
- O `AGENTS.md`, com as regras do seu time.
