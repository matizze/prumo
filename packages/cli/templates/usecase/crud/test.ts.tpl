import { createHttp, createMockHttp } from '@matizze/prumo-core/http'
import { defineContractSuite, runContractSuite } from '@matizze/prumo-testing/contract'
import { describe, expect, it } from 'vitest'
import { create{{plural.pascal}}UseCases, {{plural.camel}}Routes } from '../index'
import { MOCK_{{plural.constant}}, {{plural.camel}}Collection } from '../mocks/collection'

type {{plural.pascal}}UseCases = ReturnType<typeof create{{plural.pascal}}UseCases>

const {{action.camel}}Contract = defineContractSuite<{{plural.pascal}}UseCases>(
  '{{action.pascal}}UseCase contract',
  ({ subject }) => {
{{test.cases}}
    it('recusa um Request inválido', async () => {
      await expect(subject.{{action.camel}}.execute(undefined as never)).rejects.toThrow()
    })
  },
)

runContractSuite({{action.camel}}Contract, {
  name: 'mock',
  create: () => {
    {{plural.camel}}Collection.reset()
    return create{{plural.pascal}}UseCases({ http: createMockHttp({{plural.camel}}Routes), storage: localStorage })
  },
})

const apiTestUrl = process.env.API_TEST_URL

describe.skipIf(!apiTestUrl)('{{action.pascal}}UseCase contra a API de teste (pulado: defina API_TEST_URL)', () => {
  runContractSuite({{action.camel}}Contract, {
    name: 'API',
    create: () => create{{plural.pascal}}UseCases({ http: createHttp({ baseUrl: apiTestUrl ?? '' }), storage: localStorage }),
  })
})
