---
'@matizze/prumo-core': minor
---

Novo `mockRoute(endpoint, handler)` em `@matizze/prumo-core/http`: monta a rota do mock a partir do `ENDPOINT` do use case (`export const signInRoutes = mockRoute(ENDPOINT, ...)`), sem repetir `` `${ENDPOINT.method} ${ENDPOINT.path}` `` à mão. O `params` do handler sai do caminho, como no `createMockHttp`.

Novo `NetworkError`: o `createHttp` o lança quando o `fetch` rejeita (sem rede, DNS, CORS). O que o `fetch` não lança, como um `TypeError` de bug de código, passa como veio.
