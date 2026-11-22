# @matizze/prumo-testing

Utilitários de teste do Prumo: renderWithProviders, rota de memória, teste de contrato contra o mock e a API real, e configuração das stories com axe nos dois temas.

**Situação:** Fase 3 concluída. O render com providers, a rota em memória, os repositórios de teste, o `createDeferred`, o `matchMedia` controlável e o setup do DOM (H1) e o teste de contrato e a configuração das stories nos dois temas (H2) vieram do app de referência (`apps/reference`), que agora importa deles, e o starter e todo produto novo usam o pacote pela mesma ligação (`src/test/`). O pacote tem o build com o `tsc` e sai empacotado com `dist/`, pronto para a publicação (que ainda não aconteceu; o pacote continua `private`, e o passo a passo está em [docs/publicacao.md](../../docs/publicacao.md)). O plano e o resultado estão em [docs/fase-3.md](../../docs/fase-3.md).

## Build e empacotamento

No workspace, o `exports` do pacote aponta para o código-fonte (`src/*.ts`). Fora do monorepo o Node não faz type stripping dentro de `node_modules`, então o pacote tem `tsconfig.build.json` e o script `build` (`pnpm --filter @matizze/prumo-testing run build`), que emite o `dist/` com `.js` e `.d.ts` (sem os testes, as fixtures e os arquivos de apoio deles). O `publishConfig` do `package.json` troca `exports` para o `dist/` e define o registry `https://npm.pkg.github.com` (acesso restrito); o `pnpm pack` aplica essa troca, e o tarball leva só o `dist/`, o `package.json` e o README. O pacote continua `"private": true`: nada é publicado até uma pessoa tirar o `private` e fazer a primeira publicação (o que falta está em [.changeset/README.md](../../.changeset/README.md#o-que-falta-para-publicar)). `pnpm pack:all`, na raiz, empacota os cinco pacotes numa pasta.

## Módulos

Cada módulo tem um subcaminho próprio, para que importar um deles não traga as dependências dos outros.

| Subcaminho                                 | O que tem                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@matizze/prumo-testing`                   | `createRenderWithProviders`, a fábrica do `renderWithProviders` do produto; `createTestRepositories` e `createTestQueryClient`; `createDeferred`, a promise que o teste resolve ou rejeita |
| `@matizze/prumo-testing/dom`               | `setupDom`, o setup do jsdom para o `setupFiles` do Vitest; `installMatchMedia`, `setMediaQuery` e `resetMatchMedia`, o `window.matchMedia` controlável                                    |
| `@matizze/prumo-testing/contract`          | `defineContractSuite` e `runContractSuite`: o teste de contrato de um repositório, que roda o mesmo conjunto de casos contra o mock e contra outra implementação                           |
| `@matizze/prumo-testing/storybook`         | `storybookProjects` e `storybookProject`: os projetos do Vitest que rodam as stories no Chromium, um por tema (para o `vitest.config.ts`)                                                  |
| `@matizze/prumo-testing/storybook/preview` | `a11yParameters`, `storyThemes` e `defaultStoryTheme`: o axe como erro e os dois temas (para o `.storybook/preview`; sem dependência do Node nem do Vitest)                                |

## Dependências

`react`, `react-dom`, `@tanstack/react-query`, `@testing-library/react`, `wouter` e `vitest` são `peerDependencies`: o produto já os tem, e o pacote usa as instâncias dele. `@storybook/addon-vitest` e `@vitest/browser-playwright` são `peerDependencies` opcionais, só do subcaminho `./storybook`: quem não roda as stories como teste não precisa deles. O pacote não importa o produto (nada de `@/`): o que é do produto entra por parâmetro.

## Ligar ao produto

O pacote faz o que é comum a todo produto, e o produto liga o resto num arquivo seu (no app de referência, `src/test/`). Os testes importam desse arquivo, então o pacote pode mudar sem tocar nos testes.

```tsx
// src/test/render.tsx
import {
  createRenderWithProviders,
  createTestQueryClient as createPackageTestQueryClient,
  createTestRepositories as createPackageTestRepositories,
} from '@matizze/prumo-testing'

export const createTestQueryClient = () => createPackageTestQueryClient(createQueryClient)

export const createTestRepositories = (overrides: Partial<RepositoryContainer> = {}) =>
  createPackageTestRepositories(
    () => createRepositories({ dataSource: 'memory', latencyMs: 0 }),
    overrides,
  )

export const renderWithProviders = createRenderWithProviders({
  // i18n, tema e provedor de repositórios do produto; o container chega em `repositories`
  Providers: AppProviders,
  createRepositories: createTestRepositories,
  createQueryClient: createTestQueryClient,
})
```

`renderWithProviders(ui, { path, repositories, queryClient, ...opçõesDoRender })` renderiza dentro de `Providers`, do `QueryClientProvider` e de um Router em memória do wouter, e devolve o resultado do `render` do Testing Library mais:

- `queryClient`: o client do teste (o da opção, ou um novo da fábrica, sem retry);
- `repositories`: o container, com os `overrides` aplicados;
- `history`, `navigate` e `currentPath()`: as rotas visitadas (navegar com `replace` substitui a última), a navegação e a rota atual.

Opções que são do produto, como o idioma do teste, ficam num `renderWithProviders` do produto que chama este, como faz o app de referência com `locale`.

```ts
// src/test/setup.ts, o setupFiles do projeto de testes unitários (ambiente jsdom)
import '@testing-library/jest-dom/vitest'
import { setupDom } from '@matizze/prumo-testing/dom'

setupDom({
  // roda depois do cleanup e antes de limpar cookies e localStorage
  onReset: () => void i18n.changeLanguage('pt-BR'),
})
```

`setupDom` instala o `matchMedia` controlável, o `scrollTo` e o `elementFromPoint` (que o jsdom não implementa), configura o `asyncUtilTimeout` do Testing Library (5 s, ou o `asyncUtilTimeout` da opção) e registra o `afterEach` que desmonta, zera o `matchMedia`, limpa cookies e `localStorage` e a classe e o estilo do `<html>`. O idioma de partida, o `jest-dom` e o `fake-indexeddb` ficam no `setup.ts` do produto.

## O teste de contrato

O contrato de um repositório é o que o produto espera dele, e não o que uma implementação faz. `defineContractSuite` declara os casos uma vez, e `runContractSuite` os roda contra cada implementação: o mock hoje, e o Dexie ou a API HTTP quando existirem.

```ts
// src/repositories/customers/repository.contract.test.ts
import { defineContractSuite, runContractSuite } from '@/test/contract' // a ligação do app com o pacote

const customersContract = defineContractSuite<ICustomersRepository>(
  'ICustomersRepository contract',
  ({ repo }) => {
    it('lists the 18 fixtures with unique ids', async () => {
      const { items, total } = await repo.list()
      expect(total).toBe(18)
    })
  },
)

runContractSuite(customersContract, {
  name: 'MockCustomersRepository',
  create: () => new MockCustomersRepository({ latencyMs: 0 }),
})
```

- **O que os casos recebem:** `repo`, o repositório do teste em andamento (uma instância nova por teste, criada antes dele), e `create`, que cria mais uma instância no estado de partida, para o teste que precisa de duas. `repo` é uma referência estável que repassa para a instância do teste atual, então os casos o usam como uma variável comum, mas só dentro de um teste ou de um hook (fora deles, lança erro). O proxy repassa leitura, atribuição, `in`, `delete`, `Object.defineProperty`, `Object.keys`, o descritor e o protótipo para a instância: `vi.spyOn(repo, 'list')` vê as chamadas (use o spy que o `spyOn` devolve), `repo.list = ...` troca o método só para aquele teste, e `repo instanceof MockRepository` vale. Os métodos saem presos à instância, e a mesma função é devolvida a cada leitura (`repo.list === repo.list`). Propriedade definida como `configurable: false` é recusada, porque o `repo` é uma referência para a instância de cada teste.
- **O título:** o `describe` sai como `<nome do contrato>: <nome da implementação>`, e um contrato com vários grupos usa `describe` aninhado nos casos.
- **Os hooks dos casos** (`beforeEach` e `afterEach` de `defineContractSuite`, como o relógio falso do `task`) rodam antes da criação do repositório, e os `afterEach` depois do `dispose`.
- **O `dispose`:** roda uma vez depois de cada teste, também quando ele falha. Uma implementação com banco (Dexie) cria um por teste no `create` e o apaga ali (veja o `task` do app de referência).
- **Os dados:** os casos que dependem dos dados do mock (as 18 fixtures de `customers`) só valem para uma implementação que parte dos mesmos dados. A outra implementação recebe a mesma semente no `create`, ou deixa esses casos fora do contrato dela. Os casos que não dependem de dados (ordenação, validação, erros e concorrência) valem para qualquer implementação.
- **Fora do contrato:** o teste da fábrica (`createXRepository`) e o de migração de um banco não são do contrato, porque não valem para toda implementação: ficam num `describe` próprio do mesmo arquivo.

## As stories nos dois temas

```ts
// vitest.config.ts
import { storybookProjects } from '@matizze/prumo-testing/storybook'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        unitProject,
        // um projeto por tema: `storybook` (claro) e `storybook-dark` (escuro)
        ...storybookProjects({
          configDir: path.join(import.meta.dirname, '.storybook'),
          storybookScript: 'pnpm storybook --no-open', // só o projeto claro sobe o Storybook no watch
        }),
      ],
    },
  }),
)
```

```tsx
// .storybook/preview.tsx
import {
  a11yParameters,
  defaultStoryTheme,
  storyThemes,
} from '@matizze/prumo-testing/storybook/preview'

const preview: Preview = {
  decorators: [withThemeByClassName({ themes: storyThemes, defaultTheme: defaultStoryTheme })],
  parameters: { a11y: a11yParameters },
}
```

Cada projeto roda as stories no Chromium sem cabeça (Playwright), com a play function e o axe (`a11y: { test: 'error' }`: violação falha a story). O axe só vê o contraste do tema em que a story renderiza, por isso um projeto por tema, e `--project storybook --project storybook-dark` roda os dois. O projeto herda a configuração do Vite do produto (`extends: true`). O que é do produto fica nele: o `optimizeDeps` do `vitest.config.ts`, o idioma, os providers e os decorators do `.storybook/preview`.

## Testes

`pnpm --filter @matizze/prumo-testing run test`: providers de mentira (render, rota em memória com `navigate` com e sem `replace`, container com `overrides`, `QueryClient`), `createDeferred` resolvendo e rejeitando, o `matchMedia` notificando o `change` e o `setupDom` limpando o jsdom; o contrato (instância nova por teste, `dispose`, a ordem dos hooks e, num Vitest filho sobre um fixture, o mesmo contrato passando na implementação certa e falhando na que tem defeito); e os projetos das stories (o nome, o Chromium sem cabeça e o `initialGlobals` de cada tema, sem abrir o navegador).
