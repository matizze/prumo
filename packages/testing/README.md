# @matizze/prumo-testing

Utilitários de teste do [Prumo](https://docs.prumo.matizze.com.br), sem interface, para o Vitest com jsdom: `renderWithProviders` e `renderHookWithProviders` com rota em memória, setup do DOM, `matchMedia` controlável, `createDeferred` e o teste de contrato de use cases.

**[Documentação](https://docs.prumo.matizze.com.br)** · **[Referência deste pacote](https://docs.prumo.matizze.com.br/reference/testing)** · **[Guia de testes](https://docs.prumo.matizze.com.br/guides/test)**

## Instalação

Um app criado pelo `prumo new` já tem o pacote e o `renderWithProviders` ligado em `src/test/render.tsx`. Num projeto existente:

```bash
pnpm add -D @matizze/prumo-testing
```

`react`, `react-dom`, `@tanstack/react-query`, `@testing-library/react`, `vitest` e `wouter` são *peer dependencies*: o pacote usa as instâncias do projeto.

## Módulos

| Subcaminho                        | O que tem                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@matizze/prumo-testing`          | `createRenderWithProviders`, `createRenderHookWithProviders`, `createTestQueryClient`, `createTestUseCases` e `createDeferred` |
| `@matizze/prumo-testing/dom`      | `setupDom` e o `matchMedia` controlável (`installMatchMedia`, `setMediaQuery`, `resetMatchMedia`) |
| `@matizze/prumo-testing/contract` | `defineContractSuite` e `runContractSuite`: o mesmo contrato contra cada implementação de um use case |

## Exemplo

```tsx
// src/test/render.tsx: a ligação do app, feita uma vez
export const renderWithProviders = createRenderWithProviders<UseCases>({
  Providers, // i18n e use cases do app
  createUseCases: (overrides) => ({ ...createAppUseCases({ dataSource: 'mock', latencyMs: 0 }), ...overrides }),
  createQueryClient: () => createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
})

// um teste: troca só o use case que interessa
it('mostra o erro quando a lista falha', async () => {
  const listClientes = { execute: vi.fn().mockRejectedValue(new Error('fora do ar')) }

  renderWithProviders(<ClientesPage />, { path: '/clientes', useCases: { listClientes } })

  expect(await screen.findByRole('alert')).toBeDefined()
})
```

```ts
// o contrato de um use case, rodado contra o mock (e, depois, contra a API)
const contract = defineContractSuite<IUseCase<ListRequest, ListResponse>>('ListClientesUseCase contract', ({ subject }) => {
  it('lista os clientes', async () => {
    expect((await subject.execute({})).total).toBeGreaterThan(0)
  })
})

runContractSuite(contract, {
  name: 'ListClientesUseCase (mock)',
  create: () => new ListClientesUseCase(createMockHttp(routes, { latencyMs: 0 })),
})
```

## Suporte

Mantido pela [Matizze](https://github.com/matizze). Problemas e sugestões em [issues](https://github.com/matizze/prumo/issues). Licença MIT.
