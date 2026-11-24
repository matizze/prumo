import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { createRuleTester } from '../rule-tester.ts'
import { noCrossPageImport } from './no-cross-page-import.ts'

// Projeto de verdade em disco, porque a tela é a pasta que tem index.tsx
const root = mkdtempSync(path.join(tmpdir(), 'prumo-cross-page-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

for (const file of [
  'src/pages/dashboard/index.tsx',
  'src/pages/billing/index.tsx',
  'src/pages/settings/index.tsx',
  'src/pages/auth/login/index.tsx',
  'src/pages/auth/register/index.tsx',
  'src/pages/auth/shared.ts',
  'src/pages/rascunho/view.tsx',
  'app/screens/home/index.tsx',
  'app/screens/about/index.tsx',
]) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  writeFileSync(path.join(root, file), '')
}

const inProject = (file: string) => path.join(root, file)

const view = inProject('src/pages/dashboard/view.tsx')

const loose = (page: string, target: string, specifier: string) => ({
  messageId: 'looseFile' as const,
  data: { page, target, specifier },
})

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
    { filename: view, code: "type Row = import('./model').Row" },
    { filename: view, code: "type Fn = typeof import('wouter').useLocation" },
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
    // Fora de pages/ não é uma tela: a regra deixa passar
    {
      filename: inProject('src/components/ui/x.tsx'),
      code: "import { x } from '../../pages/billing/model'",
    },
    // Os testes de uma tela também ficam na própria pasta
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
    // Telas em subpastas: a tela é auth/login, e o que está dentro dela é dela
    {
      filename: inProject('src/pages/auth/login/view.tsx'),
      code: "import { x } from '@/pages/auth/login/components/card'",
    },
    {
      filename: inProject('src/pages/auth/login/components/card.tsx'),
      code: "import { x } from '../model'",
    },
    // Arquivo solto numa pasta de grupo não é de tela: a regra não o olha
    {
      filename: inProject('src/pages/auth/shared.ts'),
      code: "import { x } from '@/pages/auth/register/model'",
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
    // import('x') em posição de tipo
    {
      filename: view,
      code: "type Row = import('@/pages/billing/model').InvoiceRow",
      errors: [cross('dashboard', 'billing', '@/pages/billing/model')],
    },
    // Os testes de uma tela também não olham outra
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
    // Telas em subpastas: auth/login não importa de auth/register nem de billing
    {
      filename: inProject('src/pages/auth/login/view.tsx'),
      code: "import { x } from '@/pages/auth/register/model'",
      errors: [cross('auth/login', 'auth/register', '@/pages/auth/register/model')],
    },
    {
      filename: inProject('src/pages/auth/login/components/card.tsx'),
      code: "import { x } from '../../register'",
      errors: [cross('auth/login', 'auth/register', '../../register')],
    },
    {
      filename: inProject('src/pages/dashboard/view.tsx'),
      code: "import { x } from '@/pages/auth/login'",
      errors: [cross('dashboard', 'auth/login', '@/pages/auth/login')],
    },
    // O arquivo solto numa pasta de grupo, importado por uma tela, é recusado com a mensagem própria
    {
      filename: inProject('src/pages/auth/login/view.tsx'),
      code: "import { x } from '../shared'",
      errors: [loose('auth/login', 'auth/shared', '../shared')],
    },
    // A pasta sem index.tsx e sem tela dentro conta como tela, como no prumo check
    {
      filename: inProject('src/pages/rascunho/view.tsx'),
      code: "import { x } from '@/pages/billing/model'",
      errors: [cross('rascunho', 'billing', '@/pages/billing/model')],
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
