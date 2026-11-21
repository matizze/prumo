# @matizze/prumo-testing

Utilitários de teste do Prumo: renderWithProviders, rota de memória, teste de contrato contra o mock e a API real, e configuração das stories com axe nos dois temas.

**Situação:** Fase 3, passo H1: o render com providers, a rota em memória, os repositórios de teste, o `createDeferred`, o `matchMedia` controlável e o setup do DOM vieram do `src/test` do app de referência (`apps/reference`), que agora importa deles. O teste de contrato e a configuração das stories chegam no H2. O plano está em [docs/fase-3.md](../../docs/fase-3.md).

## Módulos

Cada módulo tem um subcaminho próprio, para que importar um deles não traga as dependências dos outros.

| Subcaminho                   | O que tem                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@matizze/prumo-testing`     | `createRenderWithProviders`, a fábrica do `renderWithProviders` do produto; `createTestRepositories` e `createTestQueryClient`; `createDeferred`, a promise que o teste resolve ou rejeita |
| `@matizze/prumo-testing/dom` | `setupDom`, o setup do jsdom para o `setupFiles` do Vitest; `installMatchMedia`, `setMediaQuery` e `resetMatchMedia`, o `window.matchMedia` controlável                                    |

## Dependências

`react`, `react-dom`, `@tanstack/react-query`, `@testing-library/react`, `wouter` e `vitest` são `peerDependencies`: o produto já os tem, e o pacote usa as instâncias dele. O pacote não importa o produto (nada de `@/`): o que é do produto entra por parâmetro.

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

## Testes

`pnpm --filter @matizze/prumo-testing run test`: providers de mentira (render, rota em memória com `navigate` com e sem `replace`, container com `overrides`, `QueryClient`), `createDeferred` resolvendo e rejeitando, o `matchMedia` notificando o `change` e o `setupDom` limpando o jsdom.
