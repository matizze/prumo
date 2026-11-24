# Referência do `@matizze/prumo-rules`

As regras da arquitetura do Prumo, em duas formas: um **plugin de ESLint**, que olha um arquivo de cada vez e avisa no editor, e a **análise do projeto**, que olha o conjunto de arquivos e é o que o `prumo check` roda. As regras cobram só a estrutura (as camadas, as pastas e os textos), nunca a interface.

```bash
pnpm add -D @matizze/prumo-rules
```

| Subcaminho                       | Conteúdo                         |
| -------------------------------- | -------------------------------- |
| `@matizze/prumo-rules/eslint`    | O plugin de ESLint (export default) |
| `@matizze/prumo-rules/check`     | A função `check` e os tipos       |

O `eslint` (^10.13) é *peer dependency* opcional: só o plugin precisa dele.

---

## Plugin de ESLint

```js
// eslint.config.js
import prumo from '@matizze/prumo-rules/eslint'

export default [
  // ... a configuração do projeto
  prumo.configs.recommended,
]
```

A config **`prumo.configs.recommended`** registra o plugin com o nome `prumo` e liga as duas regras como `error`, para os arquivos `**/*.{ts,tsx}`. Cada regra só olha a pasta que protege e deixa os outros arquivos passarem.

Para mudar as opções, configure a regra depois da config recomendada:

```js
export default [
  prumo.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'prumo/page-structure': ['error', { pagesDir: 'app/screens' }],
    },
  },
]
```

As regras acham a pasta das telas no próprio caminho do arquivo (procurando `/src/pages/`), e não pelo diretório de trabalho do ESLint, então funcionam igual no terminal, no editor e em monorepos.

### `prumo/no-cross-page-import`

**Uma tela não importa da pasta de outra tela.** Um arquivo de uma tela (em qualquer profundidade, testes incluídos) não importa de outra, nem pelo alias nem por caminho relativo. A tela é a primeira pasta, a partir de `src/pages`, que tem `index.tsx`: `auth/login` não importa de `auth/register`, e a pasta sem `index.tsx` (`auth`) só agrupa. O que duas telas usam vai para `src/components/shared`.

O arquivo solto em `src/pages` ou numa pasta de grupo (`src/pages/auth/shared.ts`) não é de tela, e a regra não o olha; importá-lo de uma tela também é recusado (`não importa o arquivo solto`), e ele vai para `src/components/shared`. A pasta sem `index.tsx` e sem tela dentro (`src/pages/rascunho`) conta como tela, como no `prumo check`.

Confere todo especificador com origem: `import`, `import type`, `export ... from`, `export *`, `import()` com texto fixo e `import('...')` em posição de tipo.

```ts
// src/pages/clientes/view.tsx
import { Resumo } from './components/resumo'          // ok: a própria tela
import { Cartao } from '@/components/shared/cartao'   // ok: compartilhado
import { HomeView } from '@/pages/home/view'          // erro
import { useHomeModel } from '../home/model'          // erro
```

```text
A tela 'clientes' não importa da pasta da tela 'home' ('@/pages/home/view'): o que as duas usam vai para a pasta de componentes compartilhados.
```

| Opção       | Padrão        | Descrição                                                   |
| ----------- | ------------- | ----------------------------------------------------------- |
| `alias`     | `'@/'`        | O alias de import que aponta para `aliasRoot`               |
| `aliasRoot` | `'src'`       | A pasta para onde o alias aponta, relativa ao projeto       |
| `pagesDir`  | `'src/pages'` | A pasta das telas, relativa ao projeto; tela é a pasta com `index.tsx` |

### `prumo/page-structure`

**Toda tela tem a mesma estrutura.** O `index.tsx` de uma tela (`src/pages/livros/` ou `src/pages/auth/login/`, em qualquer profundidade) precisa ter ao lado o `model.ts` e a `view.tsx`. A regra olha a pasta pelo sistema de arquivos e acusa no `index.tsx`, um erro por arquivo que falta. O `index.tsx` de uma subpasta da tela (`livros/components/index.tsx`) não é tela, e os arquivos soltos em `src/pages` ficam de fora.

```text
A tela 'relatorios' precisa do arquivo 'model.ts' ao lado do index.tsx (src/pages/relatorios/model.ts).
```

| Opção           | Padrão                      | Descrição                                       |
| --------------- | --------------------------- | ----------------------------------------------- |
| `pagesDir`      | `'src/pages'`               | A pasta das telas, relativa ao projeto          |
| `requiredFiles` | `['model.ts', 'view.tsx']`  | Os arquivos que a tela tem ao lado do `index.tsx` |

O ESLint só vê a tela que já tem `index.tsx`. A tela sem o próprio `index.tsx` é acusada pela análise do projeto (`page-structure`, abaixo).

---

## Análise do projeto

```ts
import { check } from '@matizze/prumo-rules/check'

const violations = check({ root: process.cwd() })
```

```ts
function check(options: CheckOptions): Violation[]

interface Violation {
  rule: 'components-folders' | 'shared-usage' | 'page-structure' | 'messages'
  file: string     // relativo à raiz, com barras normais
  message: string  // o que está errado e, quando cabe, o que fazer, em português
}
```

Analisa o projeto inteiro e devolve as violações, na ordem das verificações e, dentro de cada uma, das pastas. Sem violação, a lista vem vazia. A análise só lê arquivos: não escreve nada e não depende do ESLint.

### `components-folders`

**`src/components` só tem as subpastas permitidas:** `ui` (o design system do produto, seja qual for), `shared` (do produto, usadas por duas telas ou mais) e `layout` (a casca do app). Uma pasta de fora acusa; uma pasta que falta, não.

```text
src/components/widgets  [components-folders]  A pasta 'widgets' não é permitida em src/components: só 'layout', 'shared', 'ui'.
```

### `shared-usage`

**O que está em `src/components/shared` é usado por duas telas ou mais.** O uso conta pelo grafo de imports:

- um módulo de `shared` usado por outro módulo de `shared` vale pelas telas que usam esse outro;
- a casca do layout (`src/components/layout`) aparece em todas as telas, então conta como **duas**;
- testes (`*.test.ts`, `*.test.tsx`) não contam como uso;
- os imports são lidos por expressão regular, nos casos do `import`, do `export ... from` e do `import()` com texto fixo, pelo alias ou por caminho relativo.

```text
src/components/shared/cartao.tsx  [shared-usage]  O módulo não é usado por nenhuma tela, e o que está em src/components/shared precisa de 2 ou mais telas: mova-o para a tela que o usa.
```

### `page-structure`

**Toda tela de `src/pages`, em qualquer profundidade, tem `index.tsx`, `model.ts` e `view.tsx`.** É a mesma regra do `prumo/page-structure` do ESLint, mas aqui a falta do próprio `index.tsx` também acusa: a pasta sem `index.tsx` que tem telas dentro é só um grupo (`auth`), e a que não tem nenhuma é uma tela incompleta. A tela aparece com o caminho (`auth/login`).

```text
src/pages/relatorios/model.ts  [page-structure]  A tela 'relatorios' precisa do arquivo 'model.ts' na própria pasta.
```

### `messages`

**Os textos estão completos em todos os idiomas.** As mensagens são um JSON por namespace em `src/messages/<idioma>/<namespace>.json`, e o primeiro idioma de `locales` é a referência. Sem a pasta de mensagens, o projeto não tem i18n e a verificação passa.

| Acusa                                                                                       | Exemplo de mensagem                                                                      |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A pasta de um idioma não existe                                                             | `A pasta do idioma 'en' não existe.`                                                     |
| Uma chave existe num idioma e falta no outro                                                | `A chave 'clientes.empty' existe em 'pt-BR' e falta em 'en'.`                            |
| Os argumentos ICU de uma chave diferem entre os idiomas                                     | `A chave 'clientes.count' usa argumentos diferentes: 'pt-BR' tem [count] e 'en' tem [].` |
| Uma mensagem vazia                                                                          | `A mensagem 'clientes.title' está vazia.`                                                |
| Uma mensagem que não é texto (número, lista)                                                | `A mensagem 'clientes.total' precisa ser um texto.`                                      |
| ICU malformado (uma chave que não fecha)                                                    | `A mensagem 'clientes.count' tem ICU malformado: ...`                                    |
| JSON inválido, ou que não é um objeto                                                       | `O arquivo não é um JSON válido: ...`                                                    |
| O `index.ts` do idioma importa um JSON que não existe                                       | `O index.ts importa './antiga.json', que não existe em 'pt-BR'.`                         |
| Um JSON importado que não está no `export default`                                          | `O namespace de './clientes.json' está importado, mas não está no export default.`       |
| Um JSON da pasta que o `index.ts` não registra                                              | `O arquivo 'clientes.json' não está importado nem exportado no index.ts.`                |
| Os idiomas registram namespaces diferentes                                                  | `O namespace 'clientes' está registrado em 'pt-BR' e falta em 'en'.`                     |
| Um idioma tem `index.ts` e o outro não                                                      | `O idioma 'pt-BR' registra os namespaces num index.ts e 'en' não tem index.ts.`          |

**Os argumentos ICU.** A comparação considera o nome de cada argumento e, onde o código depende do formato, o formato: `{n}` e `{n, plural, ...}` contam igual (cada idioma decide se precisa de plural); `{s, select, a {...} b {...}}` conta com os valores do `select`, que o código passa; `{d, date}` conta com o formato. Argumentos dentro dos ramos entram também.

**Os namespaces.** Com `index.ts`, o nome do namespace é o registrado no `export default` (`pedidosRecentes`, de `./pedidos-recentes.json`), e as mensagens das violações usam esse nome, como o app o usa no `t()`. Sem `index.ts`, o namespace é o nome do arquivo.

### Opções da análise

Todas têm padrão, menos a raiz. Os caminhos são relativos à raiz.

| Opção                  | Padrão                                  | Descrição                                               |
| ---------------------- | --------------------------------------- | ------------------------------------------------------- |
| `root`                 | (obrigatória)                           | A pasta do projeto, a que tem o `src`; absoluta ou relativa ao diretório de trabalho |
| `alias`                | `'@/'`                                  | O alias de import                                       |
| `aliasRoot`            | `'src'`                                 | A pasta para onde o alias aponta                        |
| `pagesDir`             | `'src/pages'`                           | A pasta das telas                                       |
| `requiredPageFiles`    | `['index.tsx', 'model.ts', 'view.tsx']` | Os arquivos de toda tela                                |
| `componentsDir`        | `'src/components'`                      | A pasta dos componentes                                 |
| `allowedComponentDirs` | `['layout', 'shared', 'ui']`            | As únicas subpastas permitidas nela                     |
| `sharedDir`            | `'src/components/shared'`               | A pasta dos componentes compartilhados                  |
| `layoutDir`            | `'src/components/layout'`               | A pasta da casca, que conta como duas telas             |
| `messagesDir`          | `'src/messages'`                        | A pasta das mensagens, com uma subpasta por idioma      |
| `locales`              | `['pt-BR', 'en']`                       | Os idiomas do produto; o primeiro é a referência        |

O `prumo check` da CLI usa as opções padrão. Para outras, chame `check` com as opções do projeto, num script ou num teste (veja [Projeto existente](../guides/existing-project.md#o-prumo-check)).
