import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findProject } from '../project.ts'
import { makeProject } from '../test-support.ts'
import { addRoute, addRouteSnippet, openOriginApp, type RouteSnippet } from './add-route.ts'
import { ChangePlan } from './plan.ts'

const ORIGIN = `import type { ReactNode } from 'react'
import { Redirect, Route, Switch } from 'wouter'
import { Guard } from '@/components/guard'
import { SettingsLayout } from '@/components/layout/settings-layout'
import OrdersPage from '@/pages/orders'
import SettingsGeneralPage from '@/pages/settings-general'
import SettingsSecurityPage from '@/pages/settings-security'

function Private({ children }: { children: ReactNode }) {
  return <Guard>{children}</Guard>
}

const SHELL_KEY = 'shell'

export default function App() {
  return (
    <Switch>
      <Route key={SHELL_KEY} path="/orders">
        <Private>
          <OrdersPage />
        </Private>
      </Route>

      <Route path="/guarded">
        <Guard>
          <OrdersPage />
        </Guard>
      </Route>

      <Route key={SHELL_KEY} path="/settings/*?">
        <Private>
          <Route path="/settings" nest>
            <SettingsLayout>
              <Switch>
                <Route path="/general" component={SettingsGeneralPage} />
                <Route path="/security" component={SettingsSecurityPage} />
                <Route>
                  <Redirect to="/general" replace />
                </Route>
              </Switch>
            </SettingsLayout>
          </Route>
        </Private>
      </Route>
    </Switch>
  )
}
`

const SHELL = `import type { ReactNode } from 'react'
import { Route, Switch } from 'wouter'
import { AppLayout } from '@/components/layout/app-layout'
import BlankPage from '@/pages/blank'
import ProfilePage from '@/pages/profile'

function Private({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}

const SHELL_KEY = 'shell'

export default function App() {
  return (
    <Switch>
      <Route key={SHELL_KEY} path="/blank">
        <Private>
          <BlankPage />
        </Private>
      </Route>

      <Route key={SHELL_KEY} path="/profile">
        <Private>
          <ProfilePage />
        </Private>
      </Route>

      <Route>
        <p>404</p>
      </Route>
    </Switch>
  )
}
`

const ORDERS = {
  component: 'OrdersPage',
  importPath: '@/pages/orders',
  path: '/orders',
}

const SECURITY = {
  component: 'SettingsSecurityPage',
  importPath: '@/pages/settings-security',
  path: '/security',
  prefix: '/settings',
  layout: 'SettingsLayout',
}

/** Um projeto com o `App.tsx` dado, uma origem com o `App.tsx` de fixture e o plano sobre o projeto. */
function setup(app: string, files: Record<string, string> = {}, originApp = ORIGIN) {
  const root = makeProject({ 'src/App.tsx': app, ...files })
  const origin = makeProject({ 'src/App.tsx': originApp })
  const plan = new ChangePlan(findProject(root))
  return {
    plan,
    origin: openOriginApp(plan, path.join(origin, 'src/App.tsx')),
    text: () => plan.source(plan.project.app).getFullText(),
  }
}

describe('addRoute', () => {
  it('clona o <Route> da origem depois da última rota com path, com o import na ordem dos de @/pages', () => {
    const { plan, origin, text } = setup(SHELL)

    expect(addRoute(plan, origin, ORDERS)).toBe(true)
    expect(text()).toContain(
      `import BlankPage from '@/pages/blank'
import OrdersPage from '@/pages/orders'
import ProfilePage from '@/pages/profile'
`,
    )
    expect(text()).toContain(`      <Route key={SHELL_KEY} path="/profile">
        <Private>
          <ProfilePage />
        </Private>
      </Route>

      <Route key={SHELL_KEY} path="/orders">
        <Private>
          <OrdersPage />
        </Private>
      </Route>

      <Route>
        <p>404</p>
      </Route>`)
  })

  it('não faz nada se o App.tsx já tem uma rota para o componente', () => {
    const { plan, origin, text } = setup(SHELL)
    addRoute(plan, origin, ORDERS)
    const once = text()

    expect(addRoute(plan, origin, ORDERS)).toBe(false)
    expect(text()).toBe(once)
  })

  it('recusa o componente que o App.tsx declara sem uma rota para ele', () => {
    const { plan, origin } = setup(`${SHELL}\nconst OrdersPage = 1\n`)

    expect(() => addRoute(plan, origin, ORDERS)).toThrow(
      "src/App.tsx já declara 'OrdersPage' sem uma rota para ele",
    )
  })

  it('recusa o path que o App.tsx já tem com outra tela, e o que uma rota com curinga cobre', () => {
    const same = setup(SHELL.replace('path="/blank"', 'path="/orders"'))
    expect(() => addRoute(same.plan, same.origin, ORDERS)).toThrow(
      "src/App.tsx já tem uma rota '/orders'",
    )

    const wildcard = setup(SHELL.replace('path="/blank"', 'path="/orders/*?"'))
    expect(() => addRoute(wildcard.plan, wildcard.origin, ORDERS)).toThrow(
      "a rota '/orders' conflita com a rota '/orders/*?'",
    )
  })

  it('põe a tela de um nest no Switch do nest que o projeto já tem, antes da rota curinga', () => {
    const app = `${ORIGIN.replace(
      /<Route key=\{SHELL_KEY\} path="\/orders">[\s\S]*?<\/Route>\n\n {6}<Route path="\/guarded">[\s\S]*?<\/Route>\n\n/,
      '',
    )
      .replace("import SettingsSecurityPage from '@/pages/settings-security'\n", '')
      .replace(
        '                <Route path="/security" component={SettingsSecurityPage} />\n',
        '',
      )}`
    const { plan, origin, text } = setup(app)

    expect(addRoute(plan, origin, SECURITY)).toBe(true)
    expect(text())
      .toContain(`                <Route path="/general" component={SettingsGeneralPage} />
                <Route path="/security" component={SettingsSecurityPage} />
                <Route>
                  <Redirect to="/general" replace />`)
    expect(text()).toContain(
      "import SettingsGeneralPage from '@/pages/settings-general'\nimport SettingsSecurityPage from '@/pages/settings-security'\n",
    )
  })

  it('sem o nest no projeto, traz o <Route> de primeiro nível da origem só com a rota da tela', () => {
    const { plan, origin, text } = setup(SHELL, {
      'src/components/layout/settings-layout.tsx': 'export const SettingsLayout = 1\n',
    })

    expect(addRoute(plan, origin, SECURITY)).toBe(true)
    expect(text()).toContain(`      <Route key={SHELL_KEY} path="/settings/*?">
        <Private>
          <Route path="/settings" nest>
            <SettingsLayout>
              <Switch>
                <Route path="/security" component={SettingsSecurityPage} />
              </Switch>
            </SettingsLayout>
          </Route>
        </Private>
      </Route>

      <Route>
        <p>404</p>
      </Route>`)
    // O layout vem com o import, depois do último import que já existe
    expect(text()).toContain(
      "import ProfilePage from '@/pages/profile'\nimport { SettingsLayout } from '@/components/layout/settings-layout'\n",
    )
    expect(text()).toContain("import SettingsSecurityPage from '@/pages/settings-security'\n")
    expect(text()).not.toContain('SettingsGeneralPage')
    expect(text()).not.toContain('Redirect')
  })

  it('a segunda tela do mesmo nest entra no Switch que a primeira criou', () => {
    const { plan, origin, text } = setup(SHELL, {
      'src/components/layout/settings-layout.tsx': 'export const SettingsLayout = 1\n',
    })
    addRoute(plan, origin, SECURITY)

    addRoute(plan, origin, {
      component: 'SettingsGeneralPage',
      importPath: '@/pages/settings-general',
      path: '/general',
      prefix: '/settings',
      layout: 'SettingsLayout',
    })
    expect(text())
      .toContain(`                <Route path="/security" component={SettingsSecurityPage} />
                <Route path="/general" component={SettingsGeneralPage} />
              </Switch>`)
  })

  it('traz para o import existente do mesmo módulo o nome que o clone usa', () => {
    const { plan, origin, text } = setup(
      SHELL.replace(
        'import { AppLayout }',
        "import { Other } from '@/components/guard'\nimport { AppLayout }",
      ),
      { 'src/components/guard.tsx': 'export const Guard = 1\nexport const Other = 2\n' },
    )

    addRoute(plan, origin, { ...ORDERS, path: '/guarded' })
    expect(text()).toContain("import { Other, Guard } from '@/components/guard'\n")
    expect(text()).toContain('<Route path="/guarded">\n        <Guard>\n          <OrdersPage />')
  })

  it('recusa o nome que a rota usa e o projeto não tem nem consegue importar', () => {
    // O `Private` é declarado no App.tsx da origem: não dá para trazer
    const noPrivate = setup(
      SHELL.replace(/function Private[\s\S]*?\n}\n\n/, '').replaceAll('Private', 'AppLayout'),
    )
    expect(() => addRoute(noPrivate.plan, noPrivate.origin, ORDERS)).toThrow(
      "src/App.tsx não declara nem importa 'Private', que a rota usa: traga-o para o src/App.tsx do projeto",
    )

    // O layout é importado pela origem, mas o projeto não tem o arquivo
    const noLayout = setup(SHELL)
    expect(() => addRoute(noLayout.plan, noLayout.origin, SECURITY)).toThrow(
      "não declara nem importa 'SettingsLayout'",
    )
  })

  it('recusa App.tsx sem Switch, projeto sem App.tsx e rota que a origem não tem', () => {
    const noSwitch = setup(
      "import { Route } from 'wouter'\nexport default function App() {\n  return null\n}\n",
    )
    expect(() => addRoute(noSwitch.plan, noSwitch.origin, ORDERS)).toThrow(
      'src/App.tsx não tem o <Switch> das rotas.',
    )

    const none = makeProject({}, ['src'])
    const plan = new ChangePlan(findProject(none))
    const origin = openOriginApp(
      plan,
      path.join(makeProject({ 'src/App.tsx': ORIGIN }), 'src/App.tsx'),
    )
    expect(() => addRoute(plan, origin, ORDERS)).toThrow('o projeto não tem src/App.tsx.')

    const { plan: plan2, origin: origin2 } = setup(SHELL)
    expect(() => addRoute(plan2, origin2, { ...ORDERS, path: '/nada' })).toThrow(
      "a origem não tem, no src/App.tsx dela, a rota '/nada' de 'OrdersPage'",
    )
  })

  it('não grava nada: só o plano muda', () => {
    const { plan, origin } = setup(SHELL)
    addRoute(plan, origin, ORDERS)

    expect(plan.summary()).toEqual({ created: [], modified: ['src/App.tsx'] })
    expect(readFileSync(plan.project.app, 'utf8')).toBe(SHELL)
  })
})

const CLIENTES: RouteSnippet = {
  component: 'ClientesPage',
  importPath: '@/pages/clientes',
  path: '/clientes',
  element: '<Route path="/clientes">\n  <ClientesPage />\n</Route>',
}

/** Um projeto só com o `App.tsx` dado e o plano sobre ele, sem origem. */
function setupSnippet(app: string) {
  const plan = new ChangePlan(findProject(makeProject({ 'src/App.tsx': app })))
  return { plan, text: () => plan.source(plan.project.app).getFullText() }
}

describe('addRouteSnippet', () => {
  it('põe o trecho depois da última rota com path, recuado como a vizinha, e o import na ordem de @/pages', () => {
    const { plan, text } = setupSnippet(SHELL)

    expect(addRouteSnippet(plan, CLIENTES)).toBe(true)
    expect(text()).toContain(
      `import BlankPage from '@/pages/blank'
import ClientesPage from '@/pages/clientes'
import ProfilePage from '@/pages/profile'
`,
    )
    expect(text()).toContain(`      <Route key={SHELL_KEY} path="/profile">
        <Private>
          <ProfilePage />
        </Private>
      </Route>

      <Route path="/clientes">
        <ClientesPage />
      </Route>

      <Route>
        <p>404</p>
      </Route>`)
  })

  it('numa lista de rotas sem linha em branco entre elas, não abre uma', () => {
    const { plan, text } = setupSnippet(`import { Route, Switch } from 'wouter'
import HomePage from '@/pages/home'

export default function App() {
  return (
    <Switch>
      <Route path="/home" component={HomePage} />
    </Switch>
  )
}
`)

    addRouteSnippet(plan, CLIENTES)
    expect(text()).toContain(`      <Route path="/home" component={HomePage} />
      <Route path="/clientes">
        <ClientesPage />
      </Route>
    </Switch>`)
    expect(text()).toContain(
      "import ClientesPage from '@/pages/clientes'\nimport HomePage from '@/pages/home'\n",
    )
  })

  it('antes da rota curinga, quando nenhuma rota tem path', () => {
    const { plan, text } = setupSnippet(`import { Route, Switch } from 'wouter'

export default function App() {
  return (
    <Switch>
      <Route>
        <p>404</p>
      </Route>
    </Switch>
  )
}
`)

    addRouteSnippet(plan, CLIENTES)
    expect(text()).toContain(`    <Switch>
      <Route path="/clientes">
        <ClientesPage />
      </Route>

      <Route>
        <p>404</p>
      </Route>
    </Switch>`)
    // Sem outro import de @/pages, o da tela entra depois do último import
    expect(text()).toContain(
      "import { Route, Switch } from 'wouter'\nimport ClientesPage from '@/pages/clientes'\n",
    )
  })

  it('num <Switch> vazio (o de um app novo), a rota entra sozinha', () => {
    const { plan, text } = setupSnippet(`import { Switch } from 'wouter'

export default function App() {
  return (
    <Switch></Switch>
  )
}
`)
    // O Route do trecho precisa estar importado: o App novo o importa junto com o Switch
    expect(() => addRouteSnippet(plan, CLIENTES)).toThrow(
      "src/App.tsx não declara nem importa 'Route', que a rota usa",
    )

    const ok = setupSnippet(`import { Route, Switch } from 'wouter'

export default function App() {
  return (
    <Switch>
    </Switch>
  )
}
`)
    addRouteSnippet(ok.plan, CLIENTES)
    expect(ok.text()).toContain(`    <Switch>
      <Route path="/clientes">
        <ClientesPage />
      </Route>
    </Switch>`)
    expect(text()).not.toContain('ClientesPage')
  })

  it('não faz nada se o App.tsx já tem uma rota para o componente', () => {
    const { plan, text } = setupSnippet(SHELL)
    addRouteSnippet(plan, CLIENTES)
    const once = text()

    expect(addRouteSnippet(plan, CLIENTES)).toBe(false)
    expect(text()).toBe(once)
  })

  it('recusa o componente que o App.tsx declara sem rota, o path repetido e o coberto por curinga', () => {
    const declared = setupSnippet(`${SHELL}\nconst ClientesPage = 1\n`)
    expect(() => addRouteSnippet(declared.plan, CLIENTES)).toThrow(
      "src/App.tsx já declara 'ClientesPage' sem uma rota para ele",
    )

    const same = setupSnippet(SHELL.replace('path="/blank"', 'path="/clientes"'))
    expect(() => addRouteSnippet(same.plan, CLIENTES)).toThrow(
      "src/App.tsx já tem uma rota '/clientes'",
    )

    const wildcard = setupSnippet(SHELL.replace('path="/blank"', 'path="/clientes/*?"'))
    expect(() => addRouteSnippet(wildcard.plan, CLIENTES)).toThrow(
      "a rota '/clientes' conflita com a rota '/clientes/*?'",
    )
  })

  it('traz o nome que o trecho usa só se o App.tsx já o tem', () => {
    const guarded: RouteSnippet = {
      ...CLIENTES,
      element:
        '<Route path="/clientes">\n  <Private>\n    <ClientesPage />\n  </Private>\n</Route>',
    }
    const ok = setupSnippet(SHELL)
    addRouteSnippet(ok.plan, guarded)
    expect(ok.text()).toContain(`      <Route path="/clientes">
        <Private>
          <ClientesPage />
        </Private>
      </Route>`)

    const without = setupSnippet(SHELL.replace(/function Private[\s\S]*?\n}\n\n/, ''))
    expect(() => addRouteSnippet(without.plan, guarded)).toThrow(
      "src/App.tsx não declara nem importa 'Private', que a rota usa",
    )
  })

  it('recusa projeto sem App.tsx e App.tsx sem Switch', () => {
    const none = new ChangePlan(findProject(makeProject({}, ['src'])))
    expect(() => addRouteSnippet(none, CLIENTES)).toThrow('o projeto não tem src/App.tsx.')

    const noSwitch = setupSnippet(
      "import { Route } from 'wouter'\nexport default function App() {\n  return null\n}\n",
    )
    expect(() => addRouteSnippet(noSwitch.plan, CLIENTES)).toThrow(
      'src/App.tsx não tem o <Switch> das rotas.',
    )
  })

  it('o trecho que não é um <Route> com o path e o componente da costura é erro de quem chama', () => {
    const { plan } = setupSnippet(SHELL)
    const bad = (element: string) => () => addRouteSnippet(plan, { ...CLIENTES, element })

    expect(bad('<div />')).toThrow('o trecho da rota não é um único <Route>.')
    expect(bad('<Route path="/outro"><ClientesPage /></Route>')).toThrow(
      "o trecho da rota não tem o path '/clientes'",
    )
    expect(bad('<Route path="/clientes"><Outra /></Route>')).toThrow(
      "o trecho da rota não usa 'ClientesPage'",
    )
  })

  it('não grava nada: só o plano muda', () => {
    const { plan } = setupSnippet(SHELL)
    addRouteSnippet(plan, CLIENTES)

    expect(plan.summary()).toEqual({ created: [], modified: ['src/App.tsx'] })
    expect(readFileSync(plan.project.app, 'utf8')).toBe(SHELL)
  })
})
