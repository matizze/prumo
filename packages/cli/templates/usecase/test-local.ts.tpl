import { beforeEach, expect, it } from 'vitest'
import { {{action.pascal}}Response, type {{action.pascal}}Request } from '../types/{{action.kebab}}'
import { {{action.pascal}}UseCase } from './{{action.kebab}}.usecase'

const INPUT: {{action.pascal}}Request = {{test.input}}

beforeEach(() => localStorage.clear())

it('aceita um Request válido e devolve o Response', async () => {
  const response = await new {{action.pascal}}UseCase(localStorage).execute(INPUT)
  expect({{action.pascal}}Response.safeParse(response).success).toBe(true)
})

it('recusa um Request inválido', async () => {
  const useCase = new {{action.pascal}}UseCase(localStorage)
  await expect(useCase.execute(undefined as never)).rejects.toThrow()
})
