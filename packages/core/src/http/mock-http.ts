import { wait } from '../mock/mock-utils.ts'
import { withQuery, type Http, type HttpRequest } from './http.ts'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** A chave de uma rota do mock: `'<MÉTODO> <caminho>'`, como `'GET /livros/:id'`. */
export type MockRouteKey = `${Method} /${string}`

type ParamNames<S extends string> = S extends `${string}:${infer Param}/${infer Rest}`
  ? Param | ParamNames<Rest>
  : S extends `${string}:${infer Param}`
    ? Param
    : never

/** Os `:parâmetros` da chave de uma rota: `'GET /livros/:id'` dá `{ id: string }`. */
export type MockRouteParams<Key extends string> = { [Name in ParamNames<Key>]: string }

/** O que um handler de rota recebe: o que a API real receberia da chamada. */
export interface MockRequest<Key extends string = string> {
  /** Os `:parâmetros` do caminho, já decodificados (`/livros/:id` com `/livros/a%20b` dá `a b`). */
  params: MockRouteParams<Key>
  /** A query string em texto (`?page=2` dá `{ page: '2' }`); na chave repetida, vale o último valor. */
  query: Record<string, string>
  /** O corpo enviado, depois de um ida e volta de JSON; `undefined` sem corpo. */
  body: unknown
}

/** Responde a uma rota: devolve o corpo da resposta ou lança `HttpError` para simular um erro. */
export type MockHandler<Key extends string = string> = (request: MockRequest<Key>) => unknown

/** As rotas do mock, uma chave `'<MÉTODO> <caminho>'` para cada handler. */
export type MockRoutes<Key extends MockRouteKey = MockRouteKey> = {
  [K in Key]: MockHandler<K>
}

export interface MockHttpOptions {
  /** Latência simulada de cada chamada, em ms (padrão 0, para os testes ficarem rápidos). */
  latencyMs?: number
}

/**
 * Nenhuma rota do mock atende à chamada. É um erro de configuração do mock, e não uma resposta
 * da API: por isso não é um `HttpError` (um 404 de verdade viraria "registro não encontrado").
 */
export class MissingMockRouteError extends Error {
  readonly method: string
  readonly path: string

  constructor(method: string, path: string) {
    super(
      `Sem mock para ${method} ${path}: acrescente a rota '${method} ${path}' ao createMockHttp.`,
    )
    this.name = 'MissingMockRouteError'
    this.method = method
    this.path = path
  }
}

interface CompiledRoute {
  method: string
  segments: string[]
  handler: (request: MockRequest) => unknown
}

const ROUTE_KEY = /^(GET|POST|PUT|PATCH|DELETE) (\/[^\s?#]*)$/

const isParam = (segment: string) => segment.startsWith(':')

function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '')
}

function compile(routes: Record<string, (request: MockRequest) => unknown>): CompiledRoute[] {
  return Object.entries(routes).map(([key, handler]) => {
    const match = ROUTE_KEY.exec(key)
    if (!match) {
      throw new Error(
        `Rota de mock inválida "${key}". Use '<MÉTODO> <caminho>', como 'GET /livros/:id', sem espaço nem ? ou # no caminho (a query vai no request).`,
      )
    }
    return {
      method: match[1] ?? '',
      // O caminho da chamada chega codificado: os segmentos fixos são comparados codificados
      segments: splitPath(match[2] ?? '').map((segment) =>
        isParam(segment) ? segment : encodeURI(segment),
      ),
      handler,
    }
  })
}

function matchRoute(route: CompiledRoute, segments: string[]): Record<string, string> | null {
  if (route.segments.length !== segments.length) return null
  const params: Record<string, string> = {}
  for (const [index, expected] of route.segments.entries()) {
    const actual = segments[index] ?? ''
    if (isParam(expected)) {
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

/**
 * Compara duas rotas que casam com o mesmo caminho, segmento a segmento: na primeira diferença,
 * o segmento fixo ganha do parâmetro. Negativo quando `a` é mais específica.
 */
function compareSpecificity(a: CompiledRoute, b: CompiledRoute): number {
  for (const [index, left] of a.segments.entries()) {
    const right = b.segments[index]
    if (right === undefined) break
    if (isParam(left) !== isParam(right)) return isParam(left) ? 1 : -1
  }
  return 0
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
 * A chave de cada rota é `'<MÉTODO> <caminho>'`, com `:parâmetros` no caminho, e o tipo de
 * `params` do handler sai dela (`'GET /livros/:id'` dá `{ id: string }`). O handler recebe
 * `{ params, query, body }` e devolve o corpo da resposta (ou uma Promise dele); lançar `HttpError`
 * simula um status de erro. Uma chamada sem rota lança `MissingMockRouteError`, que não é um
 * `HttpError`. O corpo de ida e o de volta passam por um ida e volta de JSON, então mexer neles
 * não muda as fixtures. Com várias rotas casando, vale a mais específica: no primeiro segmento
 * em que diferem, o fixo ganha do parâmetro.
 *
 * ```ts
 * const http = createMockHttp({
 *   'GET /livros': ({ query }) => livros.list(query),
 *   'GET /livros/:id': ({ params }) => livros.get(params.id),
 *   'POST /auth/sign-in': () => { throw new HttpError(401, 'Credenciais inválidas') },
 * })
 * ```
 */
export function createMockHttp<Key extends MockRouteKey>(
  routes: MockRoutes<Key>,
  { latencyMs = 0 }: MockHttpOptions = {},
): Http {
  const compiled = compile(routes as Record<string, (request: MockRequest) => unknown>)

  return async (path: string, { method = 'GET', body, query }: HttpRequest = {}) => {
    if (latencyMs > 0) await wait(latencyMs)
    const url = new URL(withQuery(path, query), 'http://mock.local')
    const segments = splitPath(url.pathname)

    let best: { route: CompiledRoute; params: Record<string, string> } | undefined
    for (const route of compiled) {
      if (route.method !== method) continue
      const params = matchRoute(route, segments)
      if (!params) continue
      if (!best || compareSpecificity(route, best.route) < 0) best = { route, params }
    }
    if (!best) throw new MissingMockRouteError(method, url.pathname)

    const response = await best.route.handler({
      params: best.params,
      query: Object.fromEntries(url.searchParams),
      body: throughJson(body),
    })
    return throughJson(response)
  }
}

/**
 * Uma rota do mock a partir do endereço do use case (o `ENDPOINT` de `types/<ação>.ts`): devolve
 * `{ '<MÉTODO> <caminho>': handler }`, para espalhar no `createMockHttp`. O `params` do handler sai
 * do `path`, como nas rotas do `createMockHttp`, e a chave não se repete à mão: quem muda o caminho
 * no `ENDPOINT` muda o mock junto.
 *
 * ```ts
 * export const signInRoutes = mockRoute(ENDPOINT, ({ body }) => ({ token: 'Token 1' }))
 * ```
 */
export function mockRoute<M extends Method, P extends `/${string}`>(
  endpoint: { readonly method: M; readonly path: P },
  handler: MockHandler<`${M} ${P}`>,
): { [Key in `${M} ${P}`]: MockHandler<Key> } {
  const key = `${endpoint.method} ${endpoint.path}` as `${M} ${P}`
  return { [key]: handler } as { [Key in `${M} ${P}`]: MockHandler<Key> }
}
