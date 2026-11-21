import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  copyPage,
  deriveNames,
  registerMenuItem,
  registerMessages,
  registerRoute,
  renameExports,
  renameStoryTitles,
  replaceNamespace,
  replaceRoute,
} from './index.ts'
import { fixturePlan, routeAt } from './test-support.ts'

/** Gera a tela `pedidos-recentes` a partir de `products-list`, na ordem que o `make:page` usará. */
function generate() {
  const plan = fixturePlan()
  const from = deriveNames('products-list')
  const to = deriveNames('pedidos-recentes')

  copyPage(plan, from.kebab, to.kebab)
  renameExports(plan, from, to)
  replaceNamespace(plan, from.camel, to.camel)
  renameStoryTitles(plan, to)
  replaceRoute(plan, { from: '/products-list', to: '/pedidos-recentes' }, { from, to })
  registerMessages(plan, from.kebab, to.kebab, to.camel)
  registerRoute(
    plan,
    routeAt(plan, '/products-list'),
    '/pedidos-recentes',
    `${from.pascal}Page`,
    `${to.pascal}Page`,
    '@/pages/pedidos-recentes',
  )
  registerMenuItem(
    plan,
    'ecommerce',
    { key: to.camel, text: 'Pedidos recentes' },
    '/pedidos-recentes',
  )
  return plan
}

describe('o codemod, de ponta a ponta', () => {
  it('lista o que seria criado e alterado, sem escrever nada', () => {
    const plan = generate()

    expect(plan.summary()).toEqual({
      created: [
        'src/messages/en/pedidos-recentes.json',
        'src/messages/pt-BR/pedidos-recentes.json',
        'src/pages/pedidos-recentes/README.md',
        'src/pages/pedidos-recentes/components/product-table.stories.tsx',
        'src/pages/pedidos-recentes/components/product-table.tsx',
        'src/pages/pedidos-recentes/index.test.tsx',
        'src/pages/pedidos-recentes/index.tsx',
        'src/pages/pedidos-recentes/model.ts',
        'src/pages/pedidos-recentes/skeleton.tsx',
        'src/pages/pedidos-recentes/view.tsx',
      ],
      modified: [
        'src/App.tsx',
        'src/components/layout/app-layout/sidebar/data.tsx',
        'src/messages/en/index.ts',
        'src/messages/en/layout.json',
        'src/messages/pt-BR/index.ts',
        'src/messages/pt-BR/layout.json',
      ],
    })
    expect(() =>
      readFileSync(path.join(plan.project.pages, 'pedidos-recentes', 'index.tsx')),
    ).toThrow()
  })

  it('a tela gerada não leva nome, namespace, rota nem título da tela de origem', () => {
    const plan = generate()
    const code = plan
      .createdSources()
      .map((source) => source.getFullText())
      .join('\n')

    expect(code).not.toMatch(/ProductsList|productsList/)
    // As rotas de outras telas, o namespace common e o componente local ficam
    expect(code).toContain("navigate('/add-product')")
    expect(code).toContain("useTranslations('common')")
    expect(code).toContain('ProductTable')
    expect(code).toContain("title: 'Pages/PedidosRecentes/ProductTable'")
    expect(code).toContain("describe('PedidosRecentesPage'")
    expect(code).toContain("path: '/pedidos-recentes'")
  })

  it('grava no commit e o App ganha a rota, o import, o menu e as mensagens', () => {
    const plan = generate()
    plan.commit()

    const read = (file: string) => readFileSync(path.join(plan.project.root, file), 'utf8')
    expect(read('src/pages/pedidos-recentes/index.tsx')).toContain(
      'export default function PedidosRecentesPage()',
    )
    expect(read('src/App.tsx')).toContain('<Route key={SHELL_KEY} path="/pedidos-recentes">')
    expect(read('src/App.tsx')).toContain(
      "import PedidosRecentesPage from '@/pages/pedidos-recentes'",
    )
    expect(read('src/components/layout/app-layout/sidebar/data.tsx')).toContain(
      "'nav.items.pedidosRecentes'",
    )
    expect(read('src/messages/en/index.ts')).toContain(
      "import pedidosRecentes from './pedidos-recentes.json'",
    )
    expect(JSON.parse(read('src/messages/pt-BR/layout.json')).nav.items.pedidosRecentes).toBe(
      'Pedidos recentes',
    )
    expect(read('src/messages/pt-BR/pedidos-recentes.json')).toBe(
      read('src/messages/pt-BR/products-list.json'),
    )
  })
})
