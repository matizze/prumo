# Sessão e login

O Prumo não traz autenticação: quem entra, com que credencial e com que API é do produto. O que ele traz é o `AuthGuard` (e o `useAuthOrigin`) do core, e um lugar para o resto morar. Este guia mostra um jeito que funciona, com o mesmo lugar em todos os exemplos da documentação: **`src/providers/session/`**.

O exemplo usa um app de pedidos: a pessoa entra com usuário e senha, a API devolve um token de acesso e um de renovação, e algumas telas são só de quem tem o perfil `admin`.

## Um módulo, dois consumidores

A sessão tem dois consumidores que vivem em mundos diferentes:

- as **telas**, dentro do React, que precisam saber quem é a pessoa e reagir quando ela entra ou sai;
- o **cliente HTTP** (veja [Ligar uma API real](real-api.md#2-escreva-o-cliente-http)), fora do React, que precisa do token a cada chamada e de uma renovação quando a API responde 401.

Por isso a sessão é um módulo de TypeScript puro (estado e inscrição, sem React), e o provedor e o hook só o mostram às telas:

```text
src/providers/session/
  session.ts      createSession: estado, login, logout, renovação (sem React)
  index.tsx       SessionProvider e useSession (React)
  app-session.ts  a sessão do app, uma só, com a API e o storage de verdade
```

O módulo puro:

```ts
// src/providers/session/session.ts
import { UIError } from '@matizze/prumo-core/errors'

export interface SessionTokens {
  accessToken: string
  refreshToken: string
}

export interface Usuario {
  id: string
  nome: string
  role: 'admin' | 'user'
}

/** A API de autenticação, por interface: o app usa a real, os testes usam uma falsa. */
export interface AuthApi {
  /** Rejeita com `UIError('CREDENCIAIS_INVALIDAS')` quando usuário ou senha estão errados. */
  login(input: { username: string; password: string }): Promise<SessionTokens>
  /** O usuário do token. Rejeita com `UIError('SESSAO_EXPIRADA')` para token vencido. */
  me(accessToken: string): Promise<Usuario>
  /** Tokens novos. Rejeita com `UIError('SESSAO_EXPIRADA')` quando o refresh token não vale mais. */
  refresh(refreshToken: string): Promise<SessionTokens>
}

/** Onde os tokens ficam entre uma carga da página e outra (o `localStorage`, no app). */
export type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface SessionState {
  status: 'loading' | 'anonymous' | 'authenticated'
  user: Usuario | null
}

const ANONYMOUS: SessionState = { status: 'anonymous', user: null }

export function createSession({ api, storage, storageKey = 'app.sessao' }: {
  api: AuthApi
  storage: SessionStorage
  storageKey?: string
}) {
  const listeners = new Set<() => void>()
  let refreshing: Promise<boolean> | null = null

  const saved = storage.getItem(storageKey)
  let tokens: SessionTokens | null = saved ? (JSON.parse(saved) as SessionTokens) : null
  // Com tokens guardados, a sessão está "carregando" até conferir com a API (`start`)
  let state: SessionState = tokens ? { status: 'loading', user: null } : ANONYMOUS

  function setState(next: SessionState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  function end() {
    tokens = null
    storage.removeItem(storageKey)
    setState(ANONYMOUS)
  }

  function save(next: SessionTokens) {
    tokens = next
    storage.setItem(storageKey, JSON.stringify(next))
  }

  async function doRefresh(): Promise<boolean> {
    const current = tokens
    if (!current) return false
    try {
      const next = await api.refresh(current.refreshToken)
      if (tokens !== current) return false // saiu enquanto renovava: o token novo não vale
      save(next)
      return true
    } catch {
      if (tokens === current) end() // refresh recusado: a sessão acabou
      return false
    }
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** O token de acesso da vez, ou `null` sem sessão: o cliente HTTP lê aqui. */
    getAccessToken: () => tokens?.accessToken ?? null,
    /**
     * Renova depois de um 401 do `usedToken`. Chamadas simultâneas esperam a mesma renovação;
     * quem chega depois dela, com o token velho, só repete a chamada. `false`: a sessão acabou.
     */
    refresh(usedToken?: string): Promise<boolean> {
      if (!tokens) return Promise.resolve(false)
      if (usedToken !== undefined && usedToken !== tokens.accessToken) return Promise.resolve(true)
      refreshing ??= doRefresh().finally(() => {
        refreshing = null
      })
      return refreshing
    },
    /** Confere os tokens guardados com a API. Sem tokens, não faz nada. */
    async start() {
      if (!tokens) return
      try {
        setState({ status: 'authenticated', user: await api.me(tokens.accessToken) })
      } catch (error) {
        if (error instanceof UIError && error.code === 'SESSAO_EXPIRADA') end()
        else setState(ANONYMOUS) // rede fora do ar não prova que a sessão acabou: mantém os tokens
      }
    },
    async login(username: string, password: string) {
      const next = await api.login({ username, password })
      const user = await api.me(next.accessToken)
      save(next)
      setState({ status: 'authenticated', user })
      return user
    },
    logout: end,
  }
}

export type Session = ReturnType<typeof createSession>
```

E a instância do app, uma só, que o cliente HTTP e o provedor compartilham:

```ts
// src/providers/session/app-session.ts
import { createSession } from './session'
import { createHttpAuthApi } from './auth-api' // a sua API de autenticação

export const appSession = createSession({
  api: createHttpAuthApi({ baseUrl: import.meta.env.VITE_API_URL ?? '/api' }),
  storage: window.localStorage,
})
```

A conexão com o cliente HTTP, com a renovação no 401, está em [Ligar uma API real](real-api.md#2-escreva-o-cliente-http).

## Provedor e `useSession`

O provedor entrega a sessão às telas e, quando ela termina (logout, ou renovação recusada), **limpa o cache do TanStack Query**: sem isso, a pessoa seguinte veria os dados da anterior até a próxima busca.

```tsx
// src/providers/session/index.tsx
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { appSession } from './app-session'
import type { Session } from './session'

const SessionContext = createContext<Session | null>(null)

/** Fica dentro do `QueryProvider`. Nos testes, recebe outra sessão pela prop `session`. */
export function SessionProvider({ children, session = appSession }: {
  children: ReactNode
  session?: Session
}) {
  const queryClient = useQueryClient()

  useEffect(() => {
    void session.start()
  }, [session])

  useEffect(() => {
    let previous = session.getState().status
    return session.subscribe(() => {
      const { status } = session.getState()
      if (status === 'anonymous' && previous !== 'anonymous') queryClient.clear()
      previous = status
    })
  }, [session, queryClient])

  return <SessionContext value={session}>{children}</SessionContext>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession precisa do SessionProvider.')
  const { status, user } = useSyncExternalStore(session.subscribe, session.getState)

  return {
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    user,
    isAdmin: user?.role === 'admin',
    login: session.login,
    logout: session.logout,
  }
}
```

Ligue o provedor no `src/providers/app.tsx`, **dentro** do `QueryProvider` (ele usa o `useQueryClient`):

```tsx
// src/providers/app.tsx
<QueryProvider createClient={createClient}>
  <I18nProvider>
    <RepositoryProvider>
      <SessionProvider>{children}</SessionProvider>
    </RepositoryProvider>
  </I18nProvider>
</QueryProvider>
```

## Login e logout

O model da tela de login chama `login` e navega; a tela só mostra. O erro de credencial é um `UIError` com código (`CREDENCIAIS_INVALIDAS`), traduzido pelo `getErrorMessage` (veja [Erros e notificações](errors-and-notifications.md)):

```ts
// src/pages/login/model.ts
import { useState } from 'react'
import { useLocation } from 'wouter'
import { useAuthOrigin } from '@matizze/prumo-core/auth'
import { getErrorMessage } from '@/errors'
import { useTranslations } from '@/i18n'
import { useSession } from '@/providers/session'

export function useLoginModel() {
  const t = useTranslations('login')
  const session = useSession()
  const [, navigate] = useLocation()
  const origin = useAuthOrigin('/pedidos')
  const [error, setError] = useState<string>()

  return {
    title: t('title'),
    error,
    onSubmit: async (username: string, password: string) => {
      setError(undefined)
      try {
        await session.login(username, password)
        navigate(origin, { replace: true })
      } catch (failure) {
        setError(getErrorMessage(failure))
      }
    },
  }
}
```

O logout é `session.logout()` em qualquer ação do model (um botão "Sair" na casca). Como o provedor limpa o cache ao ver a sessão ficar anônima, não há mais nada a fazer.

## Proteger as rotas

O `AuthGuard` recebe o estado da sessão (`isAuthenticated`, `isLoading`) e, com `keepOrigin`, leva a rota pedida até o login, em `?next=`; o `useAuthOrigin` do login a lê de volta. O detalhe, e a proteção contra redirecionamento aberto, estão em [Telas](pages.md#rotas-protegidas).

```tsx
// src/App.tsx
function Autenticada({ children }: { children: ReactNode }) {
  const session = useSession()
  return (
    <AuthGuard isAuthenticated={session.isAuthenticated} isLoading={session.isLoading} keepOrigin>
      {children}
    </AuthGuard>
  )
}
```

### Guarda por perfil

Uma rota só de quem tem um perfil é outro `AuthGuard`, aninhado no primeiro: `isAuthenticated` vira "tem sessão **e** tem o perfil", e `redirectTo` leva a quem não tem para uma tela de "sem acesso". Quem nem tem sessão já foi mandado para o login pelo guarda de fora.

```tsx
function SoAdmin({ children }: { children: ReactNode }) {
  const session = useSession()
  return (
    <AuthGuard
      isAuthenticated={session.isAuthenticated && session.isAdmin}
      isLoading={session.isLoading}
      redirectTo="/sem-acesso"
    >
      {children}
    </AuthGuard>
  )
}

// <Route path="/relatorios"><Autenticada><SoAdmin><RelatoriosPage /></SoAdmin></Autenticada></Route>
```

O guarda esconde a tela, mas **não protege os dados**: a autorização de verdade é da API. O repositório traduz o 403 em `UIError('SEM_PERMISSAO')` (veja [Ligar uma API real](real-api.md#3-implemente-o-contrato)).

## Testar com a sessão

A sessão vem por interface (`AuthApi`) e storage injetados, então o teste cria uma sessão com uma API falsa e a entrega ao provedor pelo `providerProps` do `renderWithProviders`. O passo a passo de declarar o provedor no `src/test/render.tsx` está em [Testes](test.md#provedores-do-app-nos-testes).

```ts
// src/test/session.ts
import { createSession, type AuthApi, type Usuario } from '@/providers/session/session'

export function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

export const ADMIN: Usuario = { id: '1', nome: 'Ana Souza', role: 'admin' }

/** Uma sessão já aberta com `user`, sem rede. */
export async function openSession(user: Usuario) {
  const api: AuthApi = {
    login: async () => ({ accessToken: 'acesso', refreshToken: 'renovacao' }),
    me: async () => user,
    refresh: async () => ({ accessToken: 'acesso-2', refreshToken: 'renovacao-2' }),
  }
  const session = createSession({ api, storage: memoryStorage() })
  await session.login('ana', 'senha')
  return session
}
```

```tsx
it('o perfil comum não vê os relatórios', async () => {
  const session = await openSession({ ...ADMIN, role: 'user' })

  const { currentPath } = renderWithProviders(<App />, {
    path: '/relatorios',
    providerProps: { session },
  })

  await waitFor(() => expect(currentPath()).toBe('/sem-acesso'))
})
```

A renovação no 401 e o logout limpando o cache se testam sem React: o primeiro com um `fetch` falso e a sessão (veja [Cliente HTTP testável](real-api.md#testar-o-cliente-http-sem-rede)), o segundo com um `QueryClient` e o `SessionProvider` num `renderHookWithProviders`.

## Checklist

- [ ] A sessão em `src/providers/session/`, com a API de autenticação e o storage injetados
- [ ] O `SessionProvider` dentro do `QueryProvider`, limpando o cache quando a sessão termina
- [ ] O cliente HTTP lendo o token da mesma sessão e renovando no 401
- [ ] O `AuthGuard` com `keepOrigin` nas rotas protegidas e o `useAuthOrigin` no login
- [ ] Um guarda por perfil onde a tela é restrita (e a API conferindo a permissão de verdade)
- [ ] O `providerProps` do teste com a sessão
