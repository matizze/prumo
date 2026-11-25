import { UIError } from '@matizze/prumo-core/errors'
import { HttpError, type Http } from '@matizze/prumo-core/http'

const CODES: Readonly<Record<number, string>> = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
}

/** A `message` do corpo de um erro da API, quando ele traz uma. */
function bodyMessage(body: unknown): string | undefined {
  const message: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'message') : undefined
  return typeof message === 'string' && message !== '' ? message : undefined
}

/**
 * O erro do `http` como a tela o entende: o status vira o código do errors.json (400 e 422,
 * INVALID_REQUEST; 401, UNAUTHORIZED; 403, FORBIDDEN; 404, NOT_FOUND; 409, CONFLICT; o resto e a
 * falha de rede, REQUEST_FAILED). O que não é do transporte passa como veio.
 */
export function toUIError(error: unknown): unknown {
  if (error instanceof HttpError) {
    if (error.status === 400 || error.status === 422) {
      return new UIError('INVALID_REQUEST', bodyMessage(error.body) ?? error.message)
    }
    return new UIError(CODES[error.status] ?? 'REQUEST_FAILED', error.message)
  }
  if (error instanceof TypeError) return new UIError('REQUEST_FAILED', error.message)
  return error
}

/** O `http` que lança `UIError` no lugar de `HttpError`: o da API e o de mock se comportam igual. */
export function withErrors(http: Http): Http {
  return async (path, request) => {
    try {
      return await http(path, request)
    } catch (error) {
      throw toUIError(error)
    }
  }
}
