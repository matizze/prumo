---
'@matizze/prumo-cli': minor
'@matizze/prumo-rules': patch
---

Achados da revalidação do app de exemplo:

- O `--fields` do `make:domain` (e o campo `fields` da ferramenta MCP) ganha os tipos `int` (`z.number().int()`, fixtures com inteiros) e `enum(a|b|c)` (`z.enum([...])`, fixtures com os valores da lista, na ordem). Os valores precisam ser identificadores simples (letras, números e `_`, começando por letra), sem repetir, e são no mínimo dois; o resto é recusado com código 2. O enum entra na `SortKey` e na ordem do mock, mas o teste de ordem do contrato usa outro campo, porque o enum repete valores. O `make:page --domain` não trata o enum como texto de exibição (sem outro campo de texto, mostra o `id`, com o aviso de sempre). Sem os tipos novos, o `--fields` se comporta como antes.
- O código gerado pelo `make:domain` quebra em várias linhas (2 espaços, vírgula no fim) o `pick` do schema de entrada, a busca do mock e a entrada do teste de contrato quando a linha passaria de cerca de 100 colunas, e a frase da busca vira "pelos campos de texto" quando listar os campos estouraria a linha. Domínios pequenos saem iguais aos de antes.
- A mensagem da regra `shared-usage` do `prumo check` passa a dizer "O módulo não é usado por nenhuma tela" (antes, "O módulo é usado por nenhuma tela") e "O módulo é usado só pela tela 'x'".
