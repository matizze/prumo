import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockHttp, HttpError, type MockRequest } from './index.ts'

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
    const seen: MockRequest[] = []
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

  it('rota inexistente dá 404 dizendo o método e o caminho sem mock', async () => {
    const http = createMockHttp({ 'GET /livros': () => [] })
    const error = await http('/autores/3?x=1', { method: 'DELETE' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    expect(error).toMatchObject({ status: 404 })
    expect((error as HttpError).message).toContain('DELETE /autores/3')
    // O método certo no caminho errado, e o caminho certo no método errado, também são 404
    await expect(http('/livros', { method: 'POST' })).rejects.toMatchObject({ status: 404 })
    await expect(http('/livros/1')).rejects.toMatchObject({ status: 404 })
  })

  it('recusa uma chave de rota mal escrita', () => {
    expect(() => createMockHttp({ '/livros': () => null })).toThrow('Rota de mock inválida')
    expect(() => createMockHttp({ 'FETCH /livros': () => null })).toThrow('Rota de mock inválida')
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

    // Sem latencyMs, só uma volta de timer de 0 ms
    const fast = createMockHttp({ 'GET /a': () => 'ok' })
    const pending = fast('/a')
    await vi.advanceTimersByTimeAsync(0)
    expect(await pending).toBe('ok')
  })
})
