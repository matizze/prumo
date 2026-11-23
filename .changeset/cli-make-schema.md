---
'@matizze/prumo-cli': minor
---

Voltou o `prumo make:schema <domínio>`, que cria o schema zod de uma entidade em `src/schemas/entities/<entidade>.ts` (o schema, o schema de entrada, os tipos, a chave de ordem e o tipo da consulta de lista) e o registra em `src/schemas/index.ts`. O `--entity` dá o singular quando o automático erra (`paes` com `--entity pao`), e o `--fields` define os campos (`titulo:string,ano:int,situacao:enum(lido|lendo),apelido?:string`), com os tipos `string`, `number`, `int`, `boolean`, `date`, `datetime` e `enum(a|b|c)` e o `?` para campo opcional. Valida tudo antes de escrever (nome, entidade, campos, schema que já existe) e sai com 2 sem deixar nada pela metade; `--dry-run` só mostra o plano. A CLI também ganhou o leitor dos campos do schema, que o `make:repository` e o `make:query` vão usar.
