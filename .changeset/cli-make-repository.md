---
'@matizze/prumo-cli': minor
---

Voltou o `prumo make:repository <domínio>`, só com a fonte `mock` (a `--data-source` vem depois). Precisa do schema do `make:schema` e lê os campos dele, sem `--fields`: com eles gera a busca, a ordem, os dados de exemplo e o teste de contrato. Cria `src/repositories/<domínio>/` (`repository.contract.ts`, `repository.mock.ts`, `fixtures.ts`, `repository.contract.test.ts` e `index.ts`, a fábrica), registra o domínio no container `src/repositories/index.ts` (o import, o `export *` e a entrada do mapa `factories`, em ordem alfabética) e acrescenta o texto de `<ENTIDADE>_NOT_FOUND` ao `errors.json` de cada idioma (num app sem o arquivo, avisa e segue). O `--entity` é o mesmo do `make:schema`. Sem o schema, ou com o repositório já criado, sai com 2, sem deixar nada pela metade; `--dry-run` só mostra o plano.
