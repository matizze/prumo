import { createHttp, createMockHttp } from '@matizze/prumo-core/http'
import { defineContractSuite, runContractSuite } from '@matizze/prumo-testing/contract'
import { describe, expect, it } from 'vitest'
import { {{action.camel}}Routes } from '../mocks/{{action.kebab}}'
import { {{action.pascal}}Response, type {{action.pascal}}Request } from '../types/{{action.kebab}}'
import { {{action.pascal}}UseCase } from './{{action.kebab}}.usecase'

const INPUT: {{action.pascal}}Request = {{test.input}}

const {{action.camel}}Contract = defineContractSuite<{{action.pascal}}UseCase>(
  '{{action.pascal}}UseCase contract',
  ({ subject }) => {
    it('aceita um Request válido e devolve o Response', async () => {
      const response = await subject.execute(INPUT)
      expect({{action.pascal}}Response.safeParse(response).success).toBe(true)
    })

    it('recusa um Request inválido', async () => {
      await expect(subject.execute(undefined as never)).rejects.toThrow()
    })
  },
)

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
