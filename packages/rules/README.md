# @matizze/prumo-rules

Regras da arquitetura do Prumo: plugin de ESLint, com aviso no editor, e análise do projeto inteiro para o prumo check.

**Situação:** Fase 4 concluída: a análise `references` do `prumo check` confere o que o `AGENTS.md` (e o `docs/patterns.md`) cita entre crases, e `@matizze/prumo-rules/check` exporta o código das seções geradas entre marcadores (`findSections` e `replaceSection`), que o catálogo e o `prumo agents` usam; o resultado da fase está em [docs/fase-4.md](../../docs/fase-4.md#resultado). Fase 1, extração concluída: o plugin de ESLint e a análise do projeto vieram do app de referência (`apps/reference`), que agora roda as duas. O plano está em [docs/fase-1.md](../../docs/fase-1.md). Fase 3 concluída: o pacote ganhou o build com o `tsc` e sai empacotado com `dist/`, pronto para a publicação (que ainda não aconteceu; veja [docs/publicacao.md](../../docs/publicacao.md)). O cli usa as regras e a análise daqui no `prumo check`, nos `make:*`, no `prumo add` e no `prumo promote` (que rodam a conferência ao terminar), num produto novo também; o `prumo doctor` não as usa (ele confere o ambiente: Node, pnpm, versões dos pacotes, registry de UI e variáveis).

## Build e empacotamento

No workspace, o `exports` do pacote aponta para o código-fonte (`src/*.ts`). Fora do monorepo o Node não faz type stripping dentro de `node_modules`, então o pacote tem `tsconfig.build.json` e o script `build` (`pnpm --filter @matizze/prumo-rules run build`), que emite o `dist/` com `.js` e `.d.ts` (sem os testes, as fixtures e os arquivos de apoio deles). O `publishConfig` do `package.json` troca `exports` para o `dist/` e define o registry `https://npm.pkg.github.com` (acesso restrito); o `pnpm pack` aplica essa troca, e o tarball leva só o `dist/`, o `package.json` e o README. O pacote continua `"private": true`: nada é publicado até uma pessoa tirar o `private` e fazer a primeira publicação (o que falta está em [.changeset/README.md](../../.changeset/README.md#o-que-falta-para-publicar)). `pnpm pack:all`, na raiz, empacota os cinco pacotes numa pasta.

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

| Verificação          | O que cobra                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components-folders` | `src/components` só tem as subpastas permitidas (`ui`, `shared` e `layout`). Pasta de fora acusa; pasta que falta, não                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `shared-usage`       | O que está em `src/components/shared` é usado por 2 ou mais telas. O uso conta pelo grafo de imports (lidos por expressão regular), a casca do layout conta como duas telas, e teste e story não contam                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `page-structure`     | Toda pasta de `src/pages` tem `index.tsx`, `model.ts` e `view.tsx`: a mesma regra do `prumo/page-structure`, que no ESLint só vê a tela que já tem `index.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `messages`           | Textos completos: os idiomas têm as mesmas chaves, cada chave usa os mesmos argumentos ICU em todos eles (interpolação, `plural`, `select` e formatos como `date`) e nenhuma mensagem fica vazia. O JSON malformado e o ICU que não fecha também acusam                                                                                                                                                                                                                                                                                                                                                                                |
| `references`         | O que os arquivos de texto dos agentes (`AGENTS.md` e `docs/patterns.md`, se existirem) citam entre crases existe no projeto: caminho (`src/`, `docs/`, `scripts/`, `public/`, `.mcp.json`, `registry.json`, `components.json`, `package.json`), rota (o `src/App.tsx` a declara), story (o `title` de um `*.stories.tsx`) e item do registry (`@matizze/<item>`, no `registry.json`; os `@matizze/prumo-*` são pacotes). Bloco de código, comentário HTML e trecho com `<`, `>`, `*`, `{` ou `}` (padrão) ficam de fora. A mensagem diz o trecho e o que fazer, e numa seção gerada diz qual gerador rodar (`pnpm exec prumo agents`) |

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
| `referenceFiles`       | Os arquivos cujas citações a `references` confere     | `['AGENTS.md', 'docs/patterns.md']`     |

## Seções geradas (marcadores)

`@matizze/prumo-rules/check` também exporta o código que acha e troca as seções geradas de um texto (um `AGENTS.md`, um `docs/patterns.md`). Um gerador escreve entre dois marcadores, cada um numa linha só e com o nome em kebab-case:

```md
<!-- prumo:patterns-table -->

...texto do gerador...
<!-- /prumo:patterns-table -->
```

O que está entre as duas linhas é do gerador e se perde na próxima geração; o que está fora é do autor e nunca é tocado. Marcador dentro de um bloco de código cercado (` ``` ` ou `~~~`) é exemplo e não conta.

```ts
import { findSections, replaceSection } from '@matizze/prumo-rules/check'

const { sections, problems } = findSections(text)
// sections: [{ name, body, openLine, closeLine }]; problems: marcador sem par ou nome repetido
const updated = replaceSection(text, 'patterns-table', '\n| ... |\n\n')
```

- `findSections(text)` devolve as seções bem formadas, na ordem do texto, e os problemas: um marcador que abre e não fecha (`unclosed`), que fecha sem ter aberto ou fecha outra seção (`unopened`) e um nome que forma mais de uma seção (`repeated`, e nenhuma delas é devolvida). O `body` é o texto entre os marcadores, com cada linha terminada em `\n`.
- `replaceSection(text, name, body)` troca só o corpo da seção, byte a byte no resto. O `body` entra como está (linhas em branco nas pontas ficam: o gerador põe as que o formatador do arquivo pede, e passar o `body` que o `findSections` achou deixa o texto igual); vazio esvazia a seção. Lança `SectionError` se o texto não tem a seção (a mensagem diz como acrescentar os marcadores) ou se o marcador dela está errado.

Também exporta `proseLines(text)` (as linhas fora dos blocos de código cercados, com o número delas) e `AGENTS_SECTIONS` (`commands`, `patterns` e `mcp`, as seções do `AGENTS.md` que o `prumo agents` do cli gera).

Quem usa hoje: o gerador do [catálogo](../../catalog/README.md), para o índice de padrões (`patterns-table` e `patterns-summary`), e o `prumo agents` e o `prumo check` do cli, para as seções do `AGENTS.md`. A conferência de seção velha é do cli (o rules não depende dele); a análise `references` daqui só aponta o gerador a rodar quando um trecho citado está numa seção gerada.

## Código-fonte

- `src/eslint/`: o plugin e as regras, cada uma com o teste ao lado (`RuleTester` do ESLint).
- `src/check/`: a análise do projeto, uma verificação por arquivo (e o `sections.ts`, das seções geradas), com o teste nos projetos de `__fixtures__` (um sem violação e um com uma violação plantada por verificação) e no próprio app de referência. O `gate.test.ts` prova que a análise acusa tudo o que o `architecture.test.ts` e o `messages.test.ts` do app acusavam, com uma violação equivalente a cada verificação deles.

**Origem no app de referência:** `src/architecture.test.ts`, `src/i18n/messages.test.ts` e as regras de import do `eslint.config.js`. Os dois testes foram removidos do app quando o `prumo check` entrou no verify dele (R6): o histórico fica em `git log --follow -- apps/reference/src/architecture.test.ts`.
