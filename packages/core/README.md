# @matizze/prumo-core

Infraestrutura comum dos produtos do Prumo: container de repositórios, query keys, tipo Page, utilitários de mock, i18n, erros com código, guarda de login e provedor de query.

**Situação:** Fase 1, extração concluída: os sete módulos abaixo vieram do app de referência (`apps/reference`), que agora importa deles. O plano está em [docs/fase-1.md](../../docs/fase-1.md). Fase 3, passo B: o pacote ganhou o build com o `tsc` e sai empacotado com `dist/`, pronto para a publicação (que ainda não aconteceu).

## Build e empacotamento

No workspace, o `exports` do pacote aponta para o código-fonte (`src/*.ts`). Fora do monorepo o Node não faz type stripping dentro de `node_modules`, então o pacote tem `tsconfig.build.json` e o script `build` (`pnpm --filter @matizze/prumo-core run build`), que emite o `dist/` com `.js` e `.d.ts` (sem os testes, as fixtures e os arquivos de apoio deles). O `publishConfig` do `package.json` troca `exports` para o `dist/` e define o registry `https://npm.pkg.github.com` (acesso restrito); o `pnpm pack` aplica essa troca, e o tarball leva só o `dist/`, o `package.json` e o README. O pacote continua `"private": true`: nada é publicado até uma pessoa tirar o `private` e fazer a primeira publicação (o que falta está em [.changeset/README.md](../../.changeset/README.md#o-que-falta-para-publicar)). `pnpm pack:all`, na raiz, empacota os quatro pacotes numa pasta.

## Módulos

Cada módulo tem um subcaminho próprio, para que importar um deles não traga as dependências dos outros.

| Subcaminho                         | O que tem                                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@matizze/prumo-core/errors`       | `UIError`: erro com código estável, que a interface traduz por `errors.<CODE>`, e `createErrorMessage`, que cria o `getErrorMessage` do produto a partir da instância i18next                                                                           |
| `@matizze/prumo-core/data`         | `pageSchema` e os tipos `Page`, `PageQuery`, `Sort`, `SortDirection` e `DateRange`                                                                                                                                                                      |
| `@matizze/prumo-core/mock`         | `wait`, `normalize`, `matchesSearch`, `sortBy`, `paginate`, `sum` e `addDays`, os utilitários dos repositórios mock                                                                                                                                     |
| `@matizze/prumo-core/query`        | `createQueryKeys` (e o tipo `QueryKeys`), a fábrica das query keys de um domínio; `createQueryClient`, o `QueryClient` com os padrões de cache e o aviso global de erro (`notify` injetado, `meta: { silent, errorMessage }` tipado); e `QueryProvider` |
| `@matizze/prumo-core/auth`         | `AuthGuard`: guarda de rota que só mostra o conteúdo com sessão aberta e, sem ela, redireciona para o login                                                                                                                                             |
| `@matizze/prumo-core/repositories` | `createRepositoryContainer`, `resolveDataSource` e `createRepositoryContext`: o container de repositórios e o provedor                                                                                                                                  |
| `@matizze/prumo-core/i18n`         | `defineI18n`, a fábrica que liga o i18n ao produto (instância, provedor e hooks tipados pelas mensagens), e `createFormat`, `resolveLocale` e os tipos genéricos                                                                                        |

## Notas por módulo

### `errors`: a chave de reserva

`createErrorMessage(i18n)` confere, na criação, que a chave de reserva (`errors.generic`, ou a de `fallbackKey`) existe nas mensagens da instância, e lança um `Error` em português se não existir. Sem a conferência, o i18next devolveria a própria chave e a tela mostraria `errors.generic`. A instância precisa estar inicializada: a do `defineI18n` já está, porque ele inicializa de forma síncrona.

### `query`: acrescentar campos ao `meta`

O `meta` de query e de mutation tem os campos de `ErrorMeta` (`silent` e `errorMessage`). O TanStack só aceita uma declaração de `Register` por projeto, e o core já a faz, então o produto não declara outra: ele acrescenta campos ao `ErrorMeta`, que é uma `interface` exportada, por declaration merging, num arquivo `.d.ts` ou `.ts` do próprio projeto.

```ts
// src/query-meta.d.ts
import '@matizze/prumo-core/query'

declare module '@matizze/prumo-core/query' {
  interface ErrorMeta {
    /** Texto do botão "tentar de novo" na notificação. */
    retryLabel?: string
  }
}
```

Depois disso, `useQuery({ ..., meta: { retryLabel: 'Tentar de novo' } })` aceita o campo novo, com o tipo declarado, e continua recusando campo que ninguém declarou. A declaração é feita no módulo público (`@matizze/prumo-core/query`), não em um arquivo interno do pacote. Usar o campo novo, por exemplo num `QueryCache` próprio, é com o produto: o `createQueryClient` do core só lê `silent` e `errorMessage`.
