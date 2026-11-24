import { beforeEach, expect, it } from 'vitest'
import { {{action.pascal}}Output, type {{action.pascal}}Input } from './{{action.kebab}}.types'
import { {{action.pascal}}UseCase } from './{{action.kebab}}.usecase'

const INPUT: {{action.pascal}}Input = {{test.input}}

// O localStorage é o do jsdom: cada teste começa com ele vazio.
beforeEach(() => localStorage.clear())

it('aceita um Input válido e devolve o Output', async () => {
  const output = await new {{action.pascal}}UseCase(localStorage).execute(INPUT)
  expect({{action.pascal}}Output.safeParse(output).success).toBe(true)
})

it('recusa um Input inválido', async () => {
  const useCase = new {{action.pascal}}UseCase(localStorage)
  await expect(useCase.execute(undefined as never)).rejects.toThrow()
})
