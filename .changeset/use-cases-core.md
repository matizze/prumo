---
'@matizze/prumo-core': minor
---

Use cases no lugar do repository. Entram `@matizze/prumo-core/http` (`createHttp`, com o `query` que vira query string, `HttpError` com o `body` da resposta de erro e os tipos, e `createMockHttp`, um `http` de mentira que responde por rotas como `'GET /livros/:id'`, sem rede e sem dependência, com os `params` tipados pela chave da rota e o `MissingMockRouteError` para a rota sem mock), `@matizze/prumo-core/use-cases` (`IUseCase`, `UseCaseInput`, `UseCaseOutput`, `createUseCasesContext` e `resolveDataSource`) e `createMockCollection` em `@matizze/prumo-core/mock`, a coleção em memória que os mocks de um CRUD dividem. O módulo `repositories` sai (veja o changeset `remove-repositories-core`).
