# @matizze/prumo-rules

## 0.2.0

### Minor Changes

- e19be78: O `@matizze/prumo-rules` cobra só a estrutura do projeto, sem nada de interface. Saem as regras de ESLint `ui-boundary`, `icons-from-alias` e `no-inline-svg` (com as opções delas, e o preset `recommended` passa a ligar só `no-cross-page-import` e `page-structure`) e a análise `references` do `prumo check`, que conferia o que o `AGENTS.md` cita entre crases (a opção `referenceFiles` sai junto). Saem também os exports de `@matizze/prumo-rules/check` que serviam às seções geradas do `AGENTS.md`: `findSections`, `replaceSection`, `proseLines`, `AGENTS_SECTIONS` e `SectionError`. Ficam as análises `components-folders` (a `ui` é a pasta que o produto usa para o design system dele, seja qual for: o Prumo só confere o nome), `shared-usage`, `page-structure` e `messages`. O `shared-usage` deixa de ignorar os arquivos `.stories.tsx`, que não existem mais no que o Prumo cobre.

### Patch Changes

- c422a51: Pronto para publicar no GitHub Packages: sem `"private": true` e com `repository` apontando para o repositório.

## 0.1.1

### Patch Changes

- 7a58c82: O pacote passa a sair com `dist/` (`.js` e `.d.ts`), compilado com o `tsc`, pronto para a publicação: o `pnpm pack` troca o `exports` para o `dist/`, e o tarball não leva código-fonte nem testes. No workspace nada muda.
- 7a7db36: O tarball deixa de levar `dist/check/project.js`, um helper de teste que importava o `vitest` (que o pacote não declara): o arquivo virou `src/check/test-support.ts`, que o build já exclui.

## 0.1.0

### Minor Changes

- 52543cb: Novo módulo `@matizze/prumo-rules/check` com `check(options)`, a análise do projeto inteiro, que devolve a lista de violações (`rule`, `file` e `message`). Quatro verificações: `components-folders` (`src/components` só tem as pastas permitidas, por padrão `ui`, `shared` e `layout`), `shared-usage` (o que está em `components/shared` é usado por 2 ou mais telas, pelo grafo de imports, com a casca do layout contando como duas), `page-structure` (toda pasta de tela tem `index.tsx`, `model.ts` e `view.tsx`, mesmo sem o `index.tsx`) e `messages` (os idiomas têm as mesmas chaves e os mesmos argumentos ICU, e nenhuma mensagem fica vazia, lidas de `src/messages/<idioma>/*.json`). A raiz é obrigatória, e o alias, as pastas, a lista de pastas permitidas e os idiomas são opções, com os padrões da arquitetura do Prumo.
- e90f277: O plugin de ESLint ganha a regra `prumo/icons-from-alias`: fora da pasta de ícones (`src/icons`), nada de importar arquivo `.svg` (com ou sem consulta do bundler, como `?react`) nem biblioteca de ícones. A lista padrão é `lucide-react`, `react-icons`, `@heroicons/*`, `@tabler/icons-react` e `@phosphor-icons/react`, e a opção `libraries` a substitui; `iconsDir` muda a pasta de ícones e `iconsImport` muda só o texto da mensagem. Vale para `import`, `import type`, `export ... from` e `import()`. A `configs.recommended` já liga a regra.
- e52f705: O plugin de ESLint ganha a regra `prumo/no-cross-page-import`, que isola as telas: um arquivo de `src/pages/<tela>/` não importa de `src/pages/<outra>/`, nem pelo alias (`@/pages/outra/...`) nem por caminho relativo (`../outra/...`). Vale para `import`, `import type`, `export ... from` e `import()`. O que duas telas usam em comum vai para a pasta de componentes compartilhados. As opções são `alias`, `aliasRoot` e `pagesDir`, e `configs.recommended` já liga a regra.
- e90f277: O plugin de ESLint ganha a regra `prumo/no-inline-svg`, que barra o elemento `<svg>` em JSX nos arquivos `.tsx` de `src/pages` (as telas), para que o ícone venha da pasta de ícones do projeto. As opções são `pagesDir` e `iconsImport` (só para a mensagem), e o resto do código, como a casca do layout, não é verificado. A `configs.recommended` já liga a regra.
- 8f37583: O plugin de ESLint ganha a regra `prumo/page-structure`, que cobra a estrutura da tela: o `index.tsx` de `src/pages/<tela>/` precisa ter ao lado o `model.ts` e a `view.tsx`, e a regra avisa no editor, pelo sistema de arquivos, qual dos dois falta. O `skeleton.tsx` não é cobrado, porque só as telas publicadas no catálogo o têm. As opções são `pagesDir` e `requiredFiles` (padrão `['model.ts', 'view.tsx']`), e `configs.recommended` já liga a regra.
- 3ba9751: O pacote ganha o plugin de ESLint em `@matizze/prumo-rules/eslint` e a primeira regra, `prumo/ui-boundary`. O plugin exporta `{ meta, rules, configs: { recommended } }`, e `configs.recommended` liga as regras com os padrões do Prumo. A `ui-boundary` protege a fronteira do design system: os arquivos de `src/components/ui` só importam de si mesmos, das pastas permitidas do app (`@/icons`, `@/lib/utils` e `@/hooks/use-mobile`) e de pacotes npm, menos o `wouter`. Ela une o `no-restricted-imports` e o teste de arquitetura que o app de referência tinha, que se contradiziam: passam a ser barrados `@/i18n`, `@/schemas`, `@/messages`, os caminhos do app como `@/lib/cookies` e o import relativo que sai da pasta. As opções são `alias`, `aliasRoot`, `designSystemDir`, `allow` e `forbidPackages`, e as mensagens vêm em português. O `eslint` entra como `peerDependency` (`^10.13.0`).

### Patch Changes

- be0fd64: A verificação `messages` do `prumo check` passa a ler o `index.ts` de cada idioma, onde o produto registra os namespaces. Todo JSON da pasta precisa estar importado e exportado nele, o `index.ts` não pode importar JSON que não existe, e os idiomas precisam registrar o mesmo conjunto de namespaces; as violações de chave citam o nome registrado (`addProduct.title`), como o `t()` o usa. Sem `index.ts`, nada muda: o namespace é o nome do arquivo. As regras `ui-boundary`, `no-cross-page-import` e `icons-from-alias` também olham o `import('x')` em posição de tipo (`type Row = import('@/pages/orders/model').OrderRow`). O `eslint` deixa de ser peer dependency obrigatória (agora é opcional), porque o `prumo check` roda sem ele.
- 7d40cb1: A análise de `@matizze/prumo-rules/check` ganha o teste de equivalência com os testes de arquitetura e de mensagens que o app de referência tinha: cada verificação deles (pastas de `src/components`, uso de `components/shared` pelas telas, mesmas chaves, mesmos argumentos ICU e nenhuma mensagem vazia) é plantada num projeto de fixture, e o `check` acusa todas. Nenhuma mudança de comportamento.
