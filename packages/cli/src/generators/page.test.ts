import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemods/test-support.ts'
import { UsageError } from '../errors.ts'
import { generatePage } from './page.ts'

describe('generatePage (só o título)', () => {
  it('planeja index, model, view, teste, mensagens, índices e a rota, sem escrever nada', () => {
    const project = fixtureProject()
    const { plan, names, route } = generatePage(project, { name: 'pedidos-recentes' })

    expect(names.pascal).toBe('PedidosRecentes')
    expect(route).toBe('/pedidos-recentes')
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
    expect(readFileSync(project.app, 'utf8')).not.toContain('PedidosRecentesPage')
  })

  it('grava no commit: a rota, o import e o namespace de mensagens', () => {
    const project = fixtureProject()
    generatePage(project, { name: 'clientes', route: '/lista' }).plan.commit()

    const app = readFileSync(project.app, 'utf8')
    expect(app).toContain("import ClientesPage from '@/pages/clientes'")
    expect(app).toContain('<Route path="/lista">')
    const model = readFileSync(path.join(project.pages, 'clientes/model.ts'), 'utf8')
    expect(model).toContain("useTranslations('clientes')")
    expect(readFileSync(path.join(project.messages, 'en/index.ts'), 'utf8')).toContain(
      "import clientes from './clientes.json'",
    )
    expect(
      JSON.parse(readFileSync(path.join(project.messages, 'pt-BR/clientes.json'), 'utf8')),
    ).toEqual({ title: 'Clientes' })
  })

  it('recusa nome inválido, reservado, tela que existe e rota inválida, sem planejar nada', () => {
    const project = fixtureProject()
    expect(() => generatePage(project, { name: 'Clientes' })).toThrow(UsageError)
    expect(() => generatePage(project, { name: 'new' })).toThrow(/palavra reservada/)
    expect(() => generatePage(project, { name: 'a', route: 'a' })).toThrow(/comece com \//)
    expect(() => generatePage(project, { name: 'a', route: '/a/:id' })).toThrow(UsageError)
    generatePage(project, { name: 'clientes' }).plan.commit()
    expect(() => generatePage(project, { name: 'clientes' })).toThrow(/já existe/)
  })
})
