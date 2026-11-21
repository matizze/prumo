# @matizze/prumo-cli

O comando prumo: new, make, add, promote, check e doctor.

**Situação:** Fase 2 em andamento. O `prumo` é uma árvore de comandos ([citty](https://github.com/unjs/citty)) e hoje tem só o `prumo check`; o núcleo do codemod ([ts-morph](https://ts-morph.com), em `src/codemod/`) já existe, e os comandos `make:*` que o usam chegam nos próximos pull requests da fase ([docs/fase-2.md](../../docs/fase-2.md)). O plano está na seção 9 de [docs/plano-prumo.md](../../docs/plano-prumo.md).

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

### Núcleo do codemod (interno)

`src/codemod/` tem as peças dos comandos `make:*`, uma função por operação. Elas ainda não têm comando: o `make:page` (G3) as junta.

- **Plano de mudanças** (`ChangePlan`): um `Project` do ts-morph em memória, sem tsconfig, sem checagem de tipos e sem ler o disco por conta própria; só entram nele as cópias e os arquivos de costura. Os arquivos que não são código (JSON de mensagens, imagens) ficam numa lista à parte. Nada é escrito até o `commit()`, e o `summary()` diz o que seria criado e alterado (o `--dry-run`).
- **Nomes** (`names.ts`): valida o nome (kebab-case: minúsculas, números e hífen, começando por letra) e deriva Pascal, camel e, para domínios, singular e plural (a regra tira o `s` final; um singular explícito vale mais).
- **Cópia e renomeação**: `copyPage` copia `src/pages/<ref>/**`; `renameExports` renomeia `<Pascal>Page`, `use<Pascal>Model` e os demais exportados com o prefixo, com as referências, pelo language service; `replaceNamespace` troca o namespace do i18n; `renameStoryTitles` dá a cada story o título `Pages/<Pascal>/<último segmento>`; `replaceRoute` troca a rota e o nome da suíte nos testes.
- **Costuras**: `registerMessages` (JSON nos dois idiomas e o `index.ts`, em ordem alfabética), `registerRoute` (clona o `<Route>` da referência no `App.tsx`, inclusive dentro de `nest`, e acrescenta o import) e `registerMenuItem` (item nos `subItems` de um grupo da barra lateral e o rótulo em `layout.nav.items`).

Os testes usam um app em miniatura em `src/codemod/__fixtures__/app` (fora do tsconfig, do lint e do Vitest).

O bin roda o código-fonte em TypeScript, então precisa de um Node que execute `.ts` (Node 24 ou mais novo).

**Origem no app de referência:** o roteiro de criação de tela, hoje feito à mão (`docs/patterns.md` e `AGENTS.md`), e os testes `src/architecture.test.ts` e `src/i18n/messages.test.ts`.
