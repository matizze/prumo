---
'@matizze/prumo-cli': minor
---

Voltou o `prumo make:query <domínio>`. Precisa do repositório (`make:repository`); sem ele sai com 2 e diz o comando a rodar. Cria `src/queries/<domínio>.ts` com `<entidade>Keys`, `<entidade>Queries`, `use<Domínio>List`, `use<Entidade>Detail`, `useCreate<Entidade>`, `useUpdate<Entidade>` e `useRemove<Entidade>`, e registra o domínio em `src/queries/index.ts`, em ordem alfabética. As queries usam só o contrato do repositório, então valem para qualquer fonte (mock, storage ou http). O `--entity` é o mesmo do `make:schema`; query que já existe sai com 2, sem deixar nada pela metade; `--dry-run` só mostra o plano.
