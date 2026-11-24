---
'@matizze/prumo-core': minor
---

Base para trocar o repository por use cases. Entram `@matizze/prumo-core/http` (`createHttp`, com o `query` que vira query string, `HttpError` e os tipos, e `createMockHttp`, um `http` de mentira que responde por rotas como `'GET /livros/:id'`, sem rede e sem dependência), `@matizze/prumo-core/use-cases` (`IUseCase`, `UseCaseInput`, `UseCaseOutput`, `createUseCasesContext` e `resolveDataSource`) e `createMockCollection` em `@matizze/prumo-core/mock`, a coleção em memória que os mocks de um CRUD dividem. O módulo `repositories` continua como está.
