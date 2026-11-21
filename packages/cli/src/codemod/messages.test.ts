import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { findProject } from '../project.ts'
import { makeProject } from '../test-support.ts'
import { messageKeys } from './messages.ts'
import { ChangePlan } from './plan.ts'

const INDEX = "import products from './products.json'\n\nexport default { products }\n"

function planOf(files: Record<string, string>): ChangePlan {
  return new ChangePlan(findProject(makeProject(files)))
}

describe('messageKeys', () => {
  it('lista as chaves completas, as mensagens e os grupos, com o namespace na frente', () => {
    const plan = planOf({
      'src/messages/pt-BR/index.ts': INDEX,
      'src/messages/pt-BR/products.json': JSON.stringify({
        title: 'Produtos',
        dialog: { required: 'Obrigatório', confirm: { yes: 'Sim' } },
        list: ['a', 'b'],
      }),
    })

    expect([...messageKeys(plan, 'products', 'productsList')].sort()).toEqual([
      'productsList.dialog',
      'productsList.dialog.confirm',
      'productsList.dialog.confirm.yes',
      'productsList.dialog.required',
      'productsList.list',
      'productsList.title',
    ])
  })

  it('junta os idiomas, e o idioma sem o arquivo não conta', () => {
    const plan = planOf({
      'src/messages/pt-BR/index.ts': INDEX,
      'src/messages/pt-BR/products.json': '{ "a": "x" }',
      'src/messages/en/index.ts': INDEX,
      'src/messages/en/products.json': '{ "b": "y" }',
      'src/messages/es/index.ts': INDEX,
    })

    expect([...messageKeys(plan, 'products', 'ns')].sort()).toEqual(['ns.a', 'ns.b'])
    expect([...messageKeys(plan, 'outro', 'ns')]).toEqual([])
  })

  it('recusa o JSON inválido', () => {
    const plan = planOf({
      'src/messages/pt-BR/index.ts': INDEX,
      'src/messages/pt-BR/products.json': '{ "a": ',
    })

    expect(() => messageKeys(plan, 'products', 'ns')).toThrow(UsageError)
    expect(() => messageKeys(plan, 'products', 'ns')).toThrow(
      'src/messages/pt-BR/products.json não é um JSON válido.',
    )
  })
})
