import { describe, expect, it } from 'vitest'
import { domainNames } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import { findProject } from '../lib/project.ts'
import { patchText } from '../test/app.ts'
import { makeProject } from '../test/fs.ts'
import { registerRepository, registerRepositoryEntry } from './register-repository.ts'
import { fixturePlan } from '../test/fixture-project.ts'

const text = (plan: ChangePlan) => plan.source(`${plan.project.src}/repositories/index.ts`).getFullText()

describe('registerRepository', () => {
  it('acrescenta o import, o export * e a entrada do mapa, cada um em ordem alfabética', () => {
    const plan = fixturePlan()

    registerRepository(plan, domainNames('suppliers'))

    // O resto do arquivo (o que vem do modelo) fica como estava; só as três linhas entram
    const before = text(fixturePlan())
    expect(text(plan)).toBe(
      [
        [
          "import { createSupportRepository } from './support'\n",
          "import { createSuppliersRepository } from './suppliers'\nimport { createSupportRepository } from './support'\n",
        ],
        ["export * from './support'\n", "export * from './suppliers'\nexport * from './support'\n"],
        [
          '  support: createSupportRepository,\n',
          '  suppliers: createSuppliersRepository,\n  support: createSupportRepository,\n',
        ],
      ].reduce((index, [from, to]) => patchText(index!, from!, to!), before),
    )
  })

  it('no fim da lista, depois do último, com a vírgula do estilo do arquivo', () => {
    const plan = fixturePlan()

    registerRepository(plan, domainNames('zones'))

    const index = text(plan)
    expect(index).toContain(
      "import { createTaskRepository } from './task'\nimport { createZonesRepository } from './zones'\n",
    )
    expect(index).toContain(
      "export * from './task'\nexport * from './zones'\nexport { DATA_SOURCES",
    )
    expect(index).toContain('  tasks: createTaskRepository,\n  zones: createZonesRepository,\n}')
  })

  it('usa a chave camelCase do domínio de duas palavras', () => {
    const plan = fixturePlan()

    registerRepository(plan, domainNames('purchase-orders'))

    const index = text(plan)
    expect(index).toContain('  purchaseOrders: createPurchaseOrdersRepository,\n  support:')
    expect(index).toContain("import { createPurchaseOrdersRepository } from './purchase-orders'")
    expect(index).toContain("export * from './purchase-orders'")
  })

  it('funciona com mapa sem vírgula final e com ponto e vírgula; sem export * não sabe onde pôr', () => {
    const source = `import { createAaRepository } from "./aa";
export * from "./aa";
const factories = {
  aa: createAaRepository
};
`
    const plan = new ChangePlan(findProject(makeProject({ 'src/repositories/index.ts': source })))
    registerRepository(plan, domainNames('bees'))
    expect(text(plan))
      .toBe(`import { createAaRepository } from "./aa";
import { createBeesRepository } from "./bees";
export * from "./aa";
export * from "./bees";
const factories = {
  aa: createAaRepository,
  bees: createBeesRepository
};
`)

    const empty = `const factories = {}
`
    const emptyPlan = new ChangePlan(
      findProject(makeProject({ 'src/repositories/index.ts': empty })),
    )
    expect(() => registerRepository(emptyPlan, domainNames('bees'))).toThrow(
      /não achei onde acrescentar '.\/bees'/,
    )
  })

  it('registra o primeiro domínio de um índice sem domínios, como o de um projeto novo', () => {
    const source = `import { createRepositoryContainer } from '@matizze/prumo-core/repositories'
import { DATA_SOURCES, type RepositoryOptions } from './options'

export { DATA_SOURCES, type RepositoryOptions } from './options'

const factories = {}

export const container = createRepositoryContainer(factories, { dataSource: DATA_SOURCES[0] })
`
    const plan = new ChangePlan(findProject(makeProject({ 'src/repositories/index.ts': source })))

    registerRepository(plan, domainNames('bees'))

    expect(text(plan))
      .toBe(`import { createRepositoryContainer } from '@matizze/prumo-core/repositories'
import { createBeesRepository } from './bees'
import { DATA_SOURCES, type RepositoryOptions } from './options'

export * from './bees'
export { DATA_SOURCES, type RepositoryOptions } from './options'

const factories = {
  bees: createBeesRepository,
}

export const container = createRepositoryContainer(factories, { dataSource: DATA_SOURCES[0] })
`)
  })

  it('sem nenhum export de módulo, o primeiro export * vem depois do último import', () => {
    const source = `import { createRepositoryContainer } from '@matizze/prumo-core/repositories'
const factories = {}
`
    const plan = new ChangePlan(findProject(makeProject({ 'src/repositories/index.ts': source })))

    registerRepository(plan, domainNames('bees'))

    expect(text(plan))
      .toBe(`import { createRepositoryContainer } from '@matizze/prumo-core/repositories'
import { createBeesRepository } from './bees'

export * from './bees'
const factories = {
  bees: createBeesRepository,
}
`)
  })

  it('acrescenta ao mapa vazio', () => {
    const source = `import { x } from '@x/y'
export * from './aa'
const factories = {}
`
    const plan = new ChangePlan(findProject(makeProject({ 'src/repositories/index.ts': source })))

    registerRepository(plan, domainNames('bees'))

    expect(text(plan))
      .toBe(`import { x } from '@x/y'
import { createBeesRepository } from './bees'
export * from './aa'
export * from './bees'
const factories = {
  bees: createBeesRepository,
}
`)
  })

  it('recusa domínio repetido, índice sem mapa e índice que não existe', () => {
    expect(() => registerRepository(fixturePlan(), domainNames('customers'))).toThrow(
      /já exporta '.\/customers'/,
    )

    const repeated = `export * from './x'
const factories = { suppliers: a }
`
    expect(() =>
      registerRepository(
        new ChangePlan(findProject(makeProject({ 'src/repositories/index.ts': repeated }))),
        domainNames('suppliers'),
      ),
    ).toThrow(/já tem o domínio 'suppliers' no mapa factories/)

    expect(() =>
      registerRepository(
        new ChangePlan(findProject(makeProject({ 'src/repositories/index.ts': 'export {}\n' }))),
        domainNames('suppliers'),
      ),
    ).toThrow(/não tem o mapa 'const factories/)
    expect(() =>
      registerRepository(
        new ChangePlan(findProject(makeProject({}, ['src']))),
        domainNames('suppliers'),
      ),
    ).toThrow('o projeto não tem src/repositories/index.ts.')
  })
})

describe('registerRepositoryEntry (nomes dados, sem derivar nada)', () => {
  it('registra o repositório com os nomes que recebe', () => {
    const plan = fixturePlan()

    registerRepositoryEntry(plan, { directory: 'order', factory: 'createOrderRepository', key: 'orders' })

    expect(text(plan)).toContain(
      "import { DATA_SOURCES, type RepositoryOptions } from './options'\nimport { createOrderRepository } from './order'\n",
    )
    expect(text(plan)).toContain("export * from './customers'\nexport * from './order'\n")
    expect(text(plan)).toContain('  customers: createCustomersRepository,\n  orders: createOrderRepository,\n')
  })
})
