import { UIError } from '@matizze/prumo-core/errors'
import { createHttp, createMockHttp, HttpError } from '@matizze/prumo-core/http'
import { defineContractSuite, runContractSuite } from '@matizze/prumo-testing/contract'
import { describe, expect, it } from 'vitest'
import { MOCK_{{plural.constant}}, {{plural.camel}}Collection } from './collection.mock'
import { create{{plural.pascal}}UseCases, {{plural.camel}}Routes } from './index'

type {{plural.pascal}}UseCases = ReturnType<typeof create{{plural.pascal}}UseCases>

const {{action.camel}}Contract = defineContractSuite<{{plural.pascal}}UseCases>(
  '{{action.pascal}}UseCase contract',
  ({ subject }) => {
{{test.cases}}
    it('recusa um Input inválido', async () => {
      await expect(subject.{{action.camel}}.execute(undefined as never)).rejects.toThrow()
    })
  },
)

// O mesmo contrato roda contra o `http` de mentira (as rotas do .mock.ts, sobre a coleção em memória) e, com API_TEST_URL, contra a API de teste.
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

it('traduz o erro da API em UIError {{action.constant}}_FAILED', async () => {
  const failing = create{{plural.pascal}}UseCases({
    http: async () => {
      throw new HttpError(500, 'falhou')
    },
    storage: localStorage,
  })
  const error = await failing.{{action.camel}}.execute({{test.failInput}}).catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(UIError)
  expect(error).toMatchObject({ code: '{{action.constant}}_FAILED' })
})
