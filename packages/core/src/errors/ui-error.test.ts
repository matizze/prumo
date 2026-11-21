import { describe, expect, it } from 'vitest'
import { UIError } from './index.ts'

describe('UIError', () => {
  it('guarda o código e a mensagem técnica', () => {
    const error = new UIError('TASK_NOT_FOUND', 'tarefa 42 não existe')

    expect(error.code).toBe('TASK_NOT_FOUND')
    expect(error.message).toBe('tarefa 42 não existe')
    expect(error.name).toBe('UIError')
  })

  it('é um Error, para passar por qualquer tratamento genérico', () => {
    const error: unknown = new UIError('INVALID_CREDENTIALS', 'senha incorreta')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(UIError)
  })
})
