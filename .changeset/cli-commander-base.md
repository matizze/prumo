---
'@matizze/prumo-cli': minor
---

A CLI foi reescrita do zero com o commander. Por enquanto ela só tem a ajuda (`--help`) e a versão (`--version`), toda em português, e os códigos de saída: 0 sem erro, 2 para uso errado (comando, opção ou argumento que não existe) e 1 para erro inesperado. Os comandos (`new`, `make:schema`, `make:repository`, `make:query`, `make:page` e `check`) voltam nos próximos PRs. Saem o `make:domain`, o `make:component`, o `move:component`, o `doctor` e a API em processo (`@matizze/prumo-cli/api`).
