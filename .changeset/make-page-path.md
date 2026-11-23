---
'@matizze/prumo-cli': minor
'@matizze/prumo-mcp': minor
---

`make:page` ganha `--path <caminho>` (e a ferramenta `make_page` do MCP, o campo `path`): a rota da tela deixa de ser sempre `/<nome>`. O caminho é validado (começa com `/`, segmentos válidos, no máximo um parâmetro `:nome`, sem `?`, `*` nem `+`) e recusado se repete ou conflita com uma rota do `App.tsx`. Com parâmetro (`--path /livros/:id`), o model gerado lê o valor com o `useParams` do wouter, a view o mostra e o teste renderiza a tela dentro de `<Route path="...">` com um valor de exemplo, então um descompasso entre a rota e a tela passa a falhar. Junto de `--domain`, a tela é de detalhe: o model busca o registro com o `use<Entidade>Detail` do domínio. Sem `--path`, nada muda.
