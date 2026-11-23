import { UIError } from '@matizze/prumo-core/errors'
import { defineContractSuite, runContractSuite } from '@matizze/prumo-testing/contract'
import { expect, it } from 'vitest'
import { MOCK_{{plural.constant}} } from './fixtures'
import type { I{{plural.pascal}}Repository } from './repository.contract'
import { Mock{{plural.pascal}}Repository } from './repository.mock'

const {{plural.camel}}Contract = defineContractSuite<I{{plural.pascal}}Repository>(
  'I{{plural.pascal}}Repository contract',
  ({ repo }) => {
    it('lista as fixtures, com ids únicos', async () => {
      const { items, total } = await repo.list()
      expect(total).toBe(MOCK_{{plural.constant}}.length)
      expect(new Set(items.map((item) => item.id)).size).toBe(MOCK_{{plural.constant}}.length)
    })

    it('busca {{fields.searchPhrase}}, sem diferenciar maiúsculas e acentos', async () => {
      const { items } = await repo.list({ search: {{test.searchTerm}} })
      expect(items.map((item) => item.{{test.searchField}})).toEqual([{{test.searchHit}}])
      expect((await repo.list({ search: 'nada disso' })).total).toBe(0)
    })

    it('ordena e pagina, com o total de antes da página', async () => {
      const page = await repo.list({
        sort: { key: '{{test.sortKey}}', direction: 'desc' },
        page: 1,
        page_size: 2,
      })
      expect(page.total).toBe(MOCK_{{plural.constant}}.length)
      expect(page.items.map((item) => item.{{test.sortKey}})).toEqual([
        {{test.sortFirst}},
        {{test.sortSecond}},
      ])
    })

    it('busca um registro e rejeita um id que não existe', async () => {
      expect(await repo.get('{{singular.kebab}}-1')).toEqual(MOCK_{{plural.constant}}[0])
      await expect(repo.get('{{singular.kebab}}-missing')).rejects.toBeInstanceOf(UIError)
      await expect(repo.get('{{singular.kebab}}-missing')).rejects.toMatchObject({
        code: '{{singular.constant}}_NOT_FOUND',
      })
    })

    it('cria um registro com id e data, e ele aparece na lista', async () => {
      const created = await repo.create({{test.newInput}})
      expect(created).toMatchObject({{test.newInput}})
      expect(created.id).not.toBe('')
      expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false)
      const { items, total } = await repo.list()
      expect(total).toBe(MOCK_{{plural.constant}}.length + 1)
      expect(new Set(items.map((item) => item.id)).size).toBe(total)
      expect(await repo.get(created.id)).toEqual(created)
    })

    it('edita um registro e rejeita um id que não existe', async () => {
      const updated = await repo.update('{{singular.kebab}}-1', { {{test.editName}}: {{test.editValue}} })
      expect(updated).toMatchObject({ id: '{{singular.kebab}}-1', {{test.editName}}: {{test.editValue}} })
      expect((await repo.get('{{singular.kebab}}-1')).{{test.editName}}).toBe({{test.editValue}})
      await expect(repo.update('{{singular.kebab}}-missing', { {{test.editName}}: {{test.editValue}} })).rejects.toMatchObject({
        code: '{{singular.constant}}_NOT_FOUND',
      })
    })

    it('edita só os campos enviados e mantém os outros', async () => {
      const before = await repo.get('{{singular.kebab}}-1')
      expect(await repo.update('{{singular.kebab}}-1', {})).toEqual(before)
      const updated = await repo.update('{{singular.kebab}}-1', { {{test.editName}}: {{test.partialValue}} })
      expect(updated).toEqual({ ...before, {{test.editName}}: {{test.partialValue}} })
    })

    it('remove um registro e rejeita um id que não existe', async () => {
      await repo.remove('{{singular.kebab}}-1')
      expect((await repo.list()).total).toBe(MOCK_{{plural.constant}}.length - 1)
      await expect(repo.get('{{singular.kebab}}-1')).rejects.toBeInstanceOf(UIError)
      await expect(repo.remove('{{singular.kebab}}-1')).rejects.toMatchObject({
        code: '{{singular.constant}}_NOT_FOUND',
      })
    })
  },
)

runContractSuite({{plural.camel}}Contract, {
  name: 'Mock{{plural.pascal}}Repository',
  create: () => new Mock{{plural.pascal}}Repository({ latencyMs: 0 }),
})
