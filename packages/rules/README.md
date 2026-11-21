# @matizze/prumo-rules

Regras da arquitetura do Prumo: plugin de ESLint, com aviso no editor, e análise do projeto inteiro para o prumo check.

**Situação:** Fase 1, extração concluída: o plugin de ESLint e a análise do projeto vieram do app de referência (`apps/reference`), que agora roda as duas. O plano está em [docs/fase-1.md](../../docs/fase-1.md).

## Plugin de ESLint

`@matizze/prumo-rules/eslint` exporta o plugin. O pacote entrega o código-fonte em TypeScript, então o `eslint.config.js` precisa de um Node que execute `.ts` (Node 24 ou mais novo). O `eslint` é peer dependency, na faixa `^10.13.0`, e opcional: só o plugin precisa dele, e o `prumo check` (`@matizze/prumo-rules/check`) roda sem ele.

```js
import prumo from '@matizze/prumo-rules/eslint'

export default [
  // Liga todas as regras da tabela abaixo, com as opções padrão
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
      'prumo/ui-boundary': ['error', { designSystemDir: 'src/design-system' }],
    },
  },
]
```

### Regras

Cada regra olha só os arquivos que protege (uma pasta, ou o projeto menos a pasta de ícones) e deixa os demais passarem, então a config `recommended` vale para o projeto inteiro.

| Regra                        | O que cobra                                                                                                                                                                                                 | Opções                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `prumo/ui-boundary`          | O design system (`src/components/ui`) não conhece o app: importa dele mesmo, das pastas permitidas do app (`@/icons`, `@/lib/utils`, `@/hooks/use-mobile`) e de pacotes npm, menos os proibidos (`wouter`)  | `alias`, `aliasRoot`, `designSystemDir`, `allow` (permitidos do app) e `forbidPackages` (proibidos) |
| `prumo/icons-from-alias`     | Ícone só da pasta de ícones: fora de `src/icons`, nada de importar arquivo `.svg` nem biblioteca de ícones (`lucide-react`, `react-icons`, `@heroicons/*`, `@tabler/icons-react` e `@phosphor-icons/react`) | `iconsDir`, `iconsImport` (só para a mensagem) e `libraries` (a lista de bibliotecas proibidas)     |
| `prumo/no-cross-page-import` | Uma tela não importa da pasta de outra: um arquivo de `src/pages/<tela>/` não importa de `src/pages/<outra>/`, nem pelo alias nem por caminho relativo                                                      | `alias`, `aliasRoot` e `pagesDir` (a pasta das telas)                                               |
| `prumo/no-inline-svg`        | Nenhum SVG solto nas telas: o elemento `<svg>` em JSX dentro de `src/pages/**/*.tsx` vira um ícone da pasta de ícones                                                                                       | `pagesDir` (a pasta das telas) e `iconsImport` (só para a mensagem)                                 |
| `prumo/page-structure`       | Toda tela tem a mesma estrutura: o `index.tsx` de `src/pages/<tela>/` tem ao lado o `model.ts` e a `view.tsx`. O `skeleton.tsx` não é cobrado (só o registry o cobra, nas telas publicadas)                 | `pagesDir` (a pasta das telas) e `requiredFiles` (os arquivos cobrados)                             |

## Análise do projeto (prumo check)

`@matizze/prumo-rules/check` exporta `check(options)`, a análise do projeto inteiro. Ela cobre o que o ESLint não vê, porque a regra olha o conjunto de arquivos, e devolve a lista de violações (`{ rule, file, message }`, com o `file` relativo à raiz do projeto). É o que o comando `prumo check`, do [`@matizze/prumo-cli`](../cli/README.md), roda.

```ts
import { check } from '@matizze/prumo-rules/check'

const violations = check({ root: process.cwd() })
```

| Verificação          | O que cobra                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components-folders` | `src/components` só tem as subpastas permitidas (`ui`, `shared` e `layout`). Pasta de fora acusa; pasta que falta, não                                                                                                                                  |
| `shared-usage`       | O que está em `src/components/shared` é usado por 2 ou mais telas. O uso conta pelo grafo de imports (lidos por expressão regular), a casca do layout conta como duas telas, e teste e story não contam                                                 |
| `page-structure`     | Toda pasta de `src/pages` tem `index.tsx`, `model.ts` e `view.tsx`: a mesma regra do `prumo/page-structure`, que no ESLint só vê a tela que já tem `index.tsx`                                                                                          |
| `messages`           | Textos completos: os idiomas têm as mesmas chaves, cada chave usa os mesmos argumentos ICU em todos eles (interpolação, `plural`, `select` e formatos como `date`) e nenhuma mensagem fica vazia. O JSON malformado e o ICU que não fecha também acusam |

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
- `src/check/`: a análise do projeto, uma verificação por arquivo, com o teste nos projetos de `__fixtures__` (um sem violação e um com uma violação plantada por verificação) e no próprio app de referência. O `gate.test.ts` prova que a análise acusa tudo o que o `architecture.test.ts` e o `messages.test.ts` do app acusavam, com uma violação equivalente a cada verificação deles.

**Origem no app de referência:** `src/architecture.test.ts`, `src/i18n/messages.test.ts` e as regras de import do `eslint.config.js`. Os dois testes foram removidos do app quando o `prumo check` entrou no verify dele (R6): o histórico fica em `git log --follow -- apps/reference/src/architecture.test.ts`.
