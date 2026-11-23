---
'@matizze/prumo-cli': minor
---

Correções do `new` e dos `make:*`, vindas de um app real:

- Os `make:page`, `make:domain` e `make:component` só saem com código 1 pelas violações do `prumo check` que **eles** causaram. O `check` roda antes de escrever, e a violação que já existia (a `shared-usage` de um componente `--shared` anterior, por exemplo) aparece como "Preexistentes" e não muda o código de saída. O `prumo check` em si não muda.
- O `verify` do app novo passa a ser `typecheck && lint && test && check`: os testes rodam mesmo quando o `check` falha, e o `verify` continua falhando se o `check` falhar. Apps já criados não mudam sozinhos; troque a ordem no `package.json` se quiser.
- O `new` gera o tratamento de erro ligado: o namespace `errors` nos dois idiomas, o `src/errors.ts` com o `getErrorMessage`, o `i18n` exportado e o `providers/app.tsx` usando o `getErrorMessage` (antes, o texto técnico do erro).
- O `make:domain` acrescenta o texto de `<ENTIDADE>_NOT_FOUND` ao `errors.json` de cada idioma. Num app criado antes, sem o `errors.json`, avisa e segue, sem falhar.
- O `src/test/setup.ts` do app novo fixa o idioma padrão (`pt-BR`), em vez de rodar os testes em inglês no jsdom.
- Os "Próximos passos" do `new` usam `<domínio>` e `<tela>` no lugar de um nome inventado e apontam para a documentação.
