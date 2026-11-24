# Anatomia do app gerado

Este documento descreve, arquivo por arquivo, o app que o `prumo new` cria e o que os geradores acrescentam depois. Leia para saber o que cada arquivo faz, o que você pode mudar à vontade e quais pontos os geradores precisam encontrar.

## Visão geral

```text
meu-app/
  .gitignore
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
    providers/
      app.tsx                     QueryClient, i18n e repositórios
      repository/index.ts         RepositoryProvider e useRepositories
    pages/home/                   a tela inicial, na rota /
      index.tsx  model.ts  view.tsx  index.test.tsx
    messages/
      pt-BR/index.ts  pt-BR/errors.json  pt-BR/home.json                 ← ponto de registro
      en/index.ts     en/errors.json     en/home.json                    ← ponto de registro
    repositories/
      index.ts                    o container                          ← ponto de registro
      options.ts                  as fontes de dados
    schemas/index.ts              índice dos schemas                   ← ponto de registro
    queries/index.ts              índice das queries                   ← ponto de registro
    test/
      render.tsx                  renderWithProviders e renderHookWithProviders
      setup.ts                    setup do Vitest (idioma fixado em pt-BR)
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

As configurações recomendadas do ESLint, do typescript-eslint e do `react-hooks`, mais `prumo.configs.recommended`, que liga as regras `prumo/no-cross-page-import` e `prumo/page-structure`.

### `AGENTS.md`

O `AGENTS.md` descreve as camadas, os comandos e as regras do projeto para agentes de IA. Veja o guia [Agentes de IA](../guides/ai-agents.md).

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

O `make:domain` acrescenta ao `errors.json` de cada idioma o texto de `<ENTIDADE>_NOT_FOUND`, o código que o mock gerado lança.

### `src/providers/app.tsx`

Envolve o app com o `QueryProvider` (o `QueryClient` do core, com cache de 30 s e notificação global de erro), o `I18nProvider` e o `RepositoryProvider`:

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

### `src/providers/repository/index.ts`

Cria o contexto de repositórios, tipado pelo container do app:

```ts
export const { RepositoryProvider, useRepositories } =
  createRepositoryContext<RepositoryContainer>(createRepositories)
```

Os hooks das queries pegam o repositório de `useRepositories()`. Os testes passam outro container ao `RepositoryProvider`.

### `src/repositories/index.ts` e `options.ts`

O container: um mapa de fábricas, uma por domínio, e a função que cria todos os repositórios com as mesmas opções.

```ts
const factories = {
  clientes: createClientesRepository,
}

export type RepositoryContainer = RepositoryContainerOf<typeof factories>

export function createRepositories(options: Partial<RepositoryOptions> = {}): RepositoryContainer {
  const dataSource =
    options.dataSource ??
    resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')
  return createRepositoryContainer(factories, { ...options, dataSource })
}
```

O tipo do container sai do mapa, então registrar um domínio é acrescentar uma linha. A fonte vem da `VITE_DATA_SOURCE` (`mock` quando falta; um valor fora de `DATA_SOURCES` lança erro), e o `src/vite-env.d.ts` declara essa variável e a `VITE_API_URL`. O `options.ts` declara as fontes de dados (`DATA_SOURCES = ['mock']`): o `prumo make:repository <domínio> --data-source http|storage` acrescenta a fonte aí (veja [Ligar uma API real](../guides/real-api.md)).

### `src/test/render.tsx` e `setup.ts`

O `renderWithProviders` e o `renderHookWithProviders` (para testar hooks) do app, criados com o `createRenderWithProviders` e o `createRenderHookWithProviders` do `@matizze/prumo-testing`: renderiza com o i18n, um container de repositórios `mock` (em memória) **sem latência**, um `QueryClient` **sem retry** e uma rota em memória. O `setup.ts` fixa o idioma padrão do app (`pt-BR`, já que o jsdom diz `en-US`) e desmonta os componentes depois de cada teste. Veja [Testes](../guides/test.md).

## O que cada gerador acrescenta

### `prumo make:page <tela>`

```text
src/pages/<tela>/index.tsx         a rota: chama o model e entrega à view
src/pages/<tela>/model.ts          use<Tela>Model: os textos (e, com --domain, a lista)
src/pages/<tela>/view.tsx          <Tela>View: HTML semântico, recebe o model por props
src/pages/<tela>/index.test.tsx    renderiza a tela e confere o título
src/messages/<idioma>/<tela>.json  os textos, em cada idioma do projeto
```

Altera `src/App.tsx` (a rota `/<tela>`, ou a de `--path`) e o `index.ts` de cada idioma (o namespace).

### `prumo make:domain <domínio> [--fields <campos>]`

```text
src/schemas/entities/<entidade>.ts                   schema zod e tipos
src/repositories/<domínio>/repository.contract.ts    a interface I<Domínio>Repository
src/repositories/<domínio>/repository.mock.ts        a implementação em memória
src/repositories/<domínio>/fixtures.ts               os dados de exemplo
src/repositories/<domínio>/index.ts                  a fábrica create<Domínio>Repository
src/repositories/<domínio>/repository.contract.test.ts  o teste de contrato
src/queries/<domínio>.ts                             query keys, queries e hooks
```

Com `--fields "titulo:string,ano:number"`, o schema, as fixtures, o mock e o teste de contrato saem com esses campos em vez de `name` (veja [Domínios](../guides/domains.md#os-campos-do-domínio---fields)). Altera `src/schemas/index.ts`, `src/repositories/index.ts` (import, `export *` e a entrada no mapa `factories`) e `src/queries/index.ts`, e acrescenta `<ENTIDADE>_NOT_FOUND` ao `src/messages/<idioma>/errors.json` de cada idioma (a chave que já existe fica como está). Num app criado por uma versão anterior do `new`, sem o `errors.json`, o comando avisa e segue, sem falhar: veja [Erros e notificações](../guides/errors-and-notifications.md#app-criado-antes-do-tratamento-de-erro).

### `prumo make:component <nome>`

```text
src/pages/<tela>/components/<nome>.tsx        com --page <tela>
src/pages/<tela>/components/<nome>.test.tsx
src/components/shared/<nome>.tsx              com --shared
src/components/shared/<nome>.test.tsx
```

Não altera nenhum arquivo existente.

## Pontos de registro

Os geradores editam alguns arquivos pela árvore de sintaxe do TypeScript (com o ts-morph), não por texto solto. Eles toleram formatação diferente, comentários e código seu em volta, mas precisam encontrar certas formas. Se você reescrever um desses arquivos, mantenha:

| Arquivo                         | O que o gerador procura                                                                                         | Usado por      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------- |
| `src/App.tsx`                   | Um `<Switch>` (o mais externo do arquivo) com as rotas. A rota nova entra depois da última `<Route>` com `path`; uma rota curinga, sem `path`, continua por último. | `make:page`    |
| `src/messages/<idioma>/index.ts` | `import <namespace> from './<tela>.json'` e um `export default { ... }` com os namespaces. Um idioma é uma pasta com `index.ts`. | `make:page`    |
| `src/repositories/index.ts`     | O mapa `const factories = { ... }`, os imports relativos dos domínios e os `export *`.                          | `make:domain`  |
| `src/schemas/index.ts`          | Um arquivo de `export * from './entities/<entidade>'` (pode começar vazio).                                    | `make:domain`  |
| `src/queries/index.ts`          | Um arquivo de `export { ... } from './<domínio>'` (pode começar vazio).                                        | `make:domain`  |

Além desses, o código gerado importa alguns módulos do app, que precisam existir com esses nomes:

| Import                                    | Quem usa                         |
| ----------------------------------------- | -------------------------------- |
| `useTranslations` de `@/i18n`             | o model de toda tela             |
| `renderWithProviders` de `@/test/render`  | o teste de toda tela             |
| `useRepositories` de `@/providers/repository` | as queries de todo domínio   |
| `RepositoryOptions` de `src/repositories/options.ts` | a fábrica de todo domínio |
| `use<Domínio>List` de `@/queries/<domínio>` | o model de uma tela com `--domain` |

Quando um ponto de registro falta ou não tem a forma esperada, o gerador recusa com uma mensagem clara e código de saída 2, **sem escrever nada**: todas as mudanças são montadas em memória e só vão para o disco se nada falhar.

## O que você pode mudar à vontade

- O conteúdo de qualquer tela, domínio ou componente gerado: o model, a view, o schema, as fixtures, o mock, os testes.
- O caminho de uma rota no `App.tsx` (`/clientes` para `/clientes/:id`, por exemplo), e envolver o `<Switch>` com a casca do layout.
- O `providers/app.tsx`: a notificação, a tradução do erro, provedores novos (tema, autenticação: veja [Sessão e login](../guides/auth.md), que põe a sessão em `src/providers/session/`).
- O `eslint.config.js`, o `vite.config.ts` e o `tsconfig.json`, mantendo o plugin do Prumo e o alias `@/`.
- O `AGENTS.md`, com as regras do seu time.
