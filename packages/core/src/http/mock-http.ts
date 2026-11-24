import { wait } from '../mock/mock-utils.ts'
import { HttpError, withQuery, type Http, type HttpRequest } from './http.ts'

/** O que um handler de rota recebe: o que a API real receberia da chamada. */
export interface MockRequest {
  /** Os `:parâmetros` do caminho, já decodificados (`/livros/:id` com `/livros/a%20b` dá `a b`). */
  params: Record<string, string>
  /** A query string (`?page=2` dá `{ page: '2' }`). */
  query: Record<string, string>
  /** O corpo enviado, depois de um ida e volta de JSON; `undefined` sem corpo. */
  body: unknown
}

/** Responde a uma rota: devolve o corpo da resposta ou lança `HttpError` para simular um erro. */
export type MockHandler = (request: MockRequest) => unknown

/** As rotas do mock: a chave é `'<MÉTODO> <caminho>'` (`'GET /livros/:id'`). */
export type MockRoutes = Record<string, MockHandler>

export interface MockHttpOptions {
  /** Latência simulada de cada chamada, em ms (padrão 0, para os testes ficarem rápidos). */
  latencyMs?: number
}

interface CompiledRoute {
  method: string
  segments: string[]
  params: number
  handler: MockHandler
}

const ROUTE_KEY = /^(GET|POST|PUT|PATCH|DELETE) (\/\S*)$/

function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '')
}

function compile(routes: MockRoutes): CompiledRoute[] {
  const compiled = Object.entries(routes).map(([key, handler]) => {
    const match = ROUTE_KEY.exec(key)
    if (!match) {
      throw new Error(
        `Rota de mock inválida "${key}". Use '<MÉTODO> <caminho>', como 'GET /livros/:id'.`,
      )
    }
    const segments = splitPath(match[2] ?? '')
    return {
      method: match[1] ?? '',
      segments,
      params: segments.filter((segment) => segment.startsWith(':')).length,
      handler,
    }
  })
  // O caminho fixo ganha do com parâmetro ('/livros/novo' antes de '/livros/:id'); o sort é estável
  return compiled.sort((a, b) => a.params - b.params)
}

function matchRoute(route: CompiledRoute, segments: string[]): Record<string, string> | null {
  if (route.segments.length !== segments.length) return null
  const params: Record<string, string> = {}
  for (const [index, expected] of route.segments.entries()) {
    const actual = segments[index] ?? ''
    if (expected.startsWith(':')) {
      try {
        params[expected.slice(1)] = decodeURIComponent(actual)
      } catch {
        return null
      }
    } else if (expected !== actual) {
      return null
    }
  }
  return params
}

/** Um ida e volta de JSON, como a rede faz: tira o que o JSON não carrega e solta a referência. */
function throughJson(value: unknown): unknown {
  const text = JSON.stringify(value)
  return text === undefined ? undefined : JSON.parse(text)
}

/**
 * Um `Http` de mentira que responde pelas `routes`, sem rede e sem dependência (a ideia do MSW).
 * Os use cases rodam como em produção, e só o transporte é trocado.
 *
 * A chave de cada rota é `'<MÉTODO> <caminho>'`, com `:parâmetros` no caminho. O handler recebe
 * `{ params, query, body }` e devolve o corpo da resposta (ou uma Promise dele); lançar `HttpError`
 * simula um status de erro. Uma chamada sem rota dá `HttpError(404)` dizendo qual método e
 * caminho ficaram sem mock. O corpo de ida e o de volta passam por um ida e volta de JSON, então
 * mexer neles não muda as fixtures. Com várias rotas casando, vale a de menos parâmetros.
 *
 * ```ts
 * const http = createMockHttp({
 *   'GET /livros': ({ query }) => livros.list(query),
 *   'GET /livros/:id': ({ params }) => livros.get(params.id ?? ''),
 *   'POST /auth/sign-in': () => { throw new HttpError(401, 'Credenciais inválidas') },
 * })
 * ```
 */
export function createMockHttp(routes: MockRoutes, { latencyMs = 0 }: MockHttpOptions = {}): Http {
  const compiled = compile(routes)

  return async (path: string, { method = 'GET', body, query }: HttpRequest = {}) => {
    await wait(latencyMs)
    const url = new URL(withQuery(path, query), 'http://mock.local')
    const segments = splitPath(url.pathname)
    for (const route of compiled) {
      if (route.method !== method) continue
      const params = matchRoute(route, segments)
      if (!params) continue
      const response = await route.handler({
        params,
        query: Object.fromEntries(url.searchParams),
        body: throughJson(body),
      })
      return throughJson(response)
    }
    throw new HttpError(
      404,
      `Sem mock para ${method} ${url.pathname}: acrescente a rota '${method} ${url.pathname}' ao createMockHttp.`,
    )
  }
}
