---
'@matizze/prumo-cli': minor
---

`prumo make:usecase <domínio> --crud` gera os cinco use cases do CRUD de uma entidade (`listLivros`, `getLivro`, `createLivro`, `updateLivro` e `removeLivro`, com endpoints REST) a partir do schema, com uma coleção de mock que eles dividem (criar e depois listar mostra o item novo), testes contra o mock e contra a API (`API_TEST_URL`) e os textos de erro (`<ENTIDADE>_NOT_FOUND` e os `_FAILED`) nos dois idiomas. `prumo make:page <tela> --usecase <domínio>.<ação>` gera a tela de um use case: lista (leitura que devolve lista, com carregando, erro e vazio), detalhe (leitura com `:id` no endereço e o mesmo parâmetro no `--path`) ou formulário (escrita, com os campos do Input, envio, erro e sucesso). O model usa `useUseCases()` com `useQuery` ou `useMutation`, e a escrita invalida o prefixo do domínio. O `prumo list` e o MCP mostram o use case de cada tela e a variação `form`.
