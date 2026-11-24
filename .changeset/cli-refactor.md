---
'@matizze/prumo-cli': patch
---

Código interno reorganizado e escrita do plano atômica (desfaz o que escreveu se uma escrita falhar).

No `make:page --path`, `:eval` e `:arguments` passam a ser recusados (geravam código que não compila) e `:async` passa a ser aceito.
