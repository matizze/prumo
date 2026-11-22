import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemod/test-support.ts'
import { UsageError } from '../errors.ts'
import { generateComponent } from './component.ts'

function withPage(root: string, name = 'clientes') {
  mkdirSync(path.join(root, 'src/pages', name), { recursive: true })
}

describe('generateComponent', () => {
  it('--page: o componente e o teste dele na pasta components da tela', () => {
    const project = fixtureProject()
    withPage(project.root)
    const { plan, folder, file, page, names } = generateComponent(project, {
      name: 'resumo-do-pedido',
      page: 'clientes',
    })

    expect(names.pascal).toBe('ResumoDoPedido')
    expect(page?.kebab).toBe('clientes')
    expect(folder).toBe('src/pages/clientes/components')
    expect(file).toBe('src/pages/clientes/components/resumo-do-pedido.tsx')
    expect(plan.summary()).toEqual({
      created: [
        'src/pages/clientes/components/resumo-do-pedido.test.tsx',
        'src/pages/clientes/components/resumo-do-pedido.tsx',
      ],
      modified: [],
    })
    expect(plan.source(path.join(project.root, file)).getFullText())
      .toBe(`export interface ResumoDoPedidoProps {
  title: string
}

export function ResumoDoPedido({ title }: ResumoDoPedidoProps) {
  return (
    <section>
      <h2>{title}</h2>
    </section>
  )
}
`)
    expect(
      plan.source(path.join(project.root, folder, 'resumo-do-pedido.test.tsx')).getFullText(),
    ).toContain("import { ResumoDoPedido } from './resumo-do-pedido'")
  })

  it('--shared: vai para src/components/shared', () => {
    const { folder, plan } = generateComponent(fixtureProject(), { name: 'cartao', shared: true })

    expect(folder).toBe('src/components/shared')
    expect(plan.summary().created).toEqual([
      'src/components/shared/cartao.test.tsx',
      'src/components/shared/cartao.tsx',
    ])
  })

  it('exige --page ou --shared, e não aceita os dois', () => {
    const project = fixtureProject()
    withPage(project.root)

    expect(() => generateComponent(project, { name: 'cartao' })).toThrow(
      'diga onde o componente mora',
    )
    expect(() =>
      generateComponent(project, { name: 'cartao', page: 'clientes', shared: true }),
    ).toThrow('use --page <tela> ou --shared, não os dois.')
  })

  it('recusa a tela que não existe, o nome inválido e o nome global', () => {
    const project = fixtureProject()

    expect(() => generateComponent(project, { name: 'cartao', page: 'clientes' })).toThrow(
      "a tela 'clientes' não existe",
    )
    expect(() => generateComponent(project, { name: 'Cartao', shared: true })).toThrow(UsageError)
    expect(() => generateComponent(project, { name: 'map', shared: true })).toThrow(UsageError)
  })

  it('recusa sobrescrever um componente que já existe', () => {
    const project = fixtureProject()
    const first = generateComponent(project, { name: 'cartao', shared: true })
    first.plan.commit()

    expect(() =>
      generateComponent(project, { name: 'cartao', shared: true }).plan.commit(),
    ).toThrow(UsageError)
  })
})
