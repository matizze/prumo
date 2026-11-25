import { UIError } from '@matizze/prumo-core/errors'
import { HttpError, NetworkError } from '@matizze/prumo-core/http'
import { expect, it } from 'vitest'
import { toUIError, withErrors } from './errors'

it.each([
  [400, 'INVALID_REQUEST'],
  [401, 'UNAUTHORIZED'],
  [403, 'FORBIDDEN'],
  [404, 'NOT_FOUND'],
  [409, 'CONFLICT'],
  [422, 'INVALID_REQUEST'],
  [500, 'REQUEST_FAILED'],
  [503, 'REQUEST_FAILED'],
])('o status %i vira %s', (status, code) => {
  const error = toUIError(new HttpError(status, 'falhou'))
  expect(error).toBeInstanceOf(UIError)
  expect(error).toMatchObject({ code })
})

it('a mensagem do corpo de um 422 vai para o UIError', () => {
  expect(toUIError(new HttpError(422, 'falhou', { message: 'e-mail inválido' }))).toMatchObject({
    code: 'INVALID_REQUEST',
    message: 'e-mail inválido',
  })
})

it('a falha de rede (o NetworkError do createHttp) vira REQUEST_FAILED', () => {
  const network = new NetworkError('GET /a: falha de rede', { cause: new TypeError('Failed to fetch') })
  expect(toUIError(network)).toMatchObject({ code: 'REQUEST_FAILED' })
})

it('um TypeError de bug de código não vira falha de rede: passa como veio', () => {
  const bug = new TypeError('Cannot read properties of undefined')
  expect(toUIError(bug)).toBe(bug)
})

it('o erro que não é do transporte passa como veio', () => {
  const bug = new Error('bug')
  expect(toUIError(bug)).toBe(bug)
})

it('o withErrors traduz o erro do http', async () => {
  const http = withErrors(async () => {
    throw new HttpError(401, 'sem sessão')
  })
  await expect(http('/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
})
