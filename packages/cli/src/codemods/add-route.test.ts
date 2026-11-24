import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ChangePlan } from '../lib/plan.ts'
import { findProject } from '../lib/project.ts'
import { makeProject } from '../test-support.ts'
import { addRouteSnippet, type RouteSnippet } from './add-route.ts'

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

  it.each(['*', '/*', '*?', '/*?'])('trata o path="%s" como a curinga: a rota nova entra antes dela e não conflita', (wild) => {
    const { plan, text } = setupSnippet(`import { Route, Switch } from 'wouter'

export default function App() {
  return (
    <Switch>
      <Route path="/home" component={HomePage} />
      <Route path="${wild}">
        <p>404</p>
      </Route>
    </Switch>
  )
}
`)
    expect(addRouteSnippet(plan, CLIENTES)).toBe(true)
    const app = text()
    expect(app.indexOf('path="/clientes"')).toBeGreaterThan(app.indexOf('path="/home"'))
    expect(app.indexOf('path="/clientes"')).toBeLessThan(app.indexOf(`path="${wild}"`))
  })

  it('a curinga com path="*" sozinha no Switch: a rota entra antes dela', () => {
    const { plan, text } = setupSnippet(`import { Route, Switch } from 'wouter'

export default function App() {
  return (
    <Switch>
      <Route path="*">
        <p>404</p>
      </Route>
    </Switch>
  )
}
`)
    addRouteSnippet(plan, CLIENTES)
    expect(text().indexOf('path="/clientes"')).toBeLessThan(text().indexOf('path="*"'))
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
