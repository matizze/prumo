import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  createMockHttp,
  HttpError,
  MissingMockRouteError,
  mockRoute,
  type MockRequest,
} from './index.ts'

afterEach(() => {
  vi.useRealTimers()
})

describe('createMockHttp', () => {
  it('responde pelo método e pelo caminho, com GET por padrão', async () => {
    const http = createMockHttp({
      'GET /livros': () => [{ id: 1 }],
      'POST /livros': () => ({ created: true }),
    })
    expect(await http('/livros')).toEqual([{ id: 1 }])
    expect(await http('/livros', { method: 'POST' })).toEqual({ created: true })
  })

  it('entrega params, query e body ao handler', async () => {
    const seen: MockRequest<'PATCH /livros/:id/capitulos/:n'>[] = []
    const http = createMockHttp({
      'PATCH /livros/:id/capitulos/:n': (request) => {
        seen.push(request)
        return null
      },
    })
    await http('/livros/7/capitulos/2', {
      method: 'PATCH',
      body: { title: 'x' },
      query: { page: 3, gone: undefined },
    })
    expect(seen).toEqual([
      { params: { id: '7', n: '2' }, query: { page: '3' }, body: { title: 'x' } },
    ])
  })

  it('decodifica o :id e separa o caminho da query string escrita no próprio caminho', async () => {
    const seen: MockRequest[] = []
    const http = createMockHttp({
      'GET /livros/:id': (request) => {
        seen.push(request)
        return null
      },
    })
    await http('/livros/a%20b%2Fc%C3%A3o?search=d%C3%A1+licença&x=1')
    expect(seen[0]?.params).toEqual({ id: 'a b/cão' })
    expect(seen[0]?.query).toEqual({ search: 'dá licença', x: '1' })
  })

  it('codifica a query enviada em query', async () => {
    let query: unknown
    const http = createMockHttp({
      'GET /livros': (request) => {
        query = request.query
        return []
      },
    })
    await http('/livros', { query: { search: 'a&b=c', page: 1 } })
    expect(query).toEqual({ search: 'a&b=c', page: '1' })
  })

  it('aceita handler assíncrono e ignora a barra no fim', async () => {
    const http = createMockHttp({ 'GET /a': async () => 'ok' })
    expect(await http('/a/')).toBe('ok')
  })

  it('prefere a rota fixa à com parâmetro, qualquer que seja a ordem', async () => {
    const http = createMockHttp({
      'GET /livros/:id': () => 'detalhe',
      'GET /livros/novo': () => 'novo',
    })
    expect(await http('/livros/novo')).toBe('novo')
    expect(await http('/livros/9')).toBe('detalhe')
  })

  it('compara segmento a segmento: na primeira diferença, o fixo ganha do parâmetro', async () => {
    const http = createMockHttp({
      'GET /livros/:id/capitulos': () => 'a',
      'GET /livros/novo/:aba': () => 'b',
      'GET /:org/repos/:repo': () => 'c',
      'GET /me/:a/:b': () => 'd',
    })
    expect(await http('/livros/novo/capitulos')).toBe('b')
    expect(await http('/livros/7/capitulos')).toBe('a')
    expect(await http('/me/repos/x')).toBe('d')
    expect(await http('/acme/repos/x')).toBe('c')
  })

  it('lançar HttpError simula o status, inclusive vindo de uma Promise', async () => {
    const http = createMockHttp({
      'POST /auth/sign-in': () => {
        throw new HttpError(401, 'Credenciais inválidas')
      },
      'GET /x': async () => {
        throw new HttpError(500, 'quebrou')
      },
    })
    await expect(http('/auth/sign-in', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
      message: 'Credenciais inválidas',
    })
    await expect(http('/x')).rejects.toMatchObject({ status: 500 })
  })

  it('rota inexistente lança MissingMockRouteError, e não um HttpError', async () => {
    const http = createMockHttp({ 'GET /livros': () => [] })
    const error = await http('/autores/3?x=1', { method: 'DELETE' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(MissingMockRouteError)
    expect(error).not.toBeInstanceOf(HttpError)
    expect((error as Error).message).toContain('DELETE /autores/3')
    // O método certo no caminho errado, e o caminho certo no método errado, também faltam
    await expect(http('/livros', { method: 'POST' })).rejects.toBeInstanceOf(MissingMockRouteError)
    await expect(http('/livros/1')).rejects.toBeInstanceOf(MissingMockRouteError)
  })

  it('recusa uma chave de rota mal escrita, inclusive com ? ou #', () => {
    const bad = (key: string) => () => createMockHttp({ [key]: () => null } as never)
    expect(bad('/livros')).toThrow('Rota de mock inválida')
    expect(bad('FETCH /livros')).toThrow('Rota de mock inválida')
    expect(bad('GET /livros?page=1')).toThrow('Rota de mock inválida')
    expect(bad('GET /livros#a')).toThrow('Rota de mock inválida')
  })

  it('casa uma chave com acento ou espaço codificado', async () => {
    const http = createMockHttp({ 'GET /ação/:id': ({ params }) => params.id })
    expect(await http('/ação/1')).toBe('1')
    expect(await http('/a%C3%A7%C3%A3o/2')).toBe('2')
  })

  it('na query repetida fica o último valor', async () => {
    const http = createMockHttp({ 'GET /a': ({ query }) => query })
    expect(await http('/a?x=1&x=2')).toEqual({ x: '2' })
  })

  it('os params saem da chave da rota, no tipo', () => {
    createMockHttp({
      'GET /livros': ({ params }) => {
        expectTypeOf(params).toEqualTypeOf<Record<never, never>>()
        return null
      },
      'GET /livros/:id/capitulos/:n': ({ params }) => {
        expectTypeOf(params).toEqualTypeOf<{ id: string; n: string }>()
        return params.id + params.n
      },
    })
  })

  it('o tipo da chave recusa o que não é método e caminho (checado na compilação)', () => {
    // Nunca chamada: só o compilador a confere, e a chave inválida lançaria na criação
    const _types = () => {
      // @ts-expect-error a chave precisa de método e de caminho com barra
      createMockHttp({ '/livros': () => null })
      // @ts-expect-error o método precisa ser um dos cinco
      createMockHttp({ 'FETCH /livros': () => null })
      createMockHttp({
        'GET /livros/:id': ({ params }) => {
          // @ts-expect-error só existe o :id
          return params.slug
        },
      })
    }
    expect(_types).toBeTypeOf('function')
  })

  it('passa o corpo e a resposta por um ida e volta de JSON', async () => {
    const fixture = { id: 1, tags: ['a'], at: new Date('2026-01-01T00:00:00Z'), gone: undefined }
    let received: unknown
    const http = createMockHttp({
      'POST /a': ({ body }) => {
        received = body
        return fixture
      },
    })
    const sent = { when: new Date('2026-02-02T00:00:00Z') }
    const response = (await http('/a', { method: 'POST', body: sent })) as typeof fixture

    expect(received).toEqual({ when: '2026-02-02T00:00:00.000Z' })
    expect(response).toEqual({ id: 1, tags: ['a'], at: '2026-01-01T00:00:00.000Z' })
    response.tags.push('b')
    expect(fixture.tags).toEqual(['a'])
  })

  it('devolve undefined quando o handler não devolve corpo', async () => {
    const http = createMockHttp({ 'DELETE /a/:id': () => undefined })
    expect(await http('/a/1', { method: 'DELETE' })).toBeUndefined()
  })

  it('simula a latência de latencyMs (padrão 0)', async () => {
    vi.useFakeTimers()
    const http = createMockHttp({ 'GET /a': () => 'ok' }, { latencyMs: 300 })
    let done = false
    const call = http('/a').then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(299)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await call
    expect(done).toBe(true)

    // Sem latencyMs, não há timer: não trava com os timers falsos
    expect(await createMockHttp({ 'GET /a': () => 'ok' })('/a')).toBe('ok')
  })
})

describe('mockRoute', () => {
  const ENDPOINT = { method: 'POST', path: '/livros/:id/capitulos' } as const

  it('devolve { "<MÉTODO> <caminho>": handler }, com a chave do endereço', () => {
    const handler = () => null
    const routes = mockRoute(ENDPOINT, handler)
    expect(Object.keys(routes)).toEqual(['POST /livros/:id/capitulos'])
    expect(routes['POST /livros/:id/capitulos']).toBe(handler)
  })

  it('o createMockHttp atende a rota montada, e a espalha junto com outras', async () => {
    const http = createMockHttp({
      ...mockRoute(ENDPOINT, ({ params, body }) => ({ id: params.id, body })),
      ...mockRoute({ method: 'GET', path: '/livros' }, () => []),
    })
    expect(await http('/livros/7/capitulos', { method: 'POST', body: { n: 1 } })).toEqual({
      id: '7',
      body: { n: 1 },
    })
    expect(await http('/livros')).toEqual([])
  })

  it('os params do handler saem do caminho, no tipo', () => {
    mockRoute(ENDPOINT, ({ params }) => {
      expectTypeOf(params).toEqualTypeOf<{ id: string }>()
      return null
    })
    mockRoute({ method: 'GET', path: '/livros' }, ({ params }) => {
      expectTypeOf(params).toEqualTypeOf<Record<never, never>>()
      return null
    })
  })

  it('o tipo do endereço recusa método errado e caminho sem barra (checado na compilação)', () => {
    // Nunca chamada: só o compilador a confere
    const _types = () => {
      // @ts-expect-error o método precisa ser um dos cinco
      mockRoute({ method: 'FETCH', path: '/livros' }, () => null)
      // @ts-expect-error o caminho precisa começar com barra
      mockRoute({ method: 'GET', path: 'livros' }, () => null)
      mockRoute(ENDPOINT, ({ params }) => {
        // @ts-expect-error só existe o :id
        return params.slug
      })
    }
    expect(_types).toBeTypeOf('function')
  })
})
