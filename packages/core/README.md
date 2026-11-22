# @matizze/prumo-core

Infraestrutura sem interface para apps React do [Prumo](https://github.com/matizze/prumo): container de repositórios, query keys, i18n tipado, erros com código, utilitários de mock e guarda de rota.

**[Documentação](https://github.com/matizze/prumo/blob/main/docs/README.md)** · **[Referência deste pacote](https://github.com/matizze/prumo/blob/main/docs/reference/core.md)** · **[Changelog](https://github.com/matizze/prumo/blob/main/packages/core/CHANGELOG.md)**

## Instalação

Um app criado pelo `prumo new` já tem o pacote. Num projeto existente:

```bash
pnpm add @matizze/prumo-core
```

As dependências que os módulos usam são *peer dependencies*: `react` 19, `@tanstack/react-query` 5, `zod` 4, `i18next` 26, `react-i18next`, `i18next-icu`, `i18next-browser-languagedetector` e `wouter` 3. Instale as dos módulos que usar.

## Módulos

Cada módulo tem um subcaminho próprio: importar um não traz as dependências dos outros. Nenhum renderiza elemento visual.

| Subcaminho                         | O que tem                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@matizze/prumo-core/repositories` | `createRepositoryContainer`, `resolveDataSource` e `createRepositoryContext`: o container de repositórios por domínio e o provedor |
| `@matizze/prumo-core/query`        | `createQueryKeys`, `createQueryClient` (cache e notificação global de erro), `QueryProvider` e o tipo `ErrorMeta` |
| `@matizze/prumo-core/i18n`         | `defineI18n` (instância, provedor e hooks tipados pelas mensagens, com ICU), `createFormat` e `resolveLocale` |
| `@matizze/prumo-core/errors`       | `UIError` (erro com código estável) e `createErrorMessage` (o texto do erro no idioma ativo)     |
| `@matizze/prumo-core/data`         | `pageSchema` e os tipos `Page`, `PageQuery`, `Sort`, `SortDirection` e `DateRange`           |
| `@matizze/prumo-core/mock`         | `wait`, `normalize`, `matchesSearch`, `sortBy`, `paginate`, `sum` e `addDays`, para repositórios em memória |
| `@matizze/prumo-core/auth`         | `AuthGuard`, a guarda de rota que redireciona sem sessão                                         |

## Exemplo

```ts
import { defineI18n } from '@matizze/prumo-core/i18n'
import { createQueryKeys } from '@matizze/prumo-core/query'
import { createRepositoryContainer, type RepositoryContainerOf } from '@matizze/prumo-core/repositories'

// i18n tipado pelas mensagens do idioma padrão
export const { I18nProvider, useTranslations, useFormat } = defineI18n({
  messages: { 'pt-BR': ptBR, en },
  defaultLocale: 'pt-BR',
  languages: {
    'pt-BR': { name: 'Português (Brasil)', shortName: 'PT' },
    en: { name: 'English', shortName: 'EN' },
  },
})

// query keys de um domínio: clienteKeys.all invalida tudo de clientes
export const clienteKeys = createQueryKeys('clientes', {
  list: (query: ClienteListQuery = {}) => ['list', query] as const,
  detail: (id: string) => ['detail', id] as const,
})

// container de repositórios: o tipo sai do mapa de fábricas
const factories = { clientes: createClientesRepository }
export type RepositoryContainer = RepositoryContainerOf<typeof factories>
export const repositories = createRepositoryContainer(factories, { dataSource: 'memory' })
```

A referência de cada função, com as opções e os tipos, está em [docs/reference/core.md](https://github.com/matizze/prumo/blob/main/docs/reference/core.md).

## Suporte

Mantido pela [Matizze](https://github.com/matizze). Problemas e sugestões em [issues](https://github.com/matizze/prumo/issues).
