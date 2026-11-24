---
'@matizze/prumo-rules': minor
---

Licença MIT, metadados do pacote (palavras-chave, página, relato de problemas, autor e Node 24 ou mais novo) e o README com os links do site da documentação. Quebra de compatibilidade: o ponto de entrada `.` do `exports`, que só exportava o nome do pacote (`PACKAGE_NAME`), saiu. Quem importava a raiz passa a importar pelos subcaminhos.
