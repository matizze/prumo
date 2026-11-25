---
'@matizze/prumo-rules': minor
---

A regra `use-case-files` do `prumo check` confere o layout do pratigo: todo `services/<ação>.usecase.ts` precisa do `types/<ação>.ts` (na pasta irmã `types`) e do `<ação>.usecase.test.ts` ao lado. Um use case no layout antigo (`<ação>.types.ts` na mesma pasta) passa a ser acusado.
