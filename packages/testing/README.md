# @matizze/prumo-testing

Utilitários de teste do [Prumo](https://github.com/matizze/prumo), sem interface, para o Vitest com jsdom: `renderWithProviders` com rota em memória, setup do DOM, `matchMedia` controlável, `createDeferred` e o teste de contrato de repositórios.

**[Documentação](https://github.com/matizze/prumo/blob/main/docs/README.md)** · **[Referência deste pacote](https://github.com/matizze/prumo/blob/main/docs/reference/testing.md)** · **[Guia de testes](https://github.com/matizze/prumo/blob/main/docs/guides/test.md)** · **[Changelog](https://github.com/matizze/prumo/blob/main/packages/testing/CHANGELOG.md)**

## Instalação

Um app criado pelo `prumo new` já tem o pacote e o `renderWithProviders` ligado em `src/test/render.tsx`. Num projeto existente:

```bash
pnpm add -D @matizze/prumo-testing
```

`react`, `react-dom`, `@tanstack/react-query`, `@testing-library/react`, `vitest` e `wouter` são *peer dependencies*: o pacote usa as instâncias do projeto.

## Módulos

| Subcaminho                        | O que tem                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@matizze/prumo-testing`          | `createRenderWithProviders`, `createTestQueryClient`, `createTestRepositories` e `createDeferred` |
| `@matizze/prumo-testing/dom`      | `setupDom` e o `matchMedia` controlável (`installMatchMedia`, `setMediaQuery`, `resetMatchMedia`) |
| `@matizze/prumo-testing/contract` | `defineContractSuite` e `runContractSuite`: o mesmo contrato contra cada implementação de um repositório |

## Exemplo

```tsx
// src/test/render.tsx: a ligação do app, feita uma vez
export const renderWithProviders = createRenderWithProviders<RepositoryContainer>({
  Providers, // i18n e repositórios do app
  createRepositories: (overrides) => ({ ...createRepositories({ dataSource: 'memory', latencyMs: 0 }), ...overrides }),
  createQueryClient: () => createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
})

// um teste: troca só o repositório que interessa
it('mostra o erro quando a lista falha', async () => {
  const clientes = new MockClientesRepository({ latencyMs: 0 })
  vi.spyOn(clientes, 'list').mockRejectedValue(new Error('fora do ar'))

  renderWithProviders(<ClientesPage />, { path: '/clientes', repositories: { clientes } })

  expect(await screen.findByRole('alert')).toBeDefined()
})
```

```ts
// o contrato de um repositório, rodado contra o mock (e, depois, contra a API)
const contract = defineContractSuite<IClientesRepository>('IClientesRepository contract', ({ repo }) => {
  it('lista as fixtures', async () => {
    expect((await repo.list()).total).toBe(MOCK_CLIENTES.length)
  })
})

runContractSuite(contract, {
  name: 'MockClientesRepository',
  create: () => new MockClientesRepository({ latencyMs: 0 }),
})
```

## Suporte

Mantido pela [Matizze](https://github.com/matizze). Problemas e sugestões em [issues](https://github.com/matizze/prumo/issues).
