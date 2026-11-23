---
'@matizze/prumo-core': minor
---

Correções e novidades do core, vindas de um app real:

- `format.date('AAAA-MM-DD')` mostra o dia escrito: texto só com a data passa a ser lido como data local, e não como meia-noite em UTC (que virava o dia anterior no Brasil). ISO com hora, `Date` e número seguem como antes.
- `AuthGuard` ganha a opção `keepOrigin`, que leva a rota pedida (caminho e query) ao login em `?next=`. Novos `useAuthOrigin`, `safeRedirectPath`, `buildLoginRedirect` e `readOrigin` (em `@matizze/prumo-core/auth`) deixam o login voltar para ela, aceitando só caminho relativo do próprio app (sem redirecionamento aberto). Sem `keepOrigin`, nada muda.
- `UIError` aceita `params` opcionais (valores do texto ICU), e o `getErrorMessage` os passa ao `t`, aceita um código solto (`getErrorMessage('LOAN_LIMIT', { limite: 3 })`) e um segundo argumento com valores. Quem usa `new UIError(code, message)` não muda.
- Novo subcaminho `@matizze/prumo-core/date` com `addDays`, `daysBetween` e `parseLocalDate`, para regras de negócio. O `@matizze/prumo-core/mock` continua exportando `addDays`.
