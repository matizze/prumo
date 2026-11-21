# @matizze/prumo-cli

O comando prumo: new, make, add, promote, check e doctor.

**Situação:** Fase 2 em andamento. O `prumo` é uma árvore de comandos ([citty](https://github.com/unjs/citty)) e hoje tem só o `prumo check`; os comandos `make:*` chegam nos próximos pull requests da fase ([docs/fase-2.md](../../docs/fase-2.md)). O plano está na seção 9 de [docs/plano-prumo.md](../../docs/plano-prumo.md).

## Comandos

| Comando       | O que faz                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prumo check` | Analisa o projeto inteiro e lista as violações da arquitetura: as pastas de `src/components`, o uso de `components/shared` pelas telas, a estrutura de cada tela e os textos completos nos idiomas |

### Ajuda e códigos de saída

- `prumo` ou `prumo --help` lista os comandos; `prumo <comando> --help` mostra a sintaxe, os argumentos e as opções de um comando. A ajuda é em português.
- Todo comando sai com 0 quando dá certo e com 2 quando o uso está errado: comando ou opção que não existe, argumento que falta ou sobra, pasta que não é um projeto. Os demais códigos são de cada comando (o `check` sai com 1 quando há violação).

### prumo check

```sh
prumo check [--root <pasta>]
```

- `--root <pasta>`: a pasta do projeto, a que tem o `src`. Padrão: a pasta atual.
- Cada violação sai numa linha com o arquivo, a regra e o que está errado: `src/components/widgets  [components-folders]  A pasta 'widgets' não é permitida ...`.
- O código de saída é 0 sem violação, 1 com violação e 2 se o uso está errado, então o comando serve de portão na CI. Raiz que não existe, que não é pasta ou que não tem `package.json` e `src` também sai com 2 e uma mensagem clara, em vez de passar sem analisar nada. Essa conferência é do `findProject` (`src/project.ts`), que todos os comandos usam para achar a raiz e os caminhos do projeto: `src/pages`, `src/messages`, `src/App.tsx` e o menu lateral.
- As verificações, as pastas e os idiomas vêm de [`@matizze/prumo-rules/check`](../rules/README.md#análise-do-projeto-prumo-check), com os padrões da arquitetura do Prumo. O arquivo de configuração chega na Fase 2.

O bin roda o código-fonte em TypeScript, então precisa de um Node que execute `.ts` (Node 24 ou mais novo).

**Origem no app de referência:** o roteiro de criação de tela, hoje feito à mão (`docs/patterns.md` e `AGENTS.md`), e os testes `src/architecture.test.ts` e `src/i18n/messages.test.ts`.
