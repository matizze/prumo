import { UIError } from '@matizze/prumo-core/errors'
import { createHttp, createMockHttp, HttpError } from '@matizze/prumo-core/http'
import { defineContractSuite, runContractSuite } from '@matizze/prumo-testing/contract'
import { describe, expect, it } from 'vitest'
import { {{action.camel}}Routes } from './{{action.kebab}}.mock'
import { {{action.pascal}}Output, type {{action.pascal}}Input } from './{{action.kebab}}.types'
import { {{action.pascal}}UseCase } from './{{action.kebab}}.usecase'

const INPUT: {{action.pascal}}Input = {{test.input}}

const {{action.camel}}Contract = defineContractSuite<{{action.pascal}}UseCase>(
  '{{action.pascal}}UseCase contract',
  ({ subject }) => {
    it('aceita um Input válido e devolve o Output', async () => {
      const output = await subject.execute(INPUT)
      expect({{action.pascal}}Output.safeParse(output).success).toBe(true)
    })

    it('recusa um Input inválido', async () => {
      await expect(subject.execute(undefined as never)).rejects.toThrow()
    })
  },
)

// O mesmo contrato roda contra o `http` de mentira (as rotas do .mock.ts) e, com API_TEST_URL, contra a API de teste.
runContractSuite({{action.camel}}Contract, {
  name: 'mock',
  create: () => new {{action.pascal}}UseCase(createMockHttp({{action.camel}}Routes)),
})

const apiTestUrl = process.env.API_TEST_URL

describe.skipIf(!apiTestUrl)('{{action.pascal}}UseCase contra a API de teste (pulado: defina API_TEST_URL)', () => {
  runContractSuite({{action.camel}}Contract, {
    name: 'API',
    create: () => new {{action.pascal}}UseCase(createHttp({ baseUrl: apiTestUrl ?? '' })),
  })
})

it('traduz o erro da API em UIError {{action.constant}}_FAILED', async () => {
  const failing = new {{action.pascal}}UseCase(async () => {
    throw new HttpError(500, 'falhou')
  })
  const error = await failing.execute(INPUT).catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(UIError)
  expect(error).toMatchObject({ code: '{{action.constant}}_FAILED' })
})
