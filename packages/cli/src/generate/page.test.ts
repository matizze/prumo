import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemod/test-support.ts'
import { UsageError } from '../errors.ts'
import { generatePage } from './page.ts'

/** Dá ao projeto o domínio `clientes`, como o `make:domain` o deixa (só o que a tela confere). */
function withDomain(root: string, hook = 'useClientesList') {
  mkdirSync(path.join(root, 'src/queries'), { recursive: true })
  writeFileSync(
    path.join(root, 'src/queries/clientes.ts'),
    `export function ${hook}() {\n  return null\n}\n`,
  )
}

describe('generatePage', () => {
  it('sem domínio: lista os seis arquivos novos e as três costuras', () => {
    const { plan, names, route, domain } = generatePage(fixtureProject(), {
      name: 'pedidos-recentes',
    })

    expect(names.kebab).toBe('pedidos-recentes')
    expect(route).toBe('/pedidos-recentes')
    expect(domain).toBeUndefined()
    expect(plan.summary()).toEqual({
      created: [
        'src/messages/en/pedidos-recentes.json',
        'src/messages/pt-BR/pedidos-recentes.json',
        'src/pages/pedidos-recentes/index.test.tsx',
        'src/pages/pedidos-recentes/index.tsx',
        'src/pages/pedidos-recentes/model.ts',
        'src/pages/pedidos-recentes/view.tsx',
      ],
      modified: ['src/App.tsx', 'src/messages/en/index.ts', 'src/messages/pt-BR/index.ts'],
    })
  })

  it('não escreve nada: só o commit grava', () => {
    const project = fixtureProject()
    const before = readFileSync(project.app, 'utf8')

    generatePage(project, { name: 'clientes' })

    expect(readFileSync(project.app, 'utf8')).toBe(before)
  })

  it('o index liga o model à view, o model não tem JSX e a view só tem HTML', () => {
    const project = fixtureProject()
    const { plan } = generatePage(project, { name: 'clientes' })
    const at = (file: string) => plan.source(path.join(project.root, file)).getFullText()

    expect(at('src/pages/clientes/index.tsx')).toBe(`import { useClientesModel } from './model'
import { ClientesView } from './view'

export default function ClientesPage() {
  const model = useClientesModel()
  return <ClientesView {...model} />
}
`)
    expect(at('src/pages/clientes/model.ts')).toBe(`import { useTranslations } from '@/i18n'

export function useClientesModel() {
  const t = useTranslations('clientes')
  return { title: t('title') }
}

export type ClientesModel = ReturnType<typeof useClientesModel>
`)
    expect(at('src/pages/clientes/view.tsx')).toBe(`import type { ClientesModel } from './model'

export function ClientesView(m: ClientesModel) {
  return (
    <main>
      <h1>{m.title}</h1>
    </main>
  )
}
`)
    expect(at('src/pages/clientes/index.test.tsx')).toContain(
      "renderWithProviders(<ClientesPage />, { path: '/clientes' })",
    )
    expect(at('src/pages/clientes/index.test.tsx')).toContain("{ name: 'Clientes' }")
  })

  it('o nome com hífen vira o camel no namespace e o título com espaço', () => {
    const project = fixtureProject()
    const { plan } = generatePage(project, { name: 'pedidos-recentes' })
    const at = (file: string) => plan.source(path.join(project.root, file)).getFullText()

    expect(at('src/pages/pedidos-recentes/model.ts')).toContain(
      "useTranslations('pedidosRecentes')",
    )
    plan.commit()
    expect(
      readFileSync(path.join(project.root, 'src/messages/pt-BR/pedidos-recentes.json'), 'utf8'),
    ).toBe('{\n  "title": "Pedidos recentes"\n}\n')
    expect(at('src/messages/en/index.ts')).toContain(
      "import pedidosRecentes from './pedidos-recentes.json'",
    )
    expect(at('src/messages/en/index.ts')).toContain('  pedidosRecentes,\n')
  })

  it('registra a rota depois da última, com o import na ordem de @/pages', () => {
    const project = fixtureProject()
    const { plan } = generatePage(project, { name: 'clientes' })
    const app = plan.source(project.app).getFullText()

    expect(app).toContain(
      "import BlankPage from '@/pages/blank'\nimport ClientesPage from '@/pages/clientes'\nimport ProfilePage",
    )
    expect(app).toContain(`      <Route path="/clientes">
        <ClientesPage />
      </Route>
    </Switch>`)
  })

  it('com domínio: o model lê a lista, a view mostra o carregando, o erro e a lista, e há textos nos dois idiomas', () => {
    const project = fixtureProject()
    withDomain(project.root)
    const { plan, domain } = generatePage(project, { name: 'clientes', domain: 'clientes' })
    const at = (file: string) => plan.source(path.join(project.root, file)).getFullText()

    expect(domain?.kebab).toBe('clientes')
    expect(at('src/pages/clientes/model.ts')).toBe(`import { useTranslations } from '@/i18n'
import { useClientesList } from '@/queries/clientes'

export function useClientesModel() {
  const t = useTranslations('clientes')
  const list = useClientesList()
  return {
    title: t('title'),
    loadingText: t('loading'),
    failedText: t('failed'),
    items: list.data?.items ?? [],
    loading: list.isPending,
    failed: list.isError,
  }
}

export type ClientesModel = ReturnType<typeof useClientesModel>
`)
    expect(at('src/pages/clientes/view.tsx')).toContain('<li key={i.id}>{i.name}</li>')
    expect(at('src/pages/clientes/view.tsx')).toContain('m.loading ?')
    plan.commit()
    expect(readFileSync(path.join(project.root, 'src/messages/en/clientes.json'), 'utf8')).toBe(
      '{\n  "title": "Clientes",\n  "loading": "Loading…",\n  "failed": "Could not load the list."\n}\n',
    )
    expect(
      readFileSync(path.join(project.root, 'src/messages/pt-BR/clientes.json'), 'utf8'),
    ).toContain('"loading": "Carregando…"')
  })

  it('a tela pode ter outro nome que o do domínio', () => {
    const project = fixtureProject()
    withDomain(project.root)
    const { plan } = generatePage(project, { name: 'lista-de-clientes', domain: 'clientes' })

    const model = plan
      .source(path.join(project.root, 'src/pages/lista-de-clientes/model.ts'))
      .getFullText()
    expect(model).toContain('export function useListaDeClientesModel()')
    expect(model).toContain('useClientesList()')
  })

  it('recusa nome inválido, reservado e domínio inválido, com UsageError', () => {
    const project = fixtureProject()

    expect(() => generatePage(project, { name: 'Clientes' })).toThrow(UsageError)
    expect(() => generatePage(project, { name: 'clientes', domain: 'Meus_Clientes' })).toThrow(
      /o nome do domínio/,
    )
    expect(() => generatePage(project, { name: 'class' })).toThrow(UsageError)
  })

  it('recusa a tela que já existe', () => {
    const project = fixtureProject()
    mkdirSync(path.join(project.root, 'src/pages/clientes'), { recursive: true })

    expect(() => generatePage(project, { name: 'clientes' })).toThrow("a tela 'clientes' já existe")
  })

  it('recusa o domínio que não existe e o que não tem o hook de lista', () => {
    const project = fixtureProject()
    expect(() => generatePage(project, { name: 'clientes', domain: 'clientes' })).toThrow(
      "o domínio 'clientes' não existe: falta src/queries/clientes.ts (crie-o com prumo make:domain clientes)",
    )

    withDomain(project.root, 'useOutraCoisa')
    expect(() => generatePage(project, { name: 'clientes', domain: 'clientes' })).toThrow(
      'não tem o hook useClientesList',
    )
  })

  it('recusa o App.tsx sem rota livre para o caminho, sem escrever nada', () => {
    const project = fixtureProject()
    writeFileSync(
      project.app,
      readFileSync(project.app, 'utf8').replace('path="/blank"', 'path="/clientes"'),
    )

    expect(() => generatePage(project, { name: 'clientes' })).toThrow(UsageError)
  })
})
