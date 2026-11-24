/** Valores aceitos na query string: `undefined` é omitido. */
export type HttpQuery = Record<string, string | number | boolean | undefined>

/** O que o cliente envia além do endereço. */
export interface HttpRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Vira a query string (`?search=a&page=2`); os valores `undefined` ficam de fora. */
  query?: HttpQuery
}

/** Faz uma chamada à API e devolve o corpo da resposta (sem validar). */
export type Http = (path: string, request?: HttpRequest) => Promise<unknown>

/** A sessão vista pelo cliente HTTP: o token da vez e a renovação depois de um 401. */
export interface HttpAuth {
  /** O token de acesso da sessão, ou `null` sem sessão. */
  getToken: () => string | null
  /**
   * Renova a sessão depois de um 401 do token `usedToken`. Devolve `true` quando há token novo
   * para repetir a chamada e `false` quando a renovação falhou (a sessão já foi encerrada).
   */
  refresh: (usedToken: string) => Promise<boolean>
}

export interface HttpOptions {
  baseUrl: string
  /** Cabeçalhos de toda chamada. */
  headers?: () => Record<string, string>
  /** O Bearer da sessão e o tratamento do 401: renova uma vez e repete a chamada. */
  auth?: HttpAuth
  /** Troca o `fetch` (testes, sem rede). */
  fetch?: typeof fetch
}

/** Resposta da API com status de erro. Quem chama decide o que ela significa no domínio. */
export class HttpError extends Error {
  readonly status: number
  /**
   * O JSON da resposta de erro, quando houver (o código de erro do backend, os erros de validação
   * de um 422): o use case lê daqui. `undefined` para um corpo vazio ou que não é JSON.
   */
  readonly body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

/** Lê o corpo da resposta quando é JSON: o content-type diz `json`, ou o texto começa com `{` ou `[`. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  const isJson = /json/i.test(response.headers.get('content-type') ?? '') || /^\s*[{[]/.test(text)
  if (text.trim() === '' || !isJson) return undefined
  try {
    return JSON.parse(text)
  } catch (error) {
    // No erro o status já diz o que houve; no sucesso o JSON quebrado é um problema da API
    if (!response.ok) return undefined
    throw error
  }
}

/** Junta a query ao caminho, sem os valores `undefined`. */
export function withQuery(path: string, query?: HttpQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.append(key, String(value))
  }
  const search = params.toString()
  if (!search) return path
  return `${path}${path.includes('?') ? '&' : '?'}${search}`
}

/**
 * O cliente HTTP: junta o endereço da API, o token da sessão e o tratamento do 401. Devolve o
 * corpo da resposta em JSON (ou `undefined` quando o corpo é vazio ou não é JSON) e lança
 * `HttpError` nos status de erro.
 */
export function createHttp({ baseUrl, headers, auth, fetch: fetchOverride }: HttpOptions): Http {
  // `http://api/` e `http://api` dão no mesmo: o caminho de cada chamada começa com a barra
  const base = baseUrl.replace(/\/+$/, '')
  const send = (path: string, { method = 'GET', body, query }: HttpRequest, token: string | null) =>
    (fetchOverride ?? fetch)(`${base}${withQuery(path, query)}`, {
      method,
      headers: {
        // Sem corpo não há Content-Type: um GET com ele deixaria de ser uma requisição simples do CORS
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers?.(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  return async (path, request = {}) => {
    const token = auth?.getToken() ?? null
    let response = await send(path, request, token)
    // 401 com sessão: renova o token (uma vez) e repete a chamada com o token novo
    if (response.status === 401 && auth && token !== null && (await auth.refresh(token))) {
      response = await send(path, request, auth.getToken())
    }
    if (!response.ok) {
      throw new HttpError(
        response.status,
        `${request.method ?? 'GET'} ${path}: HTTP ${response.status}`,
        await readJson(response),
      )
    }
    // Um 204, um 200 vazio ou um `OK` não têm o que devolver, e quem precisa do corpo valida com o
    // schema e falha ali
    return readJson(response)
  }
}
