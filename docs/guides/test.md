# Testes

Cada gerador do Prumo cria o teste do que gerou, e o `pnpm test` roda todos com o Vitest e o jsdom, sem navegador. Este guia mostra como testar os estados de uma tela, trocar um repositório num teste, testar rotas e navegação e escrever o contrato de um repositório.

## O que o app já traz

| Arquivo               | O que faz                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `vite.config.ts`      | Vitest com `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']` e os testes em `src/**/*.test.{ts,tsx}` |
| `src/test/setup.ts`   | Desmonta os componentes depois de cada teste                                                  |
| `src/test/render.tsx` | O `renderWithProviders` do app                                                                |

O `renderWithProviders` renderiza o componente com os provedores do app (i18n e repositórios), um `QueryClient` só do teste e uma rota em memória do wouter:

- os repositórios são os **em memória e sem latência**, criados de novo a cada render;
- o `QueryClient` é novo a cada render e **sem retry**, então uma falha aparece na hora;
- a rota começa em `/` (ou na opção `path`) e fica registrada no histórico em memória.

```tsx
const { repositories, queryClient, history, navigate, currentPath } = renderWithProviders(
  <ClientesPage />,
  {
    path: '/clientes', // rota inicial (padrão: '/')
    repositories: { clientes: meuRepositorio }, // troca só os domínios que o teste precisa
    queryClient: meuQueryClient, // opcional
  },
)
```

Além desses campos, o resultado tem tudo o que o `render` do Testing Library devolve. A referência completa está em [testing](../reference/testing.md#createrenderwithprovidersbinding).

## O idioma dos testes

O i18n do app detecta o idioma pelo `localStorage` e pelo navegador. No jsdom, o navegador diz `en-US`, então **os testes rodam em inglês** se nada for configurado. Os testes gerados procuram o título da tela, que o `make:page` escreve igual nos dois idiomas, e passam de qualquer jeito; os seus testes podem depender do idioma.

Para fixar o idioma, exporte a instância do i18n e troque o idioma no setup:

```ts
// src/i18n.ts
export const { I18nProvider, useTranslations, i18n } = defineI18n({
  // ...
})
```

```ts
// src/test/setup.ts
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { i18n } from '@/i18n'

await i18n.changeLanguage('pt-BR')

afterEach(cleanup)
```

Os exemplos deste guia supõem os testes em português. Para testar outro idioma num teste específico, chame `await i18n.changeLanguage('en')` nele.

## Testar uma tela

O teste gerado pelo `make:page --domain` confere o título e espera a lista chegar:

```tsx
import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import ClientesPage from '.'

it('mostra o título e, depois de carregar, a lista do domínio', async () => {
  renderWithProviders(<ClientesPage />, { path: '/clientes' })

  expect(screen.getByRole('heading', { name: 'Clientes' })).toBeDefined()
  expect(await screen.findByRole('list')).toBeDefined()
})
```

Prefira procurar pelo papel e pelo nome acessível (`getByRole('heading', { name })`), como o usuário encontra o elemento. Use `findBy*` para o que aparece depois de uma operação assíncrona.

### Estado de erro

Troque o repositório do domínio por um cuja operação falha. O `vi.spyOn` muda só o método que interessa:

```tsx
import { screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MockClientesRepository } from '@/repositories'
import { renderWithProviders } from '@/test/render'
import ClientesPage from '.'

it('mostra o erro quando a lista falha', async () => {
  const clientes = new MockClientesRepository({ latencyMs: 0 })
  vi.spyOn(clientes, 'list').mockRejectedValue(new Error('fora do ar'))

  renderWithProviders(<ClientesPage />, { repositories: { clientes } })

  expect(await screen.findByRole('alert')).toBeDefined()
})
```

### Estado de carregamento

O `createDeferred` do `@matizze/prumo-testing` cria uma promise que o próprio teste resolve. Com ela, o teste confere a tela **durante** o carregamento e depois:

```tsx
import type { Page } from '@matizze/prumo-core/data'
import { createDeferred } from '@matizze/prumo-testing'
import type { ClienteSchema } from '@/schemas'

it('mostra o carregando até a lista chegar', async () => {
  const clientes = new MockClientesRepository({ latencyMs: 0 })
  const response = createDeferred<Page<ClienteSchema>>()
  vi.spyOn(clientes, 'list').mockReturnValue(response.promise)

  renderWithProviders(<ClientesPage />, { repositories: { clientes } })
  expect(screen.getByText('Carregando…')).toBeDefined()

  response.resolve({
    items: [{ id: 'c1', name: 'Ana Souza', createdAt: '2026-01-05T12:00:00.000Z' }],
    total: 1,
  })
  expect(await screen.findByText('Ana Souza')).toBeDefined()
})
```

### Lista vazia

```tsx
it('avisa quando não há clientes', async () => {
  const clientes = new MockClientesRepository({ latencyMs: 0 })
  vi.spyOn(clientes, 'list').mockResolvedValue({ items: [], total: 0 })

  renderWithProviders(<ClientesPage />, { repositories: { clientes } })

  expect(await screen.findByText('Nenhum cliente cadastrado.')).toBeDefined()
})
```

### Interações

Para clicar e digitar, use o `fireEvent` do Testing Library (já instalado) ou acrescente o `@testing-library/user-event`, que simula a interação de forma mais fiel:

```tsx
import { fireEvent, screen } from '@testing-library/react'

fireEvent.change(screen.getByRole('textbox', { name: 'Buscar' }), { target: { value: 'ana' } })
fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
```

Depois de uma mutation, confira a tela ou o próprio repositório, que o resultado do render devolve:

```tsx
const { repositories } = renderWithProviders(<ClientesPage />)
// ... remove pela interface
expect((await repositories.clientes.list()).total).toBe(2)
```

## Rotas e navegação

### Rotas com parâmetro

O parâmetro de rota só existe dentro de uma `<Route>`. Renderize a tela dentro da rota, com o caminho inicial já com o parâmetro:

```tsx
// src/pages/cliente/index.test.tsx
import { Route } from 'wouter'
import ClientePage from '.'

it('mostra o cliente da rota', async () => {
  renderWithProviders(
    <Route path="/clientes/:id">
      <ClientePage />
    </Route>,
    { path: '/clientes/cliente-1' },
  )

  expect(await screen.findByText('Exemplo 1')).toBeDefined()
})
```

### Navegação

Renderize o `App` inteiro para testar a troca de tela. O `navigate` e o `currentPath` do resultado controlam e conferem a rota em memória. Ponha esse teste fora da pasta das telas (por exemplo, em `src/app.test.tsx`): um arquivo dentro de `src/pages/<tela>/` que importa outra tela viola a regra `no-cross-page-import`, testes incluídos.

```tsx
// src/app.test.tsx
import { act, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from '@/App'
import { renderWithProviders } from '@/test/render'

it('vai da tela inicial para a lista de clientes', async () => {
  const { navigate, currentPath } = renderWithProviders(<App />, { path: '/' })

  act(() => navigate('/clientes'))

  expect(currentPath()).toBe('/clientes')
  expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeDefined()
})
```

O `history` lista as rotas visitadas; navegar com `{ replace: true }` troca a última entrada, como o `AuthGuard` faz ao redirecionar para o login.

## Testar um componente

Componentes recebem tudo por props, então o `render` simples do Testing Library basta, como no teste gerado pelo `make:component`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Resumo } from './resumo'

it('mostra o título', () => {
  render(<Resumo title="Exemplo" />)

  expect(screen.getByRole('heading', { name: 'Exemplo' })).toBeDefined()
})
```

Use o `renderWithProviders` só quando o componente usa um provedor (um hook de query, o i18n).

## Testar um repositório: o contrato

O contrato descreve o que o produto espera de um repositório, não o que uma implementação faz. Ele é declarado uma vez e roda contra cada implementação:

```ts
import { defineContractSuite, runContractSuite } from '@matizze/prumo-testing/contract'

const clientesContract = defineContractSuite<IClientesRepository>(
  'IClientesRepository contract',
  ({ repo, create }) => {
    it('remove um registro', async () => {
      await repo.remove('cliente-1')
      expect((await repo.list()).total).toBe(MOCK_CLIENTES.length - 1)
    })

    it('instâncias não compartilham estado', async () => {
      const other = create()
      await repo.remove('cliente-1')
      expect((await other.list()).total).toBe(MOCK_CLIENTES.length)
    })
  },
)

runContractSuite(clientesContract, {
  name: 'MockClientesRepository',
  create: () => new MockClientesRepository({ latencyMs: 0 }),
})
```

- **`repo`** é uma instância nova a cada teste. Use-a como uma variável comum: `vi.spyOn(repo, 'list')`, `repo instanceof MockClientesRepository` e atribuições funcionam.
- **`create`** cria mais uma instância, para o teste que precisa de duas.
- **`dispose`**, opcional na implementação, roda depois de cada teste, também quando ele falha: é onde se apaga um banco ou se restaura uma API de teste.
- O título de cada grupo é `<contrato>: <implementação>`, então a saída do Vitest mostra qual implementação falhou.

Para rodar o mesmo contrato contra a implementação HTTP, veja [Ligar uma API real](real-api.md#6-rode-o-contrato-contra-a-api).

## Setup mais completo do DOM

O `setup.ts` gerado só desmonta os componentes. O `setupDom` do `@matizze/prumo-testing/dom` faz mais, para apps que usam APIs do navegador que o jsdom não tem:

```ts
// src/test/setup.ts
import { setupDom } from '@matizze/prumo-testing/dom'
import { i18n } from '@/i18n'

await i18n.changeLanguage('pt-BR')

setupDom({
  // roda depois de cada teste, antes de limpar cookies e localStorage
  onReset: () => void i18n.changeLanguage('pt-BR'),
})
```

Ele instala um `window.matchMedia` controlável, o `scrollTo` e o `elementFromPoint`, aumenta o tempo máximo do `findBy*` e do `waitFor` para 5 s e, depois de cada teste, desmonta os componentes e limpa cookies, `localStorage` e a classe e o estilo do `<html>`. Com ele, o `afterEach(cleanup)` sai do setup.

Para testar um layout responsivo ou o tema escuro, mude o resultado de uma media query:

```ts
import { setMediaQuery } from '@matizze/prumo-testing/dom'

setMediaQuery('(max-width: 640px)', true) // notifica quem escuta 'change'
```

Toda media query começa sem casar (`matches: false`), o equivalente a desktop e tema claro, e volta a esse estado depois de cada teste.

## Rodar os testes

```bash
pnpm test                          # todos
pnpm test src/pages/clientes       # uma pasta
pnpm exec vitest                   # modo observação
pnpm verify                        # typecheck, lint, check e testes
```
