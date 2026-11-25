import { describe, expect, it, vi } from 'vitest'
import { createHttp, HttpError, type HttpAuth } from './index.ts'
import { withQuery } from './http.ts'

interface Call {
  url: string
  init: RequestInit
}

function fakeFetch(replies: Response[], calls: Call[] = []) {
  const queue = [...replies]
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const next = queue.shift()
    if (!next) throw new Error('sem resposta combinada')
    return next
  }) as unknown as typeof fetch
  return { fetcher, calls }
}

const headersOf = (call: Call | undefined) => (call?.init.headers ?? {}) as Record<string, string>

describe('createHttp', () => {
  it('tira as barras do fim do baseUrl', async () => {
    const { fetcher, calls } = fakeFetch([Response.json({})])
    await createHttp({ baseUrl: 'http://api.test///', fetch: fetcher })('/livros')
    expect(calls[0]?.url).toBe('http://api.test/livros')
  })

  it('envia o método, o corpo em JSON e os cabeçalhos', async () => {
    const { fetcher, calls } = fakeFetch([Response.json({})])
    const http = createHttp({
      baseUrl: 'http://api.test',
      headers: () => ({ 'X-App': 'prumo' }),
      fetch: fetcher,
    })
    await http('/livros', { method: 'POST', body: { title: 'Dom Casmurro' } })
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.body).toBe('{"title":"Dom Casmurro"}')
    expect(headersOf(calls[0])).toEqual({ 'Content-Type': 'application/json', 'X-App': 'prumo' })
  })

  it('usa GET, sem corpo e sem Content-Type (para não forçar o preflight do CORS)', async () => {
    const { fetcher, calls } = fakeFetch([Response.json({})])
    await createHttp({ baseUrl: '', fetch: fetcher })('/a')
    expect(calls[0]?.init.method).toBe('GET')
    expect(calls[0]?.init.body).toBeUndefined()
    expect(headersOf(calls[0])['Content-Type']).toBeUndefined()
  })

  it('transforma a query em query string e omite os undefined', async () => {
    const { fetcher, calls } = fakeFetch([Response.json({})])
    await createHttp({ baseUrl: 'http://api.test', fetch: fetcher })('/livros', {
      query: { search: 'dom casmurro', page: 2, active: true, sort: undefined },
    })
    expect(calls[0]?.url).toBe('http://api.test/livros?search=dom+casmurro&page=2&active=true')
  })

  it('devolve undefined para corpo vazio, não JSON e 204; lê JSON, mesmo sem content-type', async () => {
    const body = (response: Response) =>
      createHttp({ baseUrl: '', fetch: fakeFetch([response]).fetcher })('/a')
    expect(await body(new Response(null, { status: 204 }))).toBeUndefined()
    expect(await body(new Response('', { status: 200 }))).toBeUndefined()
    expect(await body(new Response('OK', { status: 200 }))).toBeUndefined()
    expect(await body(new Response('  ', { status: 200 }))).toBeUndefined()
    expect(await body(Response.json({ a: 1 }))).toEqual({ a: 1 })
    expect(await body(new Response(' {"a":1}', { status: 200 }))).toEqual({ a: 1 })
    expect(await body(new Response('[1,2]', { status: 200 }))).toEqual([1, 2])
  })

  it('lança HttpError com o status nos erros', async () => {
    const http = createHttp({
      baseUrl: '',
      fetch: fakeFetch([new Response('', { status: 500 })]).fetcher,
    })
    const error = await http('/a', { method: 'DELETE' }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(HttpError)
    expect(error).toMatchObject({ status: 500, message: 'DELETE /a: HTTP 500' })
  })

  it('guarda no HttpError o JSON da resposta de erro, para o use case ler', async () => {
    const reply = (response: Response) =>
      createHttp({ baseUrl: '', fetch: fakeFetch([response]).fetcher })('/a').then(
        () => {
          throw new Error('era para falhar')
        },
        (caught: unknown) => caught as HttpError,
      )
    const validation = await reply(
      Response.json({ code: 'VALIDATION', errors: { email: ['inválido'] } }, { status: 422 }),
    )
    expect(validation.status).toBe(422)
    expect(validation.body).toEqual({ code: 'VALIDATION', errors: { email: ['inválido'] } })
    expect((await reply(new Response('', { status: 500 }))).body).toBeUndefined()
    expect((await reply(new Response('<html>', { status: 502 }))).body).toBeUndefined()
    expect((await reply(new Response('{ quebrado', { status: 500 }))).body).toBeUndefined()
    expect(new HttpError(400, 'x', { a: 1 }).body).toEqual({ a: 1 })
  })

  describe('sessão', () => {
    const auth = (overrides: Partial<HttpAuth> = {}): HttpAuth => {
      let token: string | null = 'velho'
      return {
        getToken: () => token,
        refresh: vi.fn(async () => {
          token = 'novo'
          return true
        }),
        ...overrides,
      }
    }

    it('manda o Bearer da sessão e nada sem sessão', async () => {
      const withSession = fakeFetch([Response.json({})])
      await createHttp({ baseUrl: '', auth: auth(), fetch: withSession.fetcher })('/a')
      expect(headersOf(withSession.calls[0]).Authorization).toBe('Bearer velho')

      const without = fakeFetch([Response.json({})])
      await createHttp({
        baseUrl: '',
        auth: auth({ getToken: () => null }),
        fetch: without.fetcher,
      })('/a')
      expect(headersOf(without.calls[0]).Authorization).toBeUndefined()
    })

    it('renova no 401 e repete a chamada uma vez com o token novo', async () => {
      const session = auth()
      const { fetcher, calls } = fakeFetch([
        new Response('', { status: 401 }),
        Response.json({ ok: 1 }),
      ])
      const result = await createHttp({ baseUrl: '', auth: session, fetch: fetcher })('/a')
      expect(result).toEqual({ ok: 1 })
      expect(session.refresh).toHaveBeenCalledWith('velho')
      expect(calls.map((call) => headersOf(call).Authorization)).toEqual([
        'Bearer velho',
        'Bearer novo',
      ])
    })

    it('não repete mais de uma vez: um segundo 401 vira erro', async () => {
      const session = auth()
      const { fetcher, calls } = fakeFetch([
        new Response('', { status: 401 }),
        new Response('', { status: 401 }),
      ])
      const http = createHttp({ baseUrl: '', auth: session, fetch: fetcher })
      await expect(http('/a')).rejects.toMatchObject({ status: 401 })
      expect(calls).toHaveLength(2)
      expect(session.refresh).toHaveBeenCalledOnce()
    })

    it('lança o 401 quando a renovação falha, sem repetir', async () => {
      const session = auth({ refresh: async () => false })
      const { fetcher, calls } = fakeFetch([new Response('', { status: 401 })])
      await expect(
        createHttp({ baseUrl: '', auth: session, fetch: fetcher })('/a'),
      ).rejects.toMatchObject({
        status: 401,
      })
      expect(calls).toHaveLength(1)
    })

    it('não tenta renovar um 401 sem sessão', async () => {
      const session = auth({ getToken: () => null })
      const { fetcher } = fakeFetch([new Response('', { status: 401 })])
      await expect(
        createHttp({ baseUrl: '', auth: session, fetch: fetcher })('/a'),
      ).rejects.toMatchObject({
        status: 401,
      })
      expect(session.refresh).not.toHaveBeenCalled()
    })
  })
})

describe('withQuery', () => {
  it('devolve o caminho sem mudança quando não há query útil', () => {
    expect(withQuery('/a')).toBe('/a')
    expect(withQuery('/a', { x: undefined })).toBe('/a')
  })

  it('acrescenta com & quando o caminho já tem query', () => {
    expect(withQuery('/a?x=1', { y: 2 })).toBe('/a?x=1&y=2')
  })
})
