import { createRuleTester, inProject } from '../rule-tester.ts'
import { noCrossPageImport } from './no-cross-page-import.ts'

const view = inProject('src/pages/dashboard/view.tsx')

const cross = (page: string, other: string, specifier: string) => ({
  messageId: 'crossPage' as const,
  data: { page, other, specifier },
})

createRuleTester().run('no-cross-page-import', noCrossPageImport, {
  valid: [
    // Imports da própria tela, pelo alias e por caminho relativo
    { filename: view, code: "import { Chart } from '@/pages/dashboard/components/chart'" },
    { filename: view, code: "import { useModel } from './model'" },
    { filename: view, code: "import { Chart } from './components/chart'" },
    {
      filename: inProject('src/pages/dashboard/components/chart.tsx'),
      code: "import x from '../model'",
    },
    {
      filename: inProject('src/pages/dashboard/components/chart.tsx'),
      code: "import x from '../../dashboard/model'",
    },
    // Fora das telas: shared, ui, repositórios e pacotes npm
    { filename: view, code: "import { Card } from '@/components/ui/card'" },
    { filename: view, code: "import { Table } from '@/components/shared/table'" },
    { filename: view, code: "import { tasks } from '@/queries'" },
    { filename: view, code: "import { Link } from 'wouter'" },
    { filename: view, code: "import { x } from '../../components/shared/table'" },
    // A pasta pages em si e o alias de outro lugar não contam
    { filename: view, code: "import { pages } from '@/pages'" },
    { filename: view, code: "import { x } from '../'" },
    { filename: view, code: "import { x } from '@/other/pages/billing'" },
    // Fora de pages/ não é uma tela: a regra deixa passar (quem cuida disso é a ui-boundary)
    {
      filename: inProject('src/components/ui/x.tsx'),
      code: "import { x } from '../../pages/billing/model'",
    },
    // Testes e stories de uma tela também ficam na própria pasta
    {
      filename: inProject('src/pages/dashboard/index.test.tsx'),
      code: "import { Page } from './index'",
    },
    // Arquivo solto em pages/ e arquivos fora de pages/ não são de uma tela
    { filename: inProject('src/pages/index.ts'), code: "import { x } from '@/pages/billing'" },
    { filename: inProject('src/App.tsx'), code: "import { Billing } from '@/pages/billing'" },
    {
      filename: inProject('src/components/layout/menu.tsx'),
      code: "import { Billing } from '@/pages/billing'",
    },
    // Opções
    {
      filename: inProject('app/screens/home/view.tsx'),
      code: "import { x } from '~/screens/home/model'",
      options: [{ alias: '~/', aliasRoot: 'app', pagesDir: 'app/screens' }],
    },
  ],
  invalid: [
    // Pelo alias
    {
      filename: view,
      code: "import { Invoice } from '@/pages/billing/components/invoice'",
      errors: [cross('dashboard', 'billing', '@/pages/billing/components/invoice')],
    },
    {
      filename: view,
      code: "import Billing from '@/pages/billing'",
      errors: [cross('dashboard', 'billing', '@/pages/billing')],
    },
    // Por caminho relativo
    {
      filename: view,
      code: "import { Invoice } from '../billing/components/invoice'",
      errors: [cross('dashboard', 'billing', '../billing/components/invoice')],
    },
    {
      filename: inProject('src/pages/dashboard/components/chart.tsx'),
      code: "import { model } from '../../billing/model'",
      errors: [cross('dashboard', 'billing', '../../billing/model')],
    },
    // Todas as formas de import e export
    {
      filename: view,
      code: "import type { Invoice } from '@/pages/billing/model'",
      errors: [cross('dashboard', 'billing', '@/pages/billing/model')],
    },
    {
      filename: view,
      code: "export { Invoice } from '@/pages/billing/view'",
      errors: [cross('dashboard', 'billing', '@/pages/billing/view')],
    },
    {
      filename: view,
      code: "export * from '../billing/view'",
      errors: [cross('dashboard', 'billing', '../billing/view')],
    },
    {
      filename: view,
      code: "const load = () => import('@/pages/billing')",
      errors: [cross('dashboard', 'billing', '@/pages/billing')],
    },
    // Testes e stories de uma tela também não olham outra
    {
      filename: inProject('src/pages/dashboard/index.test.tsx'),
      code: "import { fixture } from '@/pages/billing/index.test'",
      errors: [cross('dashboard', 'billing', '@/pages/billing/index.test')],
    },
    // Várias violações no mesmo arquivo
    {
      filename: view,
      code: "import a from '@/pages/billing/a'\nimport b from '@/pages/settings/b'",
      errors: [
        cross('dashboard', 'billing', '@/pages/billing/a'),
        cross('dashboard', 'settings', '@/pages/settings/b'),
      ],
    },
    // Opções
    {
      filename: inProject('app/screens/home/view.tsx'),
      code: "import { x } from '~/screens/about/model'",
      options: [{ alias: '~/', aliasRoot: 'app', pagesDir: 'app/screens' }],
      errors: [cross('home', 'about', '~/screens/about/model')],
    },
  ],
})
