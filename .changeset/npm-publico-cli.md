---
'@matizze/prumo-cli': minor
---

O `prumo new` deixa de criar o `.npmrc` (os pacotes `@matizze/prumo-*` vêm do npm público, sem token), e o `AGENTS.md` e o `README.md` do app não falam mais de GitHub Packages. O `prumo doctor` passa a avisar quando o `.npmrc` ainda manda o escopo `@matizze` para o GitHub Packages: a linha pode sair.
