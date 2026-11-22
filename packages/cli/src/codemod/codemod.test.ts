import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeProject } from '../test-support.ts'
import {
  addRoute,
  domainNames,
  openOriginApp,
  registerDomain,
  registerMessageNamespace,
} from './index.ts'
import { fixturePlan } from './test-support.ts'

/** O `App.tsx` de uma origem, com a rota da tela `orders` que a costura traz para o projeto. */
const ORIGIN_APP = `import { Route, Switch } from 'wouter'
import OrdersPage from '@/pages/orders'

export default function App() {
  return (
    <Switch>
      <Route path="/orders">
        <OrdersPage />
      </Route>
    </Switch>
  )
}
`

/** As costuras de uma tela e de um domínio novos, na ordem em que um gerador as faria. */
function sew() {
  const plan = fixturePlan()
  const origin = makeProject({ 'src/App.tsx': ORIGIN_APP })
  registerMessageNamespace(plan, 'orders', 'orders')
  registerDomain(plan, domainNames('suppliers'))
  addRoute(plan, openOriginApp(plan, path.join(origin, 'src/App.tsx')), {
    component: 'OrdersPage',
    importPath: '@/pages/orders',
    path: '/orders',
  })
  return plan
}

describe('as costuras, juntas', () => {
  it('lista os arquivos que seriam alterados, sem escrever nada', () => {
    const plan = sew()

    expect(plan.summary()).toEqual({
      created: [],
      modified: [
        'src/App.tsx',
        'src/messages/en/index.ts',
        'src/messages/pt-BR/index.ts',
        'src/queries/index.ts',
        'src/repositories/index.ts',
        'src/schemas/index.ts',
      ],
    })
    expect(readFileSync(plan.project.app, 'utf8')).not.toContain('OrdersPage')
  })

  it('grava no commit: a rota, o import, as mensagens e os índices do domínio', () => {
    const plan = sew()
    plan.commit()

    const read = (file: string) => readFileSync(path.join(plan.project.root, file), 'utf8')
    expect(read('src/App.tsx')).toContain('<OrdersPage />')
    expect(read('src/App.tsx')).toContain("import OrdersPage from '@/pages/orders'")
    expect(read('src/messages/pt-BR/index.ts')).toContain("import orders from './orders.json'")
    expect(read('src/schemas/index.ts')).toContain("export * from './entities/supplier'")
    expect(read('src/repositories/index.ts')).toContain('suppliers: createSuppliersRepository')
    expect(read('src/queries/index.ts')).toContain('supplierKeys, supplierQueries')
  })
})
