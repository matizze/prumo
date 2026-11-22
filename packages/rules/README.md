# @matizze/prumo-rules

Regras da arquitetura do Prumo: um plugin de ESLint, com aviso no editor, e a análise do projeto inteiro que o `prumo check` roda.

**Situação:** o Prumo é uma ferramenta sem frontend ([docs/plano.md](../../docs/plano.md)), então as regras cobram só a estrutura (as camadas, as pastas e os textos), nunca a interface. Nada foi publicado: o pacote segue `"private": true`.

## Plugin de ESLint

`@matizze/prumo-rules/eslint` exporta o plugin. O pacote entrega o código-fonte em TypeScript no workspace, então o `eslint.config.js` precisa de um Node que execute `.ts` (Node 24 ou mais novo). O `eslint` é peer dependency, na faixa `^10.13.0`, e opcional: só o plugin precisa dele, e o `prumo check` (`@matizze/prumo-rules/check`) roda sem ele.

```js
import prumo from '@matizze/prumo-rules/eslint'

export default [
  // Liga as regras da tabela abaixo, com as opções padrão
  prumo.configs.recommended,
]
```

Para mudar as opções de uma regra, registre o plugin com o nome `prumo` e configure a regra:

```js
export default [
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { prumo },
    rules: {
      'prumo/page-structure': ['error', { pagesDir: 'app/screens' }],
    },
  },
]
```

### Regras

Cada regra olha só a pasta que protege e deixa os demais arquivos passarem, então a config `recommended` vale para o projeto inteiro.

| Regra                        | O que cobra                                                                                                                                            | Opções                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `prumo/no-cross-page-import` | Uma tela não importa da pasta de outra: um arquivo de `src/pages/<tela>/` não importa de `src/pages/<outra>/`, nem pelo alias nem por caminho relativo | `alias`, `aliasRoot` e `pagesDir` (a pasta das telas)                   |
| `prumo/page-structure`       | Toda tela tem a mesma estrutura: o `index.tsx` de `src/pages/<tela>/` tem ao lado o `model.ts` e a `view.tsx`                                          | `pagesDir` (a pasta das telas) e `requiredFiles` (os arquivos cobrados) |

## Análise do projeto (prumo check)

`@matizze/prumo-rules/check` exporta `check(options)`, a análise do projeto inteiro. Ela cobre o que o ESLint não vê, porque a verificação olha o conjunto de arquivos, e devolve a lista de violações (`{ rule, file, message }`, com o `file` relativo à raiz do projeto). É o que o comando `prumo check`, do [`@matizze/prumo-cli`](../cli/README.md), roda.

```ts
import { check } from '@matizze/prumo-rules/check'

const violations = check({ root: process.cwd() })
```

| Verificação          | O que cobra                                                                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components-folders` | `src/components` só tem as subpastas permitidas (`ui`, `shared` e `layout`). A `ui` é a pasta que o produto usa para o design system dele, seja qual for: o Prumo só confere o nome dela. Pasta de fora acusa; pasta que falta, não                                                                             |
| `shared-usage`       | O que está em `src/components/shared` é usado por 2 ou mais telas. O uso conta pelo grafo de imports (lidos por expressão regular), a casca do layout conta como duas telas, e os testes não contam                                                                                                             |
| `page-structure`     | Toda pasta de `src/pages` tem `index.tsx`, `model.ts` e `view.tsx`: a mesma regra do `prumo/page-structure`, que no ESLint só vê a tela que já tem `index.tsx`                                                                                                                                                  |
| `messages`           | Textos completos: os idiomas têm as mesmas chaves, cada chave usa os mesmos argumentos ICU em todos eles (interpolação, `plural`, `select` e formatos como `date`), nenhuma mensagem fica vazia e cada `index.ts` registra todos os namespaces do idioma. O JSON malformado e o ICU que não fecha também acusam |

As mensagens são um JSON por namespace em `src/messages/<idioma>/<namespace>.json`, e o primeiro idioma da lista é a referência. Sem a pasta de mensagens, o projeto não tem i18n e a verificação passa.

As opções, todas com padrão, exceto a raiz:

| Opção                  | O que é                                               | Padrão                                  |
| ---------------------- | ----------------------------------------------------- | --------------------------------------- |
| `root`                 | A pasta do projeto, a que tem o `src`                 | (obrigatória)                           |
| `alias` e `aliasRoot`  | O alias de import e a pasta para onde ele aponta      | `'@/'` e `'src'`                        |
| `pagesDir`             | A pasta das telas                                     | `'src/pages'`                           |
| `requiredPageFiles`    | Os arquivos que toda tela tem                         | `['index.tsx', 'model.ts', 'view.tsx']` |
| `componentsDir`        | A pasta dos componentes                               | `'src/components'`                      |
| `allowedComponentDirs` | As únicas subpastas permitidas nela                   | `['layout', 'shared', 'ui']`            |
| `sharedDir`            | A pasta dos componentes compartilhados                | `'src/components/shared'`               |
| `layoutDir`            | A pasta da casca do layout, que conta como duas telas | `'src/components/layout'`               |
| `messagesDir`          | A pasta das mensagens, com uma subpasta por idioma    | `'src/messages'`                        |
| `locales`              | Os idiomas do produto, o primeiro é a referência      | `['pt-BR', 'en']`                       |

## Código-fonte

- `src/eslint/`: o plugin e as regras, cada uma com o teste ao lado (`RuleTester` do ESLint).
- `src/check/`: a análise do projeto, uma verificação por arquivo, com o teste nos projetos de `__fixtures__` (um sem violação e um com uma violação plantada por verificação) e em projetos montados numa pasta temporária. O `gate.test.ts` junta, por verificação, uma violação que ela precisa acusar e uma variante que ela precisa deixar passar.

## Build e empacotamento

No workspace, o `exports` do pacote aponta para o código-fonte (`src/*.ts`). Fora do monorepo o Node não faz type stripping dentro de `node_modules`, então o pacote tem `tsconfig.build.json` e o script `build` (`pnpm --filter @matizze/prumo-rules run build`), que emite o `dist/` com `.js` e `.d.ts`, sem os testes, as fixtures e os arquivos de apoio. O `publishConfig` troca `exports` para o `dist/`, e o tarball leva só o `dist/`, o `package.json` e o README. `pnpm pack:all`, na raiz, empacota os cinco pacotes.
