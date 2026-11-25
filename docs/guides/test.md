# Testes

Cada gerador do Prumo cria o teste do que gerou, e o `pnpm test` roda todos com o Vitest e o jsdom, sem navegador. Este guia mostra como testar os estados de uma tela, trocar um use case num teste, testar rotas e navegação, um hook de query ou mutation e escrever o contrato de um use case.

## O que o app já traz

| Arquivo               | O que faz                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `vite.config.ts`      | Vitest com `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']` e os testes em `src/**/*.test.{ts,tsx}` |
| `src/test/setup.ts`   | Fixa o idioma padrão do app (`pt-BR`) e desmonta os componentes depois de cada teste           |
| `src/test/render.tsx` | O `renderWithProviders` e o `renderHookWithProviders` do app                                  |

O `renderWithProviders` renderiza o componente com os provedores do app (i18n e use cases), um `QueryClient` só do teste e uma rota em memória do wouter:

- os use cases rodam sobre o **`http` de mentira, sem latência**, criados de novo a cada render;
- o `QueryClient` é novo a cada render e **sem retry**, então uma falha aparece na hora;
- a rota começa em `/` (ou na opção `path`) e fica registrada no histórico em memória.

```tsx
const { useCases, queryClient, history, navigate, currentPath } = renderWithProviders(
  <ClientesPage />,
  {
    path: '/clientes', // rota inicial (padrão: '/')
    useCases: { listClientes: meuUseCase }, // troca só os use cases que o teste precisa
    queryClient: meuQueryClient, // opcional
  },
)
```

Além desses campos, o resultado tem tudo o que o `render` do Testing Library devolve. A referência completa está em [testing](../reference/testing.md#createrenderwithprovidersbinding).

## O idioma dos testes

O i18n do app detecta o idioma pelo `localStorage` e pelo navegador. No jsdom, o navegador diz `en-US`, então os testes rodariam em inglês se nada fosse configurado. **O app novo já vem com o idioma fixado**: o `src/i18n.ts` exporta a instância `i18n`, e o `src/test/setup.ts` troca o idioma para o padrão do app (`pt-BR`) antes dos testes:

```ts
// src/test/setup.ts (como o `prumo new` gera)
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { i18n } from '@/i18n'

await i18n.changeLanguage('pt-BR')

afterEach(cleanup)
```

Num app criado por uma versão anterior do `new`, sem isso, exporte a instância (`export const { I18nProvider, useTranslations, i18n } = defineI18n({ ... })` no `src/i18n.ts`) e acrescente essas linhas ao setup.

Os exemplos deste guia supõem os testes em português. Para testar outro idioma num teste específico, chame `await i18n.changeLanguage('en')` nele.

## Testar uma tela

Os exemplos supõem o domínio `clientes` criado com `make:schema clientes` (sem `--fields`, a entidade tem o campo `name`) e `make:usecase clientes --crud`. O teste gerado pelo `make:page --usecase` confere o título e espera a lista chegar:

```tsx
import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import ClientesPage from '.'

it('mostra o título e, depois de carregar, a lista', async () => {
  renderWithProviders(<ClientesPage />, { path: '/clientes' })

  expect(screen.getByRole('heading', { name: 'Clientes' })).toBeDefined()
  expect(await screen.findByRole('list')).toBeDefined()
})
```

Prefira procurar pelo papel e pelo nome acessível (`getByRole('heading', { name })`), como o usuário encontra o elemento. Use `findBy*` para o que aparece depois de uma operação assíncrona.

### Estado de erro

Troque o use case da tela por um cujo `execute` falha. Basta um objeto com o `execute`:

```tsx
import { screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import ClientesPage from '.'

it('mostra o erro quando a lista falha', async () => {
  const listClientes = { execute: vi.fn().mockRejectedValue(new Error('fora do ar')) }

  renderWithProviders(<ClientesPage />, { useCases: { listClientes } })

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
  const response = createDeferred<Page<ClienteSchema>>()
  const listClientes = { execute: vi.fn().mockReturnValue(response.promise) }

  renderWithProviders(<ClientesPage />, { useCases: { listClientes } })
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
  const listClientes = { execute: vi.fn().mockResolvedValue({ items: [], total: 0 }) }

  renderWithProviders(<ClientesPage />, { useCases: { listClientes } })

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

Depois de uma mutation, confira a tela ou o próprio use case, que o resultado do render devolve:

```tsx
const { useCases } = renderWithProviders(<ClientesPage />)
// ... remove pela interface
expect((await useCases.listClientes.execute({})).total).toBe(2)
```

### Formulário

O teste que o `make:page --usecase` gera para um use case de escrita preenche os campos e envia o formulário contra o mock, e confere o aviso de sucesso e a falta de erro:

```tsx
// src/pages/cliente-novo/index.test.tsx
it('envia o formulário contra o mock e mostra o aviso de sucesso', async () => {
  renderWithProviders(<ClienteNovoPage />, { path: '/clientes/novo' })

  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nome 1' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
  fireEvent.click(screen.getByLabelText('Ativo'))
  fireEvent.change(screen.getByLabelText('Plano'), { target: { value: 'basico' } })
  fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: 'Telefone 1' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Cliente novo' }))

  expect(await screen.findByRole('status')).toBeDefined()
  expect(screen.queryByRole('alert')).toBeNull()
})
```

Para o caminho de falha, troque o use case por um cujo `execute` rejeita com um `UIError` (`{ execute: vi.fn().mockRejectedValue(new UIError('CLIENTE_NOT_FOUND', '')) }`) e espere o `alert` com o texto do `errors.json`.

## Rotas e navegação

### Rotas com parâmetro

O parâmetro de rota só existe dentro de uma `<Route>`. Renderize a tela dentro da rota, com o caminho inicial já com o parâmetro. O teste que o `make:page --path /clientes/:id` gera já é assim (e, sem `--usecase`, confere que o valor do parâmetro aparece na tela):

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

## Testar um hook de query ou mutation

Para testar um hook sem montar um componente de mentira, use o `renderHookWithProviders` de `@/test/render`. Ele roda o hook com os mesmos provedores, use cases sobre o `http` de mentira, `QueryClient` sem retry e rota em memória do `renderWithProviders`, e aceita as mesmas opções (`path`, `useCases`, `queryClient`, `providerProps`). O resultado traz o `result.current` do Testing Library e os campos `useCases`, `queryClient`, `navigate`, `history` e `currentPath`. Em geral, o hook é o do model da tela, que chama `useQuery` ou `useMutation` com um use case de `useUseCases()`.

Uma query:

```tsx
import { useQuery } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderHookWithProviders } from '@/test/render'
import { useUseCases } from '@/providers/use-cases'

it('lista os clientes', async () => {
  const { result } = renderHookWithProviders(() => {
    const { listClientes } = useUseCases()
    return useQuery({ queryKey: ['clientes'], queryFn: () => listClientes.execute({}) })
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.total).toBeGreaterThan(0)
})
```

Uma mutation: chame `mutateAsync` dentro do `act` e confira o use case, que o resultado devolve, ou o cache:

```tsx
import { useMutation } from '@tanstack/react-query'
import { act } from '@testing-library/react'

it('cria um cliente', async () => {
  const { result, useCases } = renderHookWithProviders(() => {
    const { createCliente } = useUseCases()
    return useMutation({ mutationFn: (input: ClienteInput) => createCliente.execute(input) })
  })
  const antes = (await useCases.listClientes.execute({})).total

  await act(() => result.current.mutateAsync({ name: 'Ana Souza' }))

  expect((await useCases.listClientes.execute({})).total).toBe(antes + 1)
})
```

Uma operação que envolve mais de um domínio (veja [Regras de negócio e operações entre domínios](use-cases.md#regras-de-negócio-e-operações-entre-domínios)) é um use case, e testa-se pelo `execute` dele, com o contrato do use case; o hook da tela só precisa de um teste de que invalida o que deve.

Para uma mutation que falha, troque o use case por um `{ execute: vi.fn().mockRejectedValue(...) }` (como em [Estado de erro](#estado-de-erro)) e espere `await expect(act(() => result.current.mutateAsync(valor))).rejects.toThrow()`. Se o hook recebe argumentos que mudam, use `initialProps` e o `rerender` do resultado.

## Provedores do app nos testes

O `Providers` gerado só conhece o i18n e os use cases. Se o app tem um provedor que muda de teste para teste, como a sessão (logado como bibliotecário, como membro, sem ninguém), declare as opções dele no `src/test/render.tsx`, aceite-as no `Providers` e passe o tipo como segundo parâmetro aos dois criadores. O arquivo gerado traz esse passo a passo comentado.

```tsx
// src/test/render.tsx
interface TestProviderProps {
  session?: Session
}

function Providers({
  children,
  useCases,
  session = createAnonymousSession(),
}: { children: ReactNode; useCases: UseCases } & TestProviderProps) {
  return (
    <I18nProvider>
      <UseCasesProvider value={useCases}>
        <SessionProvider session={session}>{children}</SessionProvider>
      </UseCasesProvider>
    </I18nProvider>
  )
}

export const renderWithProviders = createRenderWithProviders<UseCases, TestProviderProps>(binding)
export const renderHookWithProviders = createRenderHookWithProviders<UseCases, TestProviderProps>(binding)
```

Cada teste escolhe a sessão na opção `providerProps`, tipada pelo app:

```tsx
it('mostra o menu do bibliotecário', async () => {
  renderWithProviders(<PainelPage />, { providerProps: { session: await openSession(BIBLIOTECARIA) } })

  expect(await screen.findByRole('link', { name: 'Empréstimos' })).toBeDefined()
})

it('usa a sessão do membro no hook', () => {
  renderHookWithProviders(() => useMeusEmprestimos(), { providerProps: { session: membroSession } })
})
```

`createAnonymousSession` e `openSession` são funções do app (uma sessão sem ninguém e uma já aberta, com uma API de autenticação falsa e um storage em memória), e ficam em `src/test/`. O `Providers` roda por dentro do `QueryClientProvider` e do `Router` que o pacote põe, então um provedor de sessão que limpa o cache ao sair pode usar o `useQueryClient`.

## Testar um componente

Componentes recebem tudo por props, então o `render` simples do Testing Library basta, como em um teste de componente do produto (ele não é gerado: o Prumo não tem comando de componente):

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

## Testar um use case: o contrato

O contrato descreve o que o produto espera de um use case, não o que uma implementação faz. Cada `make:usecase` já gera o teste dele (`<ação>.usecase.test.ts`): um contrato declarado uma vez, rodando contra o `http` de mentira (as rotas do `.mock.ts`) e, com `API_TEST_URL`, contra a API de teste, mais um teste do `UIError`. O do `auth.sign-in`, como sai do comando:

```ts
// src/use-cases/auth/sign-in.usecase.test.ts
import { defineContractSuite, runContractSuite } from '@matizze/prumo-testing/contract'

const INPUT: SignInInput = { email: 'Email 1', password: 'Password 1' }

const signInContract = defineContractSuite<SignInUseCase>(
  'SignInUseCase contract',
  ({ subject }) => {
    it('aceita um Input válido e devolve o Output', async () => {
      const output = await subject.execute(INPUT)
      expect(SignInOutput.safeParse(output).success).toBe(true)
    })

    it('recusa um Input inválido', async () => {
      await expect(subject.execute(undefined as never)).rejects.toThrow()
    })
  },
)

runContractSuite(signInContract, {
  name: 'mock',
  create: () => new SignInUseCase(createMockHttp(signInRoutes)),
})

it('traduz o erro da API em UIError SIGN_IN_FAILED', async () => {
  const failing = new SignInUseCase(async () => {
    throw new HttpError(500, 'falhou')
  })
  const error = await failing.execute(INPUT).catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(UIError)
  expect(error).toMatchObject({ code: 'SIGN_IN_FAILED' })
})
```

No `--crud`, os cinco testes usam o registro do domínio (`createClientesUseCases({ http, storage })`) e a coleção em memória, que volta às fixtures a cada teste (`clientesCollection.reset()`); o `subject` é então o domínio inteiro (`subject.listClientes.execute({})`). Os use cases `--local` não têm contrato de API: o teste roda a classe contra o `localStorage` do jsdom.

- **`subject`** é uma instância nova a cada teste. Use-a como uma variável comum: `vi.spyOn(subject, 'execute')` e atribuições funcionam.
- **`create`** cria mais uma instância, para o teste que precisa de duas.
- **`dispose`**, opcional na implementação, roda depois de cada teste, também quando ele falha: é onde se restaura uma API de teste.
- O título de cada grupo é `<contrato>: <implementação>`, então a saída do Vitest mostra qual implementação falhou.

Para rodar o mesmo contrato contra a API, veja [Ligar uma API real](real-api.md#4-rode-o-contrato-contra-uma-api-de-teste).

## Setup mais completo do DOM

O `setup.ts` gerado fixa o idioma e desmonta os componentes. O `setupDom` do `@matizze/prumo-testing/dom` faz mais, para apps que usam APIs do navegador que o jsdom não tem:

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
pnpm verify                        # typecheck, lint, testes e check
```
