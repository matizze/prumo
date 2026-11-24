---
'@matizze/prumo-cli': minor
---

`prumo make:page auth.login` (ou `auth/login`) cria a tela numa subpasta: `src/pages/auth/login/`, a rota `/auth/login`, o componente `AuthLoginPage` e as mensagens em `auth-login.json`. O comando recusa uma tela dentro de outra, uma pasta que já agrupa telas e nomes que dariam o mesmo componente (`auth/login` e `auth-login`). O `prumo list` e o MCP mostram o nome da tela com barra.

Correção: o teste da tela gerada renderiza na rota da própria tela. O `home.test` do `prumo new` passou de `/home` para `/`, e uma tela criada com `--path /about` testa em `/about`.
