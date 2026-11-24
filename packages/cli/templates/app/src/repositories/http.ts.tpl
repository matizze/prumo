/** O que o cliente envia além do endereço. */
export interface HttpRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
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

/** Resposta da API com status de erro. O repositório decide o que ela significa no domínio. */
export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/**
 * O cliente HTTP, comum a todos os domínios com fonte http: junta o endereço da API, o token da
 * sessão e o tratamento do 401. Devolve o corpo da resposta em JSON (ou `undefined` quando o corpo é vazio ou não é JSON) e lança
 * `HttpError` nos status de erro.
 */
export function createHttp({ baseUrl, headers, auth, fetch: fetchOverride }: HttpOptions): Http {
  // `http://api/` e `http://api` dão no mesmo: o caminho de cada chamada começa com a barra
  const base = baseUrl.replace(/\/+$/, '')
  const send = (path: string, { method = 'GET', body }: HttpRequest, token: string | null) =>
    (fetchOverride ?? fetch)(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
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
      )
    }
    // Só o corpo em JSON é lido: um 204, um 200 vazio ou um `OK` não têm o que devolver, e quem
    // precisa do corpo (a lista, o get) valida com o schema e falha ali
    const text = await response.text()
    const isJson = /json/i.test(response.headers.get('content-type') ?? '')
    return text === '' || !isJson ? undefined : JSON.parse(text)
  }
}
