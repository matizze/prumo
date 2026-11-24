---
'@matizze/prumo-rules': minor
---

As telas podem ficar em subpastas: a tela é a primeira pasta de `src/pages` que tem `index.tsx` (`auth/login`), e a pasta sem ele só agrupa telas. O `page-structure`, o `no-cross-page-import` e o `prumo check` passam a enxergar as telas em qualquer profundidade.
