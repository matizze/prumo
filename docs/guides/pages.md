# Telas

Este guia mostra como criar telas, distribuir o código entre model e view, trabalhar com rotas e navegação e proteger rotas que exigem login.

## Criar uma tela

```bash
pnpm exec prumo make:page pedidos
```

O comando cria `src/pages/pedidos/` (`index.tsx`, `model.ts`, `view.tsx` e `index.test.tsx`), os textos em `src/messages/<idioma>/pedidos.json` e a rota `/pedidos` no `App.tsx`. O nome vai em kebab-case (`pedidos-recentes`); o Prumo deriva `PedidosRecentesPage`, `usePedidosRecentesModel`, `PedidosRecentesView`, o namespace de textos `pedidosRecentes` e a rota `/pedidos-recentes`.

Para uma tela que lista um domínio de dados, passe `--domain`:

```bash
pnpm exec prumo make:page pedidos --domain pedidos
```

O model passa a ler a lista pelo hook do domínio (`usePedidosList`) e a view mostra o carregando, o erro e a lista. O domínio precisa existir (`prumo make:domain pedidos`).

Use `--dry-run` para ver o que seria criado e alterado sem escrever nada.

## Model e view

A regra é simples: **o model decide, a view mostra.**

| No model (`model.ts`)                                  | Na view (`view.tsx`)                              |
| ------------------------------------------------------ | ------------------------------------------------- |
| Ler dados (hooks de `@/queries`)                       | Elementos e componentes visuais                   |
| Textos (`useTranslations`)                             | Ler os campos do model                            |
| Estado da interação (`useState`, filtros, seleção)     | Chamar as ações do model nos eventos              |
| Ações (salvar, remover, navegar)                       | Estado puramente visual (um menu aberto, um hover) |
| Derivar o que a view precisa (`empty`, `canSave`)      |                                                   |

O tipo das props da view é o retorno do model (`ReturnType<typeof usePedidosModel>`), então tudo o que a view precisa passa pelo model, já tipado.

### Exemplo: busca e remoção

```ts
// src/pages/clientes/model.ts
import { useState } from 'react'
import { useTranslations } from '@/i18n'
import { useClientesList, useRemoveCliente } from '@/queries/clientes'

export function useClientesModel() {
  const t = useTranslations('clientes')
  const [search, setSearch] = useState('')
  const list = useClientesList({ search })
  const remove = useRemoveCliente()

  return {
    title: t('title'),
    searchLabel: t('search'),
    removeLabel: t('remove'),
    search,
    onSearchChange: setSearch,
    items: list.data?.items ?? [],
    loading: list.isPending,
    onRemove: (id: string) => remove.mutate(id),
    removing: remove.isPending,
  }
}

export type ClientesModel = ReturnType<typeof useClientesModel>
```

```tsx
// src/pages/clientes/view.tsx
import type { ClientesModel } from './model'

export function ClientesView(m: ClientesModel) {
  return (
    <main>
      <h1>{m.title}</h1>
      <label>
        {m.searchLabel}
        <input value={m.search} onChange={(event) => m.onSearchChange(event.target.value)} />
      </label>
      <ul>
        {m.items.map((item) => (
          <li key={item.id}>
            {item.name}
            <button type="button" disabled={m.removing} onClick={() => m.onRemove(item.id)}>
              {m.removeLabel}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

Os textos novos (`search` e `remove`) entram em `src/messages/pt-BR/clientes.json` e em `src/messages/en/clientes.json`; o `prumo check` acusa o que faltar num dos idiomas.

A mutation `useRemoveCliente` invalida as queries do domínio ao terminar, então a lista se atualiza sozinha.

## Componentes da tela

```bash
pnpm exec prumo make:component filtro --page clientes
```

Cria `src/pages/clientes/components/filtro.tsx` e o teste. Componentes da tela recebem dados e textos por props, como a view: quem traduz e busca é o model.

Quando uma segunda tela precisar do mesmo componente, mova-o para `src/components/shared` (ou gere-o lá com `--shared`). O `prumo check` acusa o componente compartilhado que só uma tela usa.

## Rotas

O `make:page` registra a rota `/<tela>` no `src/App.tsx`. O caminho é seu: edite-o à vontade.

### Rotas com parâmetro

Para uma tela de detalhe, gere a tela e troque o caminho:

```bash
pnpm exec prumo make:page cliente
```

```tsx
// src/App.tsx
<Route path="/clientes/:id">
  <ClientePage />
</Route>
```

O model lê o parâmetro com o `useParams` do wouter e busca o registro:

```ts
// src/pages/cliente/model.ts
import { useParams } from 'wouter'
import { useTranslations } from '@/i18n'
import { useClienteDetail } from '@/queries/clientes'

export function useClienteModel() {
  const t = useTranslations('cliente')
  const { id } = useParams<{ id: string }>()
  const detail = useClienteDetail(id)

  return {
    title: t('title'),
    name: detail.data?.name,
    loading: detail.isPending,
    failed: detail.isError,
  }
}
```

O parâmetro só existe dentro da `<Route>`. No teste, renderize a tela dentro da rota (veja [Testes](test.md#rotas-com-parâmetro)).

### Ordem das rotas

O `<Switch>` do wouter mostra a **primeira** rota que casa com o endereço. Por isso o `make:page` recusa uma rota que repete ou conflita com outra, e uma rota curinga (sem `path`, a de "página não encontrada") deve ficar por último, onde o gerador a mantém.

## Navegação

A navegação é do wouter. Na view, use o `Link`; no model, o `useLocation`:

```tsx
// view.tsx
import { Link } from 'wouter'

<Link href={`/clientes/${item.id}`}>{item.name}</Link>
```

```ts
// model.ts
import { useLocation } from 'wouter'

const [, navigate] = useLocation()
const create = useCreateCliente()

const onSave = (input: ClienteInput) =>
  create.mutate(input, { onSuccess: (created) => navigate(`/clientes/${created.id}`) })
```

## Rotas protegidas

O `AuthGuard` do core mostra o conteúdo só com a sessão aberta e, sem ela, redireciona para o login (trocando a entrada do histórico, para o "voltar" não cair de novo na rota protegida). Ele não conhece a sua autenticação: você passa o estado da sessão.

```tsx
// src/App.tsx
import { AuthGuard } from '@matizze/prumo-core/auth'
import { useSession } from '@/auth' // o hook de sessão do seu produto

export default function App() {
  const session = useSession()

  return (
    <Switch>
      <Route path="/login">
        <LoginPage />
      </Route>
      <Route path="/clientes">
        <AuthGuard isAuthenticated={session.isAuthenticated} isLoading={session.isLoading}>
          <ClientesPage />
        </AuthGuard>
      </Route>
    </Switch>
  )
}
```

| Prop              | Padrão     | O que é                                                    |
| ----------------- | ---------- | ---------------------------------------------------------- |
| `isAuthenticated` | (obrigatória) | Há sessão aberta                                        |
| `isLoading`       | (obrigatória) | A sessão ainda está sendo verificada                    |
| `redirectTo`      | `'/login'` | Para onde ir sem sessão                                    |
| `keepOrigin`      | `false`    | Leva a rota pedida até o login, em `?next=` (veja abaixo)  |
| `fallback`        | `null`     | O que mostrar enquanto a sessão carrega (um spinner, por exemplo) |

### Voltar para a rota pedida depois de entrar

Com `keepOrigin`, o guarda manda a pessoa para `/login?next=%2Fclientes%3Fpage%3D2` (caminho e query da rota que ela pediu). O login lê a origem com `useAuthOrigin` e volta para ela depois de entrar:

```tsx
// src/App.tsx: o guarda guarda a origem
<AuthGuard isAuthenticated={session.isAuthenticated} isLoading={session.isLoading} keepOrigin>
  <ClientesPage />
</AuthGuard>
```

```tsx
// a tela de login: depois de entrar, volta para a origem (ou para /painel)
import { useLocation } from 'wouter'
import { useAuthOrigin } from '@matizze/prumo-core/auth'

function LoginPage() {
  const [, navigate] = useLocation()
  const origin = useAuthOrigin('/painel')

  const onSignIn = async (credentials: Credentials) => {
    await session.signIn(credentials)
    navigate(origin, { replace: true })
  }
  // ...
}
```

O `useAuthOrigin` só devolve **caminho relativo do próprio app** (começa com `/`, nunca `//`, sem esquema nem barra invertida); qualquer outra coisa em `?next=` (`https://outro.site`, `//outro.site`) é ignorada e vale o fallback. Isso fecha o redirecionamento aberto: não leia o `next` por conta própria e navegue direto para ele. Fora do React, use `safeRedirectPath` ou `readOrigin` (`@matizze/prumo-core/auth`). Sem `keepOrigin`, o guarda faz o que sempre fez: vai para `redirectTo`.

## Apagar ou renomear uma tela

Não há comando para isso; o `prumo check` ajuda a não esquecer nada.

Para **apagar** a tela `pedidos`:

1. Apague a pasta `src/pages/pedidos/`.
2. Tire a rota e o import de `src/App.tsx`.
3. Apague `src/messages/<idioma>/pedidos.json` e tire o namespace do `index.ts` de cada idioma.
4. Rode `pnpm verify`: o `tsc` acusa import que sobrou, e o `prumo check` acusa namespace registrado sem arquivo, ou arquivo sem registro.

Para **renomear**, o caminho mais seguro é gerar a tela nova com o nome certo, mover o conteúdo do model, da view e dos textos, e apagar a antiga como acima.
