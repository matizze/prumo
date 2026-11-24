// @vitest-environment jsdom
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type DefaultOptions,
} from '@tanstack/react-query'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocation } from 'wouter'
import {
  createRenderHookWithProviders,
  createRenderWithProviders,
  createTestQueryClient,
  createTestRepositories,
  createTestUseCases,
} from './render.tsx'

afterEach(() => {
  cleanup()
})

// Providers de mentira: o que o produto liga (tema e repositórios), sem conhecer o produto
interface FakeContainer {
  tasks: { list: () => string[] }
  users: { name: () => string }
}

const RepositoryContext = createContext<FakeContainer | null>(null)
const ThemeContext = createContext('claro')

function useFakeRepositories() {
  const container = useContext(RepositoryContext)
  if (!container) throw new Error('sem RepositoryContext')
  return container
}

function FakeProviders({
  children,
  repositories,
}: {
  children: ReactNode
  repositories: FakeContainer
}) {
  return (
    <ThemeContext.Provider value="escuro">
      <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>
    </ThemeContext.Provider>
  )
}

const createInMemory = (): FakeContainer => ({
  tasks: { list: () => ['em memória'] },
  users: { name: () => 'Ana' },
})

const createRepositories = vi.fn((overrides: Partial<FakeContainer> = {}) =>
  createTestRepositories(createInMemory, overrides),
)
const createQueryClient = vi.fn(() =>
  createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
)

const renderWithProviders = createRenderWithProviders({
  Providers: FakeProviders,
  createRepositories,
  createQueryClient,
})

function Probe() {
  const [location] = useLocation()
  const theme = useContext(ThemeContext)
  const repositories = useFakeRepositories()
  return (
    <p>
      {`${location}|${theme}|${repositories.tasks.list().join(',')}|${repositories.users.name()}`}
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

describe('createTestRepositories', () => {
  it('parte do container em memória e troca só o que o teste pede', () => {
    const container = createTestRepositories(createInMemory, {
      users: { name: () => 'Bia' },
    })

    expect(container.users.name()).toBe('Bia')
    expect(container.tasks.list()).toEqual(['em memória'])
  })

  it('cria um container novo a cada chamada', () => {
    const create = vi.fn(createInMemory)

    const first = createTestRepositories(create)
    const second = createTestRepositories(create)

    expect(create).toHaveBeenCalledTimes(2)
    expect(first).not.toBe(second)
  })
})

describe('renderWithProviders', () => {
  it('renderiza dentro dos providers do produto, com a rota inicial e os repositórios', () => {
    renderWithProviders(<Probe />, { path: '/tarefas' })

    expect(screen.getByText('/tarefas|escuro|em memória|Ana')).toBeTruthy()
  })

  it('usa "/" como rota inicial', () => {
    const { currentPath, history } = renderWithProviders(<Probe />)

    expect(screen.getByText('/|escuro|em memória|Ana')).toBeTruthy()
    expect(history).toEqual(['/'])
    expect(currentPath()).toBe('/')
  })

  it('troca só os repositórios de overrides', () => {
    const { repositories } = renderWithProviders(<Probe />, {
      repositories: { tasks: { list: () => ['a', 'b'] } },
    })

    expect(screen.getByText('/|escuro|a,b|Ana')).toBeTruthy()
    expect(repositories.tasks.list()).toEqual(['a', 'b'])
    expect(createRepositories).toHaveBeenLastCalledWith({ tasks: expect.any(Object) })
  })

  it('devolve o mesmo container que os componentes recebem', () => {
    const seen: FakeContainer[] = []
    function Spy() {
      const container = useFakeRepositories()
      useEffect(() => {
        seen.push(container)
      })
      return null
    }

    const { repositories } = renderWithProviders(<Spy />)

    expect(seen[0]).toBe(repositories)
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
    expect(first.repositories).not.toBe(second.repositories)
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
  repositories,
  session = 'ninguém',
}: { children: ReactNode; repositories: FakeContainer } & FakeSessionProps) {
  return (
    <SessionContext.Provider value={session}>
      <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>
    </SessionContext.Provider>
  )
}

const bindingWithSession = {
  Providers: SessionProviders,
  createRepositories: (overrides?: Partial<FakeContainer>) =>
    createTestRepositories(createInMemory, overrides),
  createQueryClient: () =>
    createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
}

const renderWithSession = createRenderWithProviders<FakeContainer, FakeSessionProps>(
  bindingWithSession,
)
const renderHookWithSession = createRenderHookWithProviders<FakeContainer, FakeSessionProps>(
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
      createRepositories,
      createQueryClient,
    })

    render(<span />, { path: '/dentro' })

    expect(screen.getByText('0|/dentro')).toBeTruthy()
  })
})

describe('renderHookWithProviders', () => {
  const renderHookWithProviders = createRenderHookWithProviders({
    Providers: FakeProviders,
    createRepositories,
    createQueryClient,
  })

  it('roda o hook dentro dos providers, da rota e do QueryClient', async () => {
    const { result, queryClient, repositories } = renderHookWithProviders(
      () => {
        const [location] = useLocation()
        const container = useFakeRepositories()
        const { data } = useQuery({ queryKey: ['tasks'], queryFn: () => container.tasks.list() })
        return { location, theme: useContext(ThemeContext), data }
      },
      { path: '/tarefas' },
    )

    await waitFor(() => expect(result.current.data).toEqual(['em memória']))
    expect(result.current.location).toBe('/tarefas')
    expect(result.current.theme).toBe('escuro')
    expect(queryClient.getQueryData(['tasks'])).toEqual(['em memória'])
    expect(repositories.users.name()).toBe('Ana')
  })

  it('troca os repositórios e testa uma mutation', async () => {
    const rename = vi.fn((name: string) => name)
    const { result } = renderHookWithProviders(
      () => {
        const users = useFakeRepositories().users as { name: () => string; rename: typeof rename }
        return useMutation({ mutationFn: async (name: string) => users.rename(name) })
      },
      { repositories: { users: { name: () => 'Bia', rename } as FakeContainer['users'] } },
    )

    await act(() => result.current.mutateAsync('Caio'))

    expect(rename).toHaveBeenCalledWith('Caio')
  })

  it('repassa initialProps e permite rerender', () => {
    const { result, rerender } = renderHookWithProviders(({ n }: { n: number }) => n * 2, {
      initialProps: { n: 2 },
    })

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

// Use cases: o container de use cases ao lado (ou no lugar) do de repositórios
interface FakeUseCases {
  getStores: { execute: (input: { q: string }) => Promise<string[]> }
}

const UseCasesContext = createContext<FakeUseCases | null>(null)

function useFakeUseCases() {
  const container = useContext(UseCasesContext)
  if (!container) throw new Error('sem UseCasesContext')
  return container
}

function UseCasesOnlyProviders({
  children,
  useCases,
}: {
  children: ReactNode
  useCases: FakeUseCases
}) {
  return <UseCasesContext.Provider value={useCases}>{children}</UseCasesContext.Provider>
}

const createFakeUseCases = (): FakeUseCases => ({
  getStores: { execute: async ({ q }) => [`loja ${q}`] },
})

describe('use cases', () => {
  const useCasesBinding = {
    Providers: UseCasesOnlyProviders,
    createUseCases: (overrides?: Partial<FakeUseCases>) =>
      createTestUseCases(createFakeUseCases, overrides),
    createQueryClient,
  }

  it('createTestUseCases aplica os overrides por cima do container', async () => {
    const execute = vi.fn(async () => ['trocada'])
    const useCases = createTestUseCases(createFakeUseCases, { getStores: { execute } })
    expect(await useCases.getStores.execute({ q: 'a' })).toEqual(['trocada'])
    expect(await createTestUseCases(createFakeUseCases).getStores.execute({ q: 'a' })).toEqual([
      'loja a',
    ])
  })

  it('renderWithProviders entrega o container de use cases, sem repositórios', async () => {
    const render = createRenderWithProviders(useCasesBinding)

    function Stores() {
      const { getStores } = useFakeUseCases()
      const { data } = useQuery({
        queryKey: ['stores'],
        queryFn: () => getStores.execute({ q: 'x' }),
      })
      return <p>{data?.join(',') ?? 'carregando'}</p>
    }

    const { useCases } = render(<Stores />)
    expect(await screen.findByText('loja x')).toBeTruthy()
    expect(Object.keys(useCases)).toEqual(['getStores'])
  })

  it('o teste troca só o use case que precisa', async () => {
    const render = createRenderWithProviders(useCasesBinding)
    const execute = vi.fn(async () => ['da troca'])

    function Stores() {
      const { getStores } = useFakeUseCases()
      const { data } = useQuery({ queryKey: ['s'], queryFn: () => getStores.execute({ q: '' }) })
      return <p>{data?.join(',') ?? 'carregando'}</p>
    }

    const { useCases } = render(<Stores />, { useCases: { getStores: { execute } } })
    expect(await screen.findByText('da troca')).toBeTruthy()
    expect(useCases.getStores.execute).toBe(execute)
  })

  it('convive com os repositórios no mesmo render', () => {
    function BothProviders({
      children,
      repositories,
      useCases,
    }: {
      children: ReactNode
      repositories: FakeContainer
      useCases: FakeUseCases
    }) {
      return (
        <FakeProviders repositories={repositories}>
          <UseCasesOnlyProviders useCases={useCases}>{children}</UseCasesOnlyProviders>
        </FakeProviders>
      )
    }
    const render = createRenderWithProviders({
      Providers: BothProviders,
      createRepositories,
      createUseCases: useCasesBinding.createUseCases,
      createQueryClient,
    })

    function Both() {
      return (
        <p>{`${useFakeRepositories().users.name()} ${typeof useFakeUseCases().getStores.execute}`}</p>
      )
    }

    render(<Both />)
    expect(screen.getByText('Ana function')).toBeTruthy()
  })

  it('renderHookWithProviders também recebe e devolve os use cases', async () => {
    const renderHook = createRenderHookWithProviders(useCasesBinding)
    const execute = vi.fn(async () => ['hook'])

    const { result, useCases } = renderHook(() => useFakeUseCases().getStores, {
      useCases: { getStores: { execute } },
    })

    expect(await result.current.execute({ q: '' })).toEqual(['hook'])
    expect(useCases.getStores.execute).toBe(execute)
  })
})
