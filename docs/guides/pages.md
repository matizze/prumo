# Telas

Este guia mostra como criar telas, distribuir o código entre model e view, trabalhar com rotas e navegação e proteger rotas que exigem login.

## Criar uma tela

```bash
pnpm exec prumo make:page pedidos
```

O comando cria `src/pages/pedidos/` (`index.tsx`, `model.ts`, `view.tsx` e `index.test.tsx`), os textos em `src/messages/<idioma>/pedidos.json` e a rota `/pedidos` no `App.tsx`. O nome vai em kebab-case (`pedidos-recentes`); o Prumo deriva `PedidosRecentesPage`, `usePedidosRecentesModel`, `PedidosRecentesView`, o namespace de textos `pedidosRecentes` e a rota `/pedidos-recentes`.

Para agrupar telas, use ponto ou barra no nome (`auth.login` e `auth/login` são a mesma coisa):

```bash
pnpm exec prumo make:page auth.login
```

A tela fica em `src/pages/auth/login/`, a rota é `/auth/login`, o componente é `AuthLoginPage` e os textos ficam em `src/messages/<idioma>/auth-login.json`. A pasta `auth`, sem `index.tsx`, só agrupa. Uma tela não fica dentro de outra, e `auth/login` e `auth-login` não coexistem (dariam o mesmo arquivo de mensagens e o mesmo componente).

Para uma tela que lista um domínio de dados, passe `--query`:

```bash
pnpm exec prumo make:page pedidos --query pedidos
```

O model passa a ler a lista pelo hook da query (`usePedidosList`) e a view mostra o carregando, o erro e a lista. A view mostra o primeiro campo de texto de cada registro, lido do schema que o projeto tem (o `name` num schema sem `--fields`; o primeiro campo `string` obrigatório num schema criado com [`--fields`](domains.md#os-campos-do-domínio---fields)). Se o schema não tem campo de texto, ou o Prumo não o encontra, a view mostra o `id` e o comando avisa. A query precisa existir: o fluxo, da camada de baixo para a de cima, é `make:schema` → `make:repository` → `make:query` → `make:page`:

```bash
pnpm exec prumo make:schema pedidos
pnpm exec prumo make:repository pedidos
pnpm exec prumo make:query pedidos
pnpm exec prumo make:page pedidos --query pedidos
```

Sem a query, o `make:page` sai com 2 e diz o comando a rodar (`rode prumo make:query pedidos`).

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

A mutation `useRemoveCliente` tira do cache o detalhe do registro removido e invalida as listas do domínio ao terminar, então a lista se atualiza sozinha e uma tela de detalhe aberta não busca de novo o registro que acabou de sumir (o que viraria uma notificação de "não encontrado").

## Componentes

O Prumo não traz componente de interface: os componentes de UI (botão, campo, tabela, diálogo) vêm do design system do produto, por exemplo o shadcn, que se instala em `src/components/ui`. Veja [Design system](design-system.md). A view gerada usa só tags nativas, e você as troca por esses componentes.

Os componentes do **produto** (um resumo de pedido, um cartão de cliente) se criam à mão, e o lugar depende de quem os usa, o que o `prumo check` confere:

- **Usado só por uma tela:** `src/pages/<tela>/components/` (por exemplo, `src/pages/clientes/components/filtro.tsx`). Recebe dados e textos por props, como a view: quem busca e traduz é o model.
- **Usado por duas ou mais telas:** `src/components/shared/`. O `check` acusa (`shared-usage`) o componente de `shared` que menos de duas telas usam: ele volta para a pasta da tela que o usa.
- **A casca do app** (cabeçalho, menu): `src/components/layout/`.

Quando uma segunda tela precisar de um componente da primeira, mova o arquivo para `src/components/shared` e acerte os imports; o `check` mostra a violação até a segunda tela importá-lo. Uma pasta nova em `src/components` fora de `layout`, `shared` e `ui` também é violação (`components-folders`).

## Rotas

O `make:page` registra a rota `/<tela>` no `src/App.tsx`. Para outro caminho, use `--path` (veja abaixo); o caminho continua seu, e você pode editá-lo depois.

### Rotas com parâmetro

Para uma tela de detalhe, peça o caminho com `--path`:

```bash
pnpm exec prumo make:page cliente --path /clientes/:id
```

A rota entra no `App.tsx` já com o parâmetro:

```tsx
// src/App.tsx
<Route path="/clientes/:id">
  <ClientePage />
</Route>
```

O model gerado lê o parâmetro com o `useParams` do wouter e o devolve, a view o mostra, e os textos continuam nos dois idiomas:

```ts
// src/pages/cliente/model.ts
import { useParams } from 'wouter'
import { useTranslations } from '@/i18n'

export function useClienteModel() {
  const t = useTranslations('cliente')
  const { id } = useParams<{ id: string }>()
  return { title: t('title'), params: { id } }
}
```

O caminho tem **no máximo um parâmetro** (`:nome`, sem `?`, `*` nem `+`); o `make:page` recusa o resto, e o caminho que repete ou conflita com uma rota do `App.tsx`. Precisa de um segundo parâmetro? Gere com um e acrescente o outro ao model à mão.

Com `--query`, a tela é de **detalhe**: o model busca o registro com o `use<Entidade>Detail` da query.

```bash
pnpm exec prumo make:page cliente --query clientes --path /clientes/:id
```

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
    loadingText: t('loading'),
    failedText: t('failed'),
    item: detail.data,
    loading: detail.isPending,
    failed: detail.isError,
  }
}
```

O parâmetro só existe dentro da `<Route>`, e por isso o teste gerado renderiza a tela dentro dela, com um valor de exemplo (o id do primeiro registro do mock, na tela de detalhe), e confere que o valor chega à tela: se a rota e a tela se descasarem, o teste falha. Veja [Testes](test.md#rotas-com-parâmetro).

### Ordem das rotas

O `<Switch>` do wouter mostra a **primeira** rota que casa com o endereço. Por isso o `make:page` recusa uma rota que repete ou conflita com outra, e uma rota curinga (sem `path`, a de "página não encontrada") deve ficar por último, onde o gerador a mantém.

### A rota `/`

O `prumo new` gera a tela `home` na rota `/`. Se o app não tem uma tela `home` (você a apagou, ou o produto começa em outra tela), o `/` fica sem rota e cai na página "não encontrada". Faça-o redirecionar, com o `Redirect` do wouter, para a tela em que o app começa, trocando a entrada do histórico:

```tsx
// src/App.tsx
import { Redirect, Route, Switch } from 'wouter'

<Switch>
  <Route path="/">
    <Redirect to="/painel" replace />
  </Route>
  {/* ... as outras rotas */}
</Switch>
```

Se a tela inicial é protegida, o redirecionamento pode ficar fora do guarda: o `/` manda para `/painel`, e o `AuthGuard` dele manda para o login quando falta sessão.

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

O `AuthGuard` do core mostra o conteúdo só com a sessão aberta e, sem ela, redireciona para o login (trocando a entrada do histórico, para o "voltar" não cair de novo na rota protegida). Ele não conhece a sua autenticação: você passa o estado da sessão. Onde a sessão mora, como o login e o logout funcionam e como proteger por perfil estão em [Sessão e login](auth.md).

```tsx
// src/App.tsx
import { AuthGuard } from '@matizze/prumo-core/auth'
import { useSession } from '@/providers/session' // o hook de sessão do app (veja Sessão e login)

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

Para a casca do app (cabeçalho e menu) só nas rotas protegidas, de modo que o login fique sem menu, veja [Design system](design-system.md#a-casca-só-nas-rotas-protegidas).

## Apagar ou renomear uma tela

Não há comando para isso; o `prumo check` ajuda a não esquecer nada.

Para **apagar** a tela `pedidos`:

1. Apague a pasta `src/pages/pedidos/`.
2. Tire a rota e o import de `src/App.tsx`.
3. Apague `src/messages/<idioma>/pedidos.json` e tire o namespace do `index.ts` de cada idioma.
4. Rode `pnpm verify`: o `tsc` acusa import que sobrou, e o `prumo check` acusa namespace registrado sem arquivo, ou arquivo sem registro.

Para **renomear**, o caminho mais seguro é gerar a tela nova com o nome certo, mover o conteúdo do model, da view e dos textos, e apagar a antiga como acima.
