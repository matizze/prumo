# @matizze/prumo-core

Infraestrutura comum dos produtos do Prumo: container de repositórios, query keys, tipo Page, utilitários de mock, i18n, erros com código, guarda de login e provedor de query.

**Situação:** Fase 1, em extração do app de referência (`apps/reference`), um módulo por pull request. O plano está em [docs/fase-1.md](../../docs/fase-1.md).

## Módulos

Cada módulo tem um subcaminho próprio, para que importar um deles não traga as dependências dos outros.

| Subcaminho                         | O que tem                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@matizze/prumo-core/errors`       | `UIError`: erro com código estável, que a interface traduz por `errors.<CODE>`                                         |
| `@matizze/prumo-core/data`         | `pageSchema` e os tipos `Page`, `PageQuery`, `Sort`, `SortDirection` e `DateRange`                                     |
| `@matizze/prumo-core/mock`         | `wait`, `normalize`, `matchesSearch`, `sortBy`, `paginate`, `sum` e `addDays`, os utilitários dos repositórios mock    |
| `@matizze/prumo-core/query`        | `createQueryKeys` e o tipo `QueryKeys`: a fábrica das query keys de um domínio                                         |
| `@matizze/prumo-core/auth`         | `AuthGuard`: guarda de rota que só mostra o conteúdo com sessão aberta e, sem ela, redireciona para o login            |
| `@matizze/prumo-core/repositories` | `createRepositoryContainer`, `resolveDataSource` e `createRepositoryContext`: o container de repositórios e o provedor |
