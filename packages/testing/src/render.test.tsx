// @vitest-environment jsdom
import { QueryClient, useMutation, useQuery, useQueryClient, type DefaultOptions } from '@tanstack/react-query'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocation } from 'wouter'
import {
  createRenderHookWithProviders,
  createRenderWithProviders,
  createTestQueryClient,
  createTestUseCases,
} from './render.tsx'

afterEach(() => {
  cleanup()
})

// Providers de mentira: o que o produto liga (tema e use cases), sem conhecer o produto
interface FakeUseCases {
  tasks: { list: () => string[] }
  users: { name: () => string }
}

const UseCasesContext = createContext<FakeUseCases | null>(null)
const ThemeContext = createContext('claro')

function useFakeUseCases() {
  const container = useContext(UseCasesContext)
  if (!container) throw new Error('sem UseCasesContext')
  return container
}

function FakeProviders({
  children,
  useCases,
}: {
  children: ReactNode
  useCases: FakeUseCases
}) {
  return (
    <ThemeContext.Provider value="escuro">
      <UseCasesContext.Provider value={useCases}>{children}</UseCasesContext.Provider>
    </ThemeContext.Provider>
  )
}

const createInMemory = (): FakeUseCases => ({
  tasks: { list: () => ['em memória'] },
  users: { name: () => 'Ana' },
})

const createUseCases = vi.fn((overrides: Partial<FakeUseCases> = {}) =>
  createTestUseCases(createInMemory, overrides),
)
const createQueryClient = vi.fn(() =>
  createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
)

const renderWithProviders = createRenderWithProviders<FakeUseCases>({
  Providers: FakeProviders,
  createUseCases,
  createQueryClient,
})

function Probe() {
  const [location] = useLocation()
  const theme = useContext(ThemeContext)
  const useCases = useFakeUseCases()
  return (
    <p>
      {`${location}|${theme}|${useCases.tasks.list().join(',')}|${useCases.users.name()}`}
    </p>
  )
}

describe('createTestQueryClient', () => {
  it('entrega à fábrica do produto os defaultOptions sem retry', () => {
    const factory = vi.fn((options: DefaultOptions) => new QueryClient({ defaultOptions: options }))

    const client = createTestQueryClient(factory)

    expect(factory).toHaveBeenCalledWith({
      queries: { retry: false },
      mutations: { retry: false },
    })
    expect(client.getDefaultOptions().queries?.retry).toBe(false)
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })
})

describe('createTestUseCases', () => {
  it('parte do container do produto e troca só o que o teste pede', () => {
    const container = createTestUseCases(createInMemory, {
      users: { name: () => 'Bia' },
    })

    expect(container.users.name()).toBe('Bia')
    expect(container.tasks.list()).toEqual(['em memória'])
  })

  it('cria um container novo a cada chamada', () => {
    const create = vi.fn(createInMemory)

    const first = createTestUseCases(create)
    const second = createTestUseCases(create)

    expect(create).toHaveBeenCalledTimes(2)
    expect(first).not.toBe(second)
  })
})

describe('renderWithProviders', () => {
  it('renderiza dentro dos providers do produto, com a rota inicial e os use cases', () => {
    renderWithProviders(<Probe />, { path: '/tarefas' })

    expect(screen.getByText('/tarefas|escuro|em memória|Ana')).toBeTruthy()
  })

  it('usa "/" como rota inicial', () => {
    const { currentPath, history } = renderWithProviders(<Probe />)

    expect(screen.getByText('/|escuro|em memória|Ana')).toBeTruthy()
    expect(history).toEqual(['/'])
    expect(currentPath()).toBe('/')
  })

  it('troca só os use cases de overrides', () => {
    const { useCases } = renderWithProviders(<Probe />, {
      useCases: { tasks: { list: () => ['a', 'b'] } },
    })

    expect(screen.getByText('/|escuro|a,b|Ana')).toBeTruthy()
    expect(useCases.tasks.list()).toEqual(['a', 'b'])
    expect(createUseCases).toHaveBeenLastCalledWith({ tasks: expect.any(Object) })
  })

  it('devolve o mesmo container que os componentes recebem', () => {
    const seen: FakeUseCases[] = []
    function Spy() {
      const container = useFakeUseCases()
      useEffect(() => {
        seen.push(container)
      })
      return null
    }

    const { useCases } = renderWithProviders(<Spy />)

    expect(seen[0]).toBe(useCases)
  })

  it('põe o QueryClientProvider com o client da fábrica de teste', async () => {
    const seen: QueryClient[] = []
    function Spy() {
      const client = useQueryClient()
      useEffect(() => {
        seen.push(client)
      })
      const { data } = useQuery({ queryKey: ['x'], queryFn: () => 'carregado' })
      return <p>{data ?? 'carregando'}</p>
    }

    const { queryClient } = renderWithProviders(<Spy />)

    expect(seen[0]).toBe(queryClient)
    expect(createQueryClient).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('carregado')).toBeTruthy()
  })

  it('aceita um queryClient do teste e não chama a fábrica', () => {
    const own = new QueryClient()

    const { queryClient } = renderWithProviders(<Probe />, { queryClient: own })

    expect(queryClient).toBe(own)
    expect(createQueryClient).not.toHaveBeenCalled()
  })

  it('navigate muda a rota e acrescenta à history', () => {
    const { navigate, history, currentPath } = renderWithProviders(<Probe />, { path: '/a' })

    act(() => navigate('/b'))
    act(() => navigate('/c'))

    expect(screen.getByText('/c|escuro|em memória|Ana')).toBeTruthy()
    expect(history).toEqual(['/a', '/b', '/c'])
    expect(currentPath()).toBe('/c')
  })

  it('navigate com replace substitui a última entrada', () => {
    const { navigate, history, currentPath } = renderWithProviders(<Probe />, { path: '/a' })

    act(() => navigate('/b'))
    act(() => navigate('/c', { replace: true }))

    expect(history).toEqual(['/a', '/c'])
    expect(currentPath()).toBe('/c')
  })

  it('repassa as opções do render ao Testing Library', () => {
    const container = document.body.appendChild(document.createElement('section'))

    const { container: used } = renderWithProviders(<Probe />, { container })

    expect(used).toBe(container)
    container.remove()
  })

  it('isola uma renderização da outra: cada uma tem a própria rota e o próprio container', () => {
    const first = renderWithProviders(<Probe />, { path: '/um' })
    const second = renderWithProviders(<Probe />, { path: '/dois' })

    expect(first.history).toEqual(['/um'])
    expect(second.history).toEqual(['/dois'])
    expect(first.useCases).not.toBe(second.useCases)
    expect(first.queryClient).not.toBe(second.queryClient)
  })
})

// Opções do app por teste: a sessão, repassada aos Providers
interface FakeSessionProps {
  session?: string
}

const SessionContext = createContext('ninguém')

function SessionProviders({
  children,
  useCases,
  session = 'ninguém',
}: { children: ReactNode; useCases: FakeUseCases } & FakeSessionProps) {
  return (
    <SessionContext.Provider value={session}>
      <UseCasesContext.Provider value={useCases}>{children}</UseCasesContext.Provider>
    </SessionContext.Provider>
  )
}

const bindingWithSession = {
  Providers: SessionProviders,
  createUseCases: (overrides?: Partial<FakeUseCases>) =>
    createTestUseCases(createInMemory, overrides),
  createQueryClient: () =>
    createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
}

const renderWithSession = createRenderWithProviders<FakeUseCases, FakeSessionProps>(
  bindingWithSession,
)
const renderHookWithSession = createRenderHookWithProviders<FakeUseCases, FakeSessionProps>(
  bindingWithSession,
)

function SessionProbe() {
  return <p>{useContext(SessionContext)}</p>
}

describe('providerProps', () => {
  it('repassa as opções do teste aos Providers, tipadas pelo app', () => {
    renderWithSession(<SessionProbe />, { providerProps: { session: 'bibliotecária' } })

    expect(screen.getByText('bibliotecária')).toBeTruthy()
  })

  it('sem providerProps, os Providers usam o próprio padrão', () => {
    renderWithSession(<SessionProbe />)

    expect(screen.getByText('ninguém')).toBeTruthy()
  })

  it('não vaza a opção para o render do Testing Library', () => {
    const { container } = renderWithSession(<SessionProbe />, {
      providerProps: { session: 'membro' },
    })

    expect(container.querySelector('[session]')).toBeNull()
  })
})

describe('ordem dos provedores', () => {
  it('os Providers do app ficam por dentro do QueryClientProvider e do Router', () => {
    function NeedsBoth({ children }: { children: ReactNode }) {
      const client = useQueryClient()
      const [location] = useLocation()
      return (
        <p>
          {`${client.getQueryCache().getAll().length}|${location}`}
          {children}
        </p>
      )
    }
    const render = createRenderWithProviders({
      Providers: NeedsBoth,
      createQueryClient,
    })

    render(<span />, { path: '/dentro' })

    expect(screen.getByText('0|/dentro')).toBeTruthy()
  })
})

describe('renderHookWithProviders', () => {
  const renderHookWithProviders = createRenderHookWithProviders<FakeUseCases>({
    Providers: FakeProviders,
    createUseCases,
    createQueryClient,
  })

  it('roda o hook dentro dos providers, da rota e do QueryClient', async () => {
    const { result, queryClient, useCases } = renderHookWithProviders(
      () => {
        const [location] = useLocation()
        const container = useFakeUseCases()
        const { data } = useQuery({ queryKey: ['tasks'], queryFn: () => container.tasks.list() })
        return { location, theme: useContext(ThemeContext), data }
      },
      { path: '/tarefas' },
    )

    await waitFor(() => expect(result.current.data).toEqual(['em memória']))
    expect(result.current.location).toBe('/tarefas')
    expect(result.current.theme).toBe('escuro')
    expect(queryClient.getQueryData(['tasks'])).toEqual(['em memória'])
    expect(useCases.users.name()).toBe('Ana')
  })

  it('troca os use cases e testa uma mutation', async () => {
    const rename = vi.fn((name: string) => name)
    const { result } = renderHookWithProviders(
      () => {
        const users = useFakeUseCases().users as { name: () => string; rename: typeof rename }
        return useMutation({ mutationFn: async (name: string) => users.rename(name) })
      },
      { useCases: { users: { name: () => 'Bia', rename } as FakeUseCases['users'] } },
    )

    await act(() => result.current.mutateAsync('Caio'))

    expect(rename).toHaveBeenCalledWith('Caio')
  })

  it('repassa initialProps e permite rerender', () => {
    const { result, rerender } = renderHookWithProviders(
      ({ n }: { n: number }) => n * 2,
      { initialProps: { n: 2 } },
    )

    expect(result.current).toBe(4)
    rerender({ n: 5 })
    expect(result.current).toBe(10)
  })

  it('aceita providerProps e navigate', () => {
    const { result, navigate, currentPath } = renderHookWithSession(
      () => ({ session: useContext(SessionContext), location: useLocation()[0] }),
      { providerProps: { session: 'membro' }, path: '/a' },
    )

    expect(result.current.session).toBe('membro')
    act(() => navigate('/b'))
    expect(result.current.location).toBe('/b')
    expect(currentPath()).toBe('/b')
  })
})

describe('o produto sem use cases', () => {
  it('não precisa declarar o container: o NoContainer dispensa o createUseCases', () => {
    const render = createRenderWithProviders({
      Providers: ({ children }: { children: ReactNode }) => <>{children}</>,
      createQueryClient,
    })

    const { useCases } = render(<p>sem container</p>)

    expect(screen.getByText('sem container')).toBeTruthy()
    expect(useCases).toEqual({})
  })

  it('exige o createUseCases quando o produto declara o container', () => {
    // @ts-expect-error sem o createUseCases, o container de use cases não existiria
    createRenderWithProviders<FakeUseCases>({ Providers: FakeProviders, createQueryClient })
  })
})
