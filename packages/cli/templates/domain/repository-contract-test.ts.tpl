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

    it('busca pelo nome, sem diferenciar maiúsculas e acentos', async () => {
      const { items } = await repo.list({ search: 'EXEMPLO 2' })
      expect(items.map((item) => item.name)).toEqual(['Exemplo 2'])
      expect((await repo.list({ search: 'nada disso' })).total).toBe(0)
    })

    it('ordena e pagina, com o total de antes da página', async () => {
      const page = await repo.list({
        sort: { key: 'name', direction: 'desc' },
        page: 1,
        page_size: 2,
      })
      expect(page.total).toBe(MOCK_{{plural.constant}}.length)
      expect(page.items.map((item) => item.name)).toEqual(['Exemplo 3', 'Exemplo 2'])
    })

    it('busca um registro e rejeita um id que não existe', async () => {
      expect(await repo.get('{{singular.kebab}}-1')).toEqual(MOCK_{{plural.constant}}[0])
      await expect(repo.get('{{singular.kebab}}-missing')).rejects.toBeInstanceOf(UIError)
      await expect(repo.get('{{singular.kebab}}-missing')).rejects.toMatchObject({
        code: '{{singular.constant}}_NOT_FOUND',
      })
    })

    it('cria um registro com id e data, e ele aparece na lista', async () => {
      const created = await repo.create({ name: 'Novo' })
      expect(created).toMatchObject({ name: 'Novo' })
      expect(created.id).not.toBe('')
      expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false)
      const { items, total } = await repo.list()
      expect(total).toBe(MOCK_{{plural.constant}}.length + 1)
      expect(new Set(items.map((item) => item.id)).size).toBe(total)
      expect(await repo.get(created.id)).toEqual(created)
    })

    it('edita um registro e rejeita um id que não existe', async () => {
      const updated = await repo.update('{{singular.kebab}}-1', { name: 'Renomeado' })
      expect(updated).toMatchObject({ id: '{{singular.kebab}}-1', name: 'Renomeado' })
      expect((await repo.get('{{singular.kebab}}-1')).name).toBe('Renomeado')
      await expect(repo.update('{{singular.kebab}}-missing', { name: 'x' })).rejects.toMatchObject({
        code: '{{singular.constant}}_NOT_FOUND',
      })
    })

    it('edita só os campos enviados e mantém os outros', async () => {
      const before = await repo.get('{{singular.kebab}}-1')
      expect(await repo.update('{{singular.kebab}}-1', {})).toEqual(before)
      const updated = await repo.update('{{singular.kebab}}-1', { name: 'Parcial' })
      expect(updated).toEqual({ ...before, name: 'Parcial' })
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
