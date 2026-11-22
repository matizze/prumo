# @matizze/prumo-testing

## 0.2.0

### Minor Changes

- e19be78: O `@matizze/prumo-testing` fica só com o que testa lógica e camadas, sem navegador. Saem os subcaminhos `@matizze/prumo-testing/storybook` e `@matizze/prumo-testing/storybook/preview` (`storybookProjects`, `storybookProject`, `a11yParameters`, `storyThemes` e `defaultStoryTheme`) e os peers `@storybook/addon-vitest` e `@vitest/browser-playwright`. Ficam `createRenderWithProviders` (com a rota em memória), `createTestRepositories`, `createTestQueryClient`, `createDeferred`, o `setupDom` e o `matchMedia` controlável (`/dom`) e o teste de contrato (`/contract`).

### Patch Changes

- c422a51: Pronto para publicar no GitHub Packages: sem `"private": true` e com `repository` apontando para o repositório.

## 0.1.0

### Minor Changes

- 3705281: O pacote ganha o teste de contrato e a configuração das stories nos dois temas. `defineContractSuite` declara os casos do contrato de um repositório uma vez, e `runContractSuite` os roda contra o mock e contra qualquer outra implementação (Dexie, HTTP), com uma instância nova por teste e o `dispose` no fim (subcaminho `@matizze/prumo-testing/contract`). `storybookProjects` monta os projetos do Vitest que rodam as stories no Chromium, um por tema, para o `vitest.config.ts` (`@matizze/prumo-testing/storybook`), e `a11yParameters`, `storyThemes` e `defaultStoryTheme` trazem o axe como erro e os dois temas para o `.storybook/preview` (`@matizze/prumo-testing/storybook/preview`, sem dependência do Node). `@storybook/addon-vitest` e `@vitest/browser-playwright` entram como `peerDependencies` opcionais.
- f282392: O pacote ganha os utilitários de teste do app de referência. `createRenderWithProviders` cria o `renderWithProviders` do produto (React Query e Router em memória do wouter por conta do pacote, com `queryClient`, `repositories`, `history`, `navigate` e `currentPath` no retorno), e `createTestRepositories` e `createTestQueryClient` montam o container e o `QueryClient` de um teste a partir das fábricas do produto. `createDeferred` entrega a promise que o teste resolve ou rejeita. O subcaminho `@matizze/prumo-testing/dom` traz `setupDom`, o setup do jsdom para o `setupFiles` do Vitest, e o `matchMedia` controlável (`installMatchMedia`, `setMediaQuery` e `resetMatchMedia`). Os peers são `react`, `react-dom`, `@tanstack/react-query`, `@testing-library/react`, `wouter` e `vitest`.

### Patch Changes

- 7a58c82: O pacote passa a sair com `dist/` (`.js` e `.d.ts`), compilado com o `tsc`, pronto para a publicação: o `pnpm pack` troca o `exports` para o `dist/`, e o tarball não leva código-fonte nem testes. No workspace nada muda.
- 7a7db36: O `repo` do teste de contrato repassa também atribuição, `delete`, `Object.defineProperty`, `Object.keys`, o descritor e o protótipo para a instância do teste: `vi.spyOn(repo, 'list')` passa a ver as chamadas (antes o spy gravava no alvo vazio do proxy e o teste usava o método real, sem erro), `repo.metodo = ...` troca o método, `repo instanceof Repositorio` vale e `repo.list === repo.list`.
