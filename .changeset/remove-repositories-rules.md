---
'@matizze/prumo-rules': minor
---

Regras de camada para os use cases. Plugin de ESLint: `prumo/no-http-in-page` (um arquivo de `src/pages` não importa de `src/http`) e `prumo/use-case-imports` (um arquivo de `src/use-cases` não importa de `src/pages`, de `react` nem de `@tanstack/*`), as duas ligadas no `prumo.configs.recommended`. `prumo check`: a verificação `use-case-files` confere que todo `*.usecase.ts` tem o `.types.ts` e o `.usecase.test.ts` na mesma pasta (o mock não é cobrado), com a opção `useCasesDir`. Veja o guia [Migrar para use cases](https://docs.prumo.matizze.com.br/guides/migrate-to-use-cases).
