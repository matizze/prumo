---
'@matizze/prumo-cli': minor
---

Use case passa a ser o único caminho: saem os comandos `make:repository` e `make:query`, a opção `--query` do `make:page` e as ferramentas MCP `make_repository` e `make_query`. O `prumo new` não gera mais `src/repositories/`, `src/queries/` nem o provider de repositórios, e o `providers/app.tsx` e o `test/render.tsx` usam só use cases. A `VITE_DATA_SOURCE` dos use cases volta a ser estrita (`mock` ou `http`; outro valor, como `storage`, lança o erro claro do `resolveDataSource`). O `prumo list` (texto e `--json`) não traz mais `repositories` nem `queries`, e as telas não têm mais o campo `query`. O próximo passo do `make:schema` passa a sugerir `prumo make:usecase <domínio> --crud`, e o `prumo check` acusa o `*.usecase.ts` sem o `.types.ts` ou o teste ao lado. Para migrar um app das versões 0.9 e anteriores, veja o guia [Migrar para use cases](https://docs.prumo.matizze.com.br/guides/migrate-to-use-cases).
