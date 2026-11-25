# Design system

O Prumo não traz interface: as views que ele gera usam só React e HTML semântico, sem classe nem componente de biblioteca visual. Este guia mostra onde a interface do produto entra, como trocar uma view gerada por componentes do seu design system e como ligar a casca do layout e as notificações.

## Por que o Prumo não tem interface

A arquitetura do Prumo separa o que a tela **faz** (o model) do que ela **parece** (a view). Essa separação só se sustenta se a ferramenta não tomar partido sobre a aparência. Por isso:

- o mesmo app pode usar o design system da empresa, o de um cliente ou nenhum;
- trocar de biblioteca visual muda as views e os componentes de `ui`, e nada mais;
- as regras, os geradores e os testes do Prumo valem igual para qualquer interface.

## Onde a interface mora

| Peça                               | Onde                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- |
| Componentes do design system       | `src/components/ui/`, ou um pacote npm importado direto nas views    |
| Componentes do produto, compartilhados | `src/components/shared/`                                         |
| Casca do app (cabeçalho, menu)     | `src/components/layout/`                                             |
| Componentes de uma tela só         | `src/pages/<tela>/components/`                                       |
| Estilos globais, tema, fontes      | Onde o produto preferir, importados no `src/main.tsx`                |

A pasta `ui` é do design system, seja qual for: componentes copiados para o projeto (no estilo do shadcn/ui) ou adaptadores sobre uma biblioteca. O Prumo só confere o nome da pasta (a regra `components-folders` aceita `ui`, `shared` e `layout`) e nunca o conteúdo. Se o design system vem de um pacote npm, a pasta `ui` pode nem existir: as views importam do pacote.

## Trocar uma view gerada

A view gerada pelo `make:page --usecase` é HTML puro:

```tsx
export function ClientesView(m: ClientesModel) {
  return (
    <main>
      <h1>{m.title}</h1>
      {m.loading ? (
        <p>{m.loadingText}</p>
      ) : m.failed ? (
        <p role="alert">{m.failedText}</p>
      ) : (
        <ul>
          {m.items.map((i) => (
            <li key={i.id}>{i.name}</li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

Para ligar o design system, reescreva a view com os componentes dele. O model não muda:

```tsx
import { Alert } from '@/components/ui/alert'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Table } from '@/components/ui/table'
import type { ClientesModel } from './model'

export function ClientesView(m: ClientesModel) {
  return (
    <>
      <PageHeader title={m.title} />
      {m.loading ? (
        <Skeleton rows={5} aria-label={m.loadingText} />
      ) : m.failed ? (
        <Alert variant="error">{m.failedText}</Alert>
      ) : (
        <Table
          rows={m.items}
          columns={[{ key: 'name', header: m.nameHeader }]}
          getRowId={(item) => item.id}
        />
      )}
    </>
  )
}
```

Os componentes acima são ilustrativos; use os do seu design system. Três cuidados mantêm a arquitetura:

- **A view continua sem dados.** Mesmo com componentes ricos (uma tabela com ordenação, um formulário), o estado de dados e as ações vêm do model. Uma tabela que ordena chama `m.onSortChange`, e o model passa a ordem para o hook de query.
- **Todo texto vem do model.** Cabeçalhos de coluna, rótulos e mensagens de estado vazio entram nos JSONs de mensagens e chegam pela view já traduzidos (`m.nameHeader`).
- **Atualize o teste da tela** se ele procurava um elemento que mudou de papel (uma `list` que virou `table`, por exemplo).

## A casca do layout

A casca (cabeçalho, menu lateral, rodapé) mora em `src/components/layout/` e envolve as rotas no `App.tsx`:

```tsx
// src/App.tsx
import { Route, Switch } from 'wouter'
import { AppShell } from '@/components/layout/app-shell'
import ClientesPage from '@/pages/clientes'
import HomePage from '@/pages/home'

export default function App() {
  return (
    <AppShell>
      <Switch>
        <Route path="/">
          <HomePage />
        </Route>
        <Route path="/clientes">
          <ClientesPage />
        </Route>
      </Switch>
    </AppShell>
  )
}
```

O `make:page` continua registrando as rotas: ele procura o `<Switch>` mais externo do arquivo, esteja onde estiver.

### A casca só nas rotas protegidas

Envolver o `<Switch>` inteiro põe o menu em **todas** as rotas, inclusive no `/login`, que não deve ter menu. Quando algumas telas ficam sem a casca, ponha-a dentro de um componente de rota protegida, que junta o `AuthGuard` e o `AppShell`, e deixe o login fora dele:

```tsx
// src/App.tsx
import { AuthGuard } from '@matizze/prumo-core/auth'
import type { ReactNode } from 'react'
import { Redirect, Route, Switch } from 'wouter'
import { AppShell } from '@/components/layout/app-shell'
import LoginPage from '@/pages/login'
import PedidosPage from '@/pages/pedidos'
import { useSession } from '@/providers/session'

/** Rota que exige sessão aberta e vem dentro da casca do app. */
function Autenticada({ children }: { children: ReactNode }) {
  const session = useSession()
  return (
    <AuthGuard isAuthenticated={session.isAuthenticated} isLoading={session.isLoading} keepOrigin>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  )
}

export default function App() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/pedidos" replace />
      </Route>
      <Route path="/login">
        <LoginPage />
      </Route>
      <Route path="/pedidos">
        <Autenticada>
          <PedidosPage />
        </Autenticada>
      </Route>
    </Switch>
  )
}
```

O `Switch` continua sendo o mais externo, e o `make:page` continua registrando as rotas nele; a rota nova que você gerar entra sem o `Autenticada`, e envolvê-la é um passo seu. O `/` sem tela `home` redireciona, como em [Telas](pages.md#a-rota-). A sessão e o guarda estão em [Sessão e login](auth.md).

O texto do menu segue a mesma regra das telas: um namespace próprio (`layout.json`, por exemplo) nos dois idiomas, registrado no `index.ts` de cada idioma.

Para o `prumo check`, a casca conta como **duas telas**: ela aparece em todas, então um componente de `shared` usado por ela já é compartilhado.

## Notificações

O `QueryClient` do core notifica os erros de mutation e de refetch pelo `notify` que o produto passa. Ligue-o à notificação do design system em `src/providers/app.tsx`:

```tsx
function createClient() {
  return createQueryClient({
    notify: (message) => toast.error(message),
    getErrorMessage,
  })
}
```

Se o design system exige um provedor (de notificações, de tema), acrescente-o no `AppProvider`. O guia [Erros e notificações](errors-and-notifications.md) explica quando a notificação acontece e como silenciá-la.

## Estilos

O app gerado não tem CSS. O Vite importa CSS, CSS Modules e pré-processadores sem configuração, e aceita plugins para Tailwind e afins: a escolha é do produto. Estilos globais e o tema costumam entrar no `src/main.tsx`:

```tsx
import './styles/global.css'
```

## Testes de interface

Storybook, testes visuais e testes de acessibilidade são do produto. Os testes que o Prumo gera procuram elementos pelo papel e pelo nome acessível (`getByRole('heading', { name })`), então continuam valendo com qualquer design system que respeite a semântica do HTML.
