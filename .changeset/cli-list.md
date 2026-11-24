---
'@matizze/prumo-cli': minor
---

Novo comando `prumo list [--root <pasta>] [--json]`: mostra o que o projeto já tem (schemas com os campos que o Prumo reconhece, repositórios com as fontes `mock`, `http` e `storage`, queries com os hooks, telas com rota, variação e query, e idiomas), só lendo os arquivos. Com `--json`, escreve um objeto estável (`schemas`, `repositories`, `queries`, `pages`, `languages`), tipado em `ProjectListing`. Sai com 2 se a pasta não é um projeto.
