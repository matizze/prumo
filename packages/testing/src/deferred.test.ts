import { describe, expect, it } from 'vitest'
import { createDeferred } from './deferred.ts'

describe('createDeferred', () => {
  it('só resolve quando o teste manda, e entrega o valor', async () => {
    const { promise, resolve } = createDeferred<number>()
    let settled = false
    void promise.then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    resolve(42)
    await expect(promise).resolves.toBe(42)
    expect(settled).toBe(true)
  })

  it('rejeita com o motivo que o teste dá', async () => {
    const { promise, reject } = createDeferred<string>()
    const failure = new Error('falhou')

    reject(failure)

    await expect(promise).rejects.toBe(failure)
  })

  it('resolve sem valor quando o tipo é void', async () => {
    const { promise, resolve } = createDeferred()

    resolve()

    await expect(promise).resolves.toBeUndefined()
  })

  it('controla a ordem de duas operações assíncronas', async () => {
    const first = createDeferred<string>()
    const second = createDeferred<string>()
    const order: string[] = []
    const run = Promise.all([
      first.promise.then((value) => order.push(value)),
      second.promise.then((value) => order.push(value)),
    ])

    second.resolve('segunda')
    first.resolve('primeira')
    await run

    expect(order).toEqual(['segunda', 'primeira'])
  })
})
