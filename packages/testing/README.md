# @matizze/prumo-testing

Utilitários de teste do Prumo, sem interface: `renderWithProviders` com rota em memória, setup do DOM, `matchMedia` controlável, `createDeferred` e o teste de contrato de um repositório.

**Situação:** o Prumo é uma ferramenta sem frontend ([docs/plano.md](../../docs/plano.md)), então o pacote só tem o que testa a lógica e as camadas de um produto no Vitest com jsdom; testar a interface é do produto. Nada foi publicado: o pacote segue `"private": true`.

## Build e empacotamento

No workspace, o `exports` do pacote aponta para o código-fonte (`src/*.ts`). Fora do monorepo o Node não faz type stripping dentro de `node_modules`, então o pacote tem `tsconfig.build.json` e o script `build` (`pnpm --filter @matizze/prumo-testing run build`), que emite o `dist/` com `.js` e `.d.ts`, sem os testes, as fixtures e os arquivos de apoio. O `publishConfig` troca `exports` para o `dist/`, e o tarball leva só o `dist/`, o `package.json` e o README. `pnpm pack:all`, na raiz, empacota os cinco pacotes.

## Módulos

Cada módulo tem um subcaminho próprio, para que importar um deles não traga as dependências dos outros.

| Subcaminho                        | O que tem                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@matizze/prumo-testing`          | `createRenderWithProviders`, a fábrica do `renderWithProviders` do produto; `createTestRepositories` e `createTestQueryClient`; `createDeferred`, a promise que o teste resolve ou rejeita |
| `@matizze/prumo-testing/dom`      | `setupDom`, o setup do jsdom para o `setupFiles` do Vitest; `installMatchMedia`, `setMediaQuery` e `resetMatchMedia`, o `window.matchMedia` controlável                                    |
| `@matizze/prumo-testing/contract` | `defineContractSuite` e `runContractSuite`: o teste de contrato de um repositório, que roda o mesmo conjunto de casos contra o mock e contra outra implementação                           |

## Dependências

`react`, `react-dom`, `@tanstack/react-query`, `@testing-library/react`, `wouter` e `vitest` são `peerDependencies`: o produto já os tem, e o pacote usa as instâncias dele. O pacote não importa o produto (nada de `@/`): o que é do produto entra por parâmetro.

## Ligar ao produto

O pacote faz o que é comum a todo produto, e o produto liga o resto num arquivo seu (por exemplo, `src/test/`). Os testes importam desse arquivo, então o pacote pode mudar sem tocar nos testes.

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

Opções que são do produto, como o idioma do teste, ficam num `renderWithProviders` do produto que chama este.

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
- **Os hooks dos casos** (`beforeEach` e `afterEach` de `defineContractSuite`, por exemplo um relógio falso) rodam antes da criação do repositório, e os `afterEach` depois do `dispose`.
- **O `dispose`:** roda uma vez depois de cada teste, também quando ele falha. Uma implementação com banco (Dexie) cria um por teste no `create` e o apaga ali.
- **Os dados:** os casos que dependem dos dados do mock (as 18 fixtures de `customers`) só valem para uma implementação que parte dos mesmos dados. A outra implementação recebe a mesma semente no `create`, ou deixa esses casos fora do contrato dela. Os casos que não dependem de dados (ordenação, validação, erros e concorrência) valem para qualquer implementação.
- **Fora do contrato:** o teste da fábrica (`createXRepository`) e o de migração de um banco não são do contrato, porque não valem para toda implementação: ficam num `describe` próprio do mesmo arquivo.

## Testes

`pnpm --filter @matizze/prumo-testing run test`: providers de mentira (render, rota em memória com `navigate` com e sem `replace`, container com `overrides`, `QueryClient`), `createDeferred` resolvendo e rejeitando, o `matchMedia` notificando o `change` e o `setupDom` limpando o jsdom; e o contrato (instância nova por teste, `dispose`, a ordem dos hooks e, num Vitest filho sobre um fixture, o mesmo contrato passando na implementação certa e falhando na que tem defeito).
