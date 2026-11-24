---
'@matizze/prumo-cli': patch
---

Os comandos que escrevem (`new` e os `make:*`, também pelas ferramentas do `prumo mcp`) conferem, antes de gravar, o caminho real de cada arquivo, com os links simbólicos resolvidos. Se um arquivo levaria a escrita para fora do projeto (o próprio `src`, uma pasta dentro dele ou um arquivo como o `App.tsx` sendo link para fora) ou passa por um link quebrado, o comando sai com 2 e não escreve nada. Link dentro do projeto que aponta para dentro dele continua valendo.
