---
'@matizze/prumo-cli': minor
---

O use case gerado segue o layout do pratigo: por domínio, `types/<ação>.ts` (o `ENDPOINT`, o `<Ação>Request` e o `<Ação>Response`, em zod), `services/<ação>.usecase.ts` e o teste ao lado, e `mocks/<ação>.ts` (no `--crud`, a coleção em `mocks/collection.ts`). O `Input` e o `Output` passam a ser `Request` e `Response`, e o `execute` não tem mais `try/catch`: o erro da API é traduzido num lugar só, no `src/http/errors.ts` do app novo (`withErrors`, no `http` da API e no de mock), em `UIError` com os códigos `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` e `REQUEST_FAILED`, que o `errors.json` do `prumo new` já traz nos dois idiomas. O `make:usecase` não escreve mais `<AÇÃO>_FAILED` nem `<ENTIDADE>_NOT_FOUND` nos `errors.json`. O código gerado perde os comentários óbvios. O `make:page --usecase`, o `prumo list` e o MCP leem o layout novo. Um domínio gerado pela 0.10 precisa ser movido: veja o guia de migração.
