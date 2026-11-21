import { describe, expect, it } from 'vitest'
import { findProject } from '../project.ts'
import { makeProject } from '../test-support.ts'
import { domainNames } from './names.ts'
import { ChangePlan } from './plan.ts'
import {
  registerDomain,
  registerQueries,
  registerRepository,
  registerSchema,
} from './register-domain.ts'
import { fixturePlan } from './test-support.ts'

/** O texto de um índice do projeto depois das costuras. */
const text = (plan: ChangePlan, file: string) => plan.source(file).getFullText()

describe('registerSchema', () => {
  it('acrescenta o export da entidade depois do último', () => {
    const plan = fixturePlan()

    registerSchema(plan, domainNames('suppliers'))

    expect(plan.source(`${plan.project.src}/schemas/index.ts`).getFullText())
      .toBe(`export * from './entities/user'
export * from '@matizze/prumo-core/data'
export * from './entities/customer'
export * from './forms/sign-in'
export {
  profileSchema,
  type ProfileSchema,
} from './entities/account'
export * from './entities/ai'
export * from './entities/supplier'
`)
  })

  it('segue o estilo do arquivo: aspas duplas e ponto e vírgula', () => {
    const root = makeProject({ 'src/schemas/index.ts': 'export * from "./entities/ai";\n' })
    const plan = new ChangePlan(findProject(root))

    registerSchema(plan, domainNames('suppliers'))

    expect(plan.source(`${plan.project.src}/schemas/index.ts`).getFullText()).toBe(
      'export * from "./entities/ai";\nexport * from "./entities/supplier";\n',
    )
  })

  it('recusa a entidade que já está exportada e o índice que não existe ou não tem export', () => {
    const plan = fixturePlan()
    expect(() => registerSchema(plan, domainNames('customers'))).toThrow(
      /src\/schemas\/index\.ts já exporta '.\/entities\/customer'/,
    )

    const without = new ChangePlan(findProject(makeProject({}, ['src'])))
    expect(() => registerSchema(without, domainNames('suppliers'))).toThrow(
      'o projeto não tem src/schemas/index.ts.',
    )
    const empty = new ChangePlan(findProject(makeProject({ 'src/schemas/index.ts': '\n' })))
    expect(() => registerSchema(empty, domainNames('suppliers'))).toThrow(/não tem nenhum export/)
  })
})

describe('registerQueries', () => {
  it('acrescenta o export no formato das linhas, em ordem alfabética pelo arquivo', () => {
    const plan = fixturePlan()

    registerQueries(plan, domainNames('suppliers'))

    expect(plan.source(`${plan.project.src}/queries/index.ts`).getFullText())
      .toBe(`export { accountKeys, accountQueries } from './account'
export { customerKeys, customerQueries } from './customers'
export { supplierKeys, supplierQueries } from './suppliers'
export { supportKeys, supportQueries } from './support'
export { taskKeys, taskQueries } from './tasks'
`)
  })

  it('vai para o começo e para o fim, quando o nome vem antes ou depois de todos', () => {
    const first = fixturePlan()
    registerQueries(first, domainNames('abbeys'))
    expect(first.source(`${first.project.src}/queries/index.ts`).getFullText()).toMatch(
      /^export \{ abbeyKeys, abbeyQueries \} from '.\/abbeys'\nexport \{ accountKeys/,
    )

    const last = fixturePlan()
    registerQueries(last, domainNames('zones'))
    expect(last.source(`${last.project.src}/queries/index.ts`).getFullText()).toMatch(
      /from '.\/tasks'\nexport \{ zoneKeys, zoneQueries \} from '.\/zones'\n$/,
    )
  })

  it('usa a entidade informada nos nomes e o plural no arquivo', () => {
    const plan = fixturePlan()

    registerQueries(plan, domainNames('purchase-orders'))

    expect(plan.source(`${plan.project.src}/queries/index.ts`).getFullText()).toContain(
      "export { purchaseOrderKeys, purchaseOrderQueries } from './purchase-orders'\nexport { supportKeys",
    )
  })

  it('recusa o arquivo que já está exportado', () => {
    expect(() => registerQueries(fixturePlan(), domainNames('customers'))).toThrow(
      /já exporta '.\/customers'/,
    )
  })
})

describe('registerRepository', () => {
  it('acrescenta o import, o export * e a entrada do mapa, cada um em ordem alfabética', () => {
    const plan = fixturePlan()

    registerRepository(plan, domainNames('suppliers'))

    expect(plan.source(`${plan.project.src}/repositories/index.ts`).getFullText()).toBe(`import {
  createRepositoryContainer,
  resolveDataSource,
  type RepositoryContainerOf,
} from '@matizze/prumo-core/repositories'
import { createAccountRepository } from './account'
import { createCustomersRepository } from './customers'
import { DATA_SOURCES, type RepositoryOptions } from './options'
import { createSuppliersRepository } from './suppliers'
import { createSupportRepository } from './support'
import { createTaskRepository } from './task'

export * from './account'
export * from './customers'
export * from './suppliers'
export * from './support'
export * from './task'
export { DATA_SOURCES, type DataSource, type RepositoryOptions } from './options'

/**
 * Mapa de fábricas: cada domínio exporta \`create<Dominio>Repository(options)\` e entra aqui com
 * uma linha, em ordem alfabética.
 */
const factories = {
  account: createAccountRepository,
  customers: createCustomersRepository,
  suppliers: createSuppliersRepository,
  support: createSupportRepository,
  tasks: createTaskRepository,
}

export type RepositoryContainer = RepositoryContainerOf<typeof factories>

export function createRepositories(options: Partial<RepositoryOptions> = {}): RepositoryContainer {
  const dataSource = options.dataSource ?? resolveDataSource(undefined, DATA_SOURCES, 'memory', 'X')
  return createRepositoryContainer(factories, { ...options, dataSource })
}
`)
  })

  it('no fim da lista, depois do último, com a vírgula do estilo do arquivo', () => {
    const plan = fixturePlan()

    registerRepository(plan, domainNames('zones'))

    const index = plan.source(`${plan.project.src}/repositories/index.ts`).getFullText()
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

    const index = plan.source(`${plan.project.src}/repositories/index.ts`).getFullText()
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
    expect(plan.source(`${plan.project.src}/repositories/index.ts`).getFullText())
      .toBe(`import { createAaRepository } from "./aa";
import { createBeesRepository } from "./bees";
export * from "./aa";
export * from "./bees";
const factories = {
  aa: createAaRepository,
  bees: createBeesRepository
};
`)

    const empty = `import { x } from '@x/y'
const factories = {}
`
    const emptyPlan = new ChangePlan(
      findProject(makeProject({ 'src/repositories/index.ts': empty })),
    )
    expect(() => registerRepository(emptyPlan, domainNames('bees'))).toThrow(
      /não achei onde acrescentar '.\/bees'/,
    )
  })

  it('acrescenta ao mapa vazio', () => {
    const source = `import { x } from '@x/y'
export * from './aa'
const factories = {}
`
    const plan = new ChangePlan(findProject(makeProject({ 'src/repositories/index.ts': source })))

    registerRepository(plan, domainNames('bees'))

    expect(plan.source(`${plan.project.src}/repositories/index.ts`).getFullText())
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

describe('registerDomain', () => {
  it('faz as três costuras e lista os três índices como alterados, sem escrever', () => {
    const plan = fixturePlan()

    registerDomain(plan, domainNames('suppliers'))

    expect(plan.summary()).toEqual({
      created: [],
      modified: ['src/queries/index.ts', 'src/repositories/index.ts', 'src/schemas/index.ts'],
    })
    expect(text(plan, `${plan.project.src}/queries/index.ts`)).toContain('supplierKeys')
  })
})
