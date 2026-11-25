# @matizze/prumo-testing

## 0.4.0

### Minor Changes

- 61b3901: O `renderWithProviders` e o `renderHookWithProviders` deixam o container de repositórios: saem o `createRepositories`, a opção `repositories` e o campo `repositories` do resultado, e o `createTestRepositories`. O parâmetro de tipo dos use cases vem primeiro (`createRenderWithProviders<UseCases, ProviderProps>`), e o `createUseCases` passa a ser obrigatório quando o `UseCases` é declarado (só o `NoContainer` o dispensa). No teste de contrato sai o `repo` (o `@deprecated`): use o `subject`. Para migrar, veja o guia [Migrar para use cases](https://docs.prumo.matizze.com.br/guides/migrate-to-use-cases).
- 69b614f: O `createRenderWithProviders` e o `createRenderHookWithProviders` aceitam o container de use cases (`createUseCases`, a opção `useCases` por teste e o campo `useCases` no resultado), com o novo `createTestUseCases`, e o container de repositórios sai (veja o changeset `remove-repositories-testing`). O contexto do contrato ganha `subject`. O `defineContractSuite` e o `runContractSuite` ganham a documentação e o exemplo com use cases (o mesmo contrato contra o mock e contra a API real).

## 0.3.2

### Patch Changes

- 1c5a2bb: Licença MIT, metadados do pacote (palavras-chave, página, relato de problemas, autor e Node 24 ou mais novo) e o README com os links do site da documentação.

## 0.3.1

### Patch Changes

- d60b9c3: Os exemplos do README usam a fonte de dados `mock` (antes `memory`).

## 0.3.0

### Minor Changes

- 1b79171: O `@matizze/prumo-testing` ganha `createRenderHookWithProviders`, que cria o `renderHookWithProviders` do app: o `renderHook` do Testing Library com os mesmos provedores, repositórios, `QueryClient` e rota em memória do `renderWithProviders`, para testar um hook de query ou de mutation sem montar um componente de mentira (devolve também `queryClient`, `repositories`, `history`, `navigate` e `currentPath`). O `createRenderWithProviders` (e o novo `createRenderHookWithProviders`) aceita um segundo parâmetro de tipo com as opções extras de cada teste, passadas na opção `providerProps` e repassadas aos `Providers` do app (a sessão de cada teste, por exemplo), tipadas pelo app. Sem o segundo parâmetro, nada muda para quem já usa. O `src/test/render.tsx` que o `prumo new` gera passa a exportar o `renderHookWithProviders` e traz, comentado, o passo a passo para acrescentar um provedor do app.

### Patch Changes

- 0eb8d2b: O README de cada pacote, que é a página dele no npm, foi reescrito: instalação, uso essencial e links para a documentação completa do Prumo (tutorial, guias e referência). A descrição do `@matizze/prumo-cli` no npm passa a citar todos os comandos.

## 0.2.2

### Patch Changes

- O README publicado no npm deixa de dizer que o pacote não foi publicado e ganha a seção Instalação.

## 0.2.1

### Patch Changes

- 3e763de: Publicado no npm público (`registry.npmjs.org`, acesso público), sem token para instalar.

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
