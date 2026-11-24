import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { domainNames } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import { findProject } from '../lib/project.ts'
import { makeProject } from '../test/fs.ts'
import { addDataSource, readDataSourceFromEnv, registerContractSource, registerFactorySource } from './register-source.ts'

const clientes = domainNames('clientes')

const FACTORY = `import type { RepositoryOptions } from '../options'
import type { IClientesRepository } from './repository.contract'
import { MockClientesRepository } from './repository.mock'

export type { IClientesRepository } from './repository.contract'
export { MockClientesRepository } from './repository.mock'
export { MOCK_CLIENTES } from './fixtures'

export function createClientesRepository({ latencyMs }: RepositoryOptions): IClientesRepository {
  // Uma linha por fonte
  return new MockClientesRepository({ latencyMs })
}
`

const CONTRACT_TEST = `import { defineContractSuite, runContractSuite } from '@matizze/prumo-testing/contract'
import { expect, it } from 'vitest'
import { MockClientesRepository } from './repository.mock'

const clientesContract = defineContractSuite('x', () => {
  it('a', () => expect(1).toBe(1))
})

runContractSuite(clientesContract, {
  name: 'MockClientesRepository',
  create: () => new MockClientesRepository({ latencyMs: 0 }),
})
`

function planWith(files: Record<string, string>): ChangePlan {
  return new ChangePlan(findProject(makeProject(files)))
}

const OPTIONS = (sources: string) => `export const DATA_SOURCES = ${sources}\n\nexport type DataSource = (typeof DATA_SOURCES)[number]\n`

const read = (plan: ChangePlan, file: string) => plan.source(`${plan.project.src}/${file}`).getFullText()

describe('addDataSource', () => {
  it('acrescenta a fonte à lista de uma linha', () => {
    const plan = planWith({ 'src/repositories/options.ts': OPTIONS("['mock'] as const") })
    addDataSource(plan, 'http')
    expect(read(plan, 'repositories/options.ts')).toContain("DATA_SOURCES = ['mock', 'http'] as const")
  })

  it('não repete uma fonte que já está na lista', () => {
    const plan = planWith({ 'src/repositories/options.ts': OPTIONS("['mock', 'http'] as const") })
    addDataSource(plan, 'http')
    expect(plan.summary().modified).toEqual([])
  })

  it('mantém aspas duplas, uma entrada por linha e a vírgula do fim', () => {
    const plan = planWith({
      'src/repositories/options.ts': OPTIONS('[\n  "mock",\n  "http",\n] as const'),
    })
    addDataSource(plan, 'storage')
    expect(read(plan, 'repositories/options.ts')).toContain(
      'DATA_SOURCES = [\n  "mock",\n  "http",\n  "storage",\n] as const',
    )
    const withoutComma = planWith({ 'src/repositories/options.ts': OPTIONS("[\n  'mock'\n] as const") })
    addDataSource(withoutComma, 'http')
    expect(read(withoutComma, 'repositories/options.ts')).toContain("[\n  'mock',\n  'http'\n] as const")
  })

  it('recusa o projeto sem o options.ts ou sem o DATA_SOURCES', () => {
    expect(() => addDataSource(planWith({ 'src/a.ts': '' }), 'http')).toThrow(UsageError)
    expect(() =>
      addDataSource(planWith({ 'src/repositories/options.ts': 'export const OUTRO = []\n' }), 'http'),
    ).toThrow("não tem o 'export const DATA_SOURCES")
  })
})

describe('registerFactorySource', () => {
  const plan = () => planWith({ 'src/repositories/clientes/index.ts': FACTORY })

  it('http: o import do api e da classe, o export e a linha antes do return, com o dataSource nas opções', () => {
    const p = plan()
    registerFactorySource(p, clientes, 'http')
    expect(read(p, 'repositories/clientes/index.ts')).toBe(`import { api } from '../api'
import type { RepositoryOptions } from '../options'
import type { IClientesRepository } from './repository.contract'
import { HttpClientesRepository } from './repository.http'
import { MockClientesRepository } from './repository.mock'

export type { IClientesRepository } from './repository.contract'
export { HttpClientesRepository } from './repository.http'
export { MockClientesRepository } from './repository.mock'
export { MOCK_CLIENTES } from './fixtures'

export function createClientesRepository({ dataSource, latencyMs }: RepositoryOptions): IClientesRepository {
  // Uma linha por fonte
  if (dataSource === 'http') return new HttpClientesRepository(api)
  return new MockClientesRepository({ latencyMs })
}
`)
  })

  it('storage depois do http: a linha nova vem depois da anterior, e o return final continua o mock', () => {
    const p = plan()
    registerFactorySource(p, clientes, 'http')
    registerFactorySource(p, clientes, 'storage')
    const text = read(p, 'repositories/clientes/index.ts')
    expect(text).toContain(
      "  if (dataSource === 'http') return new HttpClientesRepository(api)\n  if (dataSource === 'storage') return new StorageClientesRepository({ latencyMs })\n  return new MockClientesRepository({ latencyMs })",
    )
    expect(text).toContain("import { StorageClientesRepository } from './repository.storage'")
    expect(text).toContain("export { StorageClientesRepository } from './repository.storage'")
    expect(text.match(/dataSource,/g)).toHaveLength(1)
  })

  it('acrescenta o latencyMs que falta ao storage, e usa o parâmetro quando não é desestruturado', () => {
    const only = planWith({
      'src/repositories/clientes/index.ts': FACTORY.replace('{ latencyMs }: RepositoryOptions', '{ dataSource }: RepositoryOptions'),
    })
    registerFactorySource(only, clientes, 'storage')
    expect(read(only, 'repositories/clientes/index.ts')).toContain('({ latencyMs, dataSource }: RepositoryOptions)')

    const named = planWith({
      'src/repositories/clientes/index.ts': FACTORY.replace('{ latencyMs }: RepositoryOptions', 'options: RepositoryOptions').replace(
        'new MockClientesRepository({ latencyMs })',
        'new MockClientesRepository({ latencyMs: options.latencyMs })',
      ),
    })
    registerFactorySource(named, clientes, 'storage')
    expect(read(named, 'repositories/clientes/index.ts')).toContain(
      "if (options.dataSource === 'storage') return new StorageClientesRepository({ latencyMs: options.latencyMs })",
    )
  })

  it('recusa a fábrica que não se acha, sem return final, ou que já importa a fonte', () => {
    const missing = planWith({ 'src/a.ts': '' })
    expect(() => registerFactorySource(missing, clientes, 'http')).toThrow('falta src/repositories/clientes/index.ts')
    const other = planWith({ 'src/repositories/clientes/index.ts': FACTORY.replace('createClientesRepository', 'outra') })
    expect(() => registerFactorySource(other, clientes, 'http')).toThrow("não tem a função 'createClientesRepository'")
    const p = plan()
    registerFactorySource(p, clientes, 'http')
    expect(() => registerFactorySource(p, clientes, 'http')).toThrow("já importa './repository.http'")
  })
})

describe('registerContractSource', () => {
  const plan = () => planWith({ 'src/repositories/clientes/repository.contract.test.ts': CONTRACT_TEST })
  const file = 'repositories/clientes/repository.contract.test.ts'

  it('storage: o import e a chamada, que limpa a chave antes de cada repositório', () => {
    const p = plan()
    expect(registerContractSource(p, clientes, 'storage')).toBeUndefined()
    const text = read(p, file)
    expect(text).toContain("import { STORAGE_KEY, StorageClientesRepository } from './repository.storage'")
    expect(text).toContain(`runContractSuite(clientesContract, {
  name: 'StorageClientesRepository',
  create: () => {
    localStorage.removeItem(STORAGE_KEY)
    return new StorageClientesRepository({ latencyMs: 0 })
  },
})
`)
    expect(text.endsWith('})\n')).toBe(true)
  })

  it('http: pulado sem API_TEST_URL, com o motivo no título, e o describe entra no import do vitest', () => {
    const p = plan()
    expect(registerContractSource(p, clientes, 'http')).toBeUndefined()
    const text = read(p, file)
    expect(text).toContain("import { describe, expect, it } from 'vitest'")
    expect(text).toContain("import { createHttp } from '../http'")
    expect(text).toContain("import { HttpClientesRepository } from './repository.http'")
    expect(text).toContain('const apiTestUrl = process.env.API_TEST_URL')
    expect(text).toContain("describe.skipIf(!apiTestUrl)('HttpClientesRepository contra a API de teste (pulado: defina API_TEST_URL)'")
    expect(text).toContain('create: () => new HttpClientesRepository(createHttp({ baseUrl: apiTestUrl ?? \'\' })),')
    // os imports relativos ficam em ordem
    expect(text.indexOf("'../http'")).toBeLessThan(text.indexOf("'./repository.http'"))
    expect(text.indexOf("'./repository.http'")).toBeLessThan(text.indexOf("'./repository.mock'"))
  })

  it('devolve um aviso, sem lançar, quando o arquivo falta ou não tem o contrato', () => {
    expect(registerContractSource(planWith({ 'src/a.ts': '' }), clientes, 'http')).toContain(
      'falta src/repositories/clientes/repository.contract.test.ts',
    )
    const edited = planWith({
      'src/repositories/clientes/repository.contract.test.ts': CONTRACT_TEST.replaceAll('clientesContract', 'outro'),
    })
    expect(registerContractSource(edited, clientes, 'storage')).toContain("não tem o 'clientesContract'")
    expect(edited.summary().modified).toEqual([])
  })
})

describe('readDataSourceFromEnv', () => {
  const container = (call: string) =>
    `import { resolveDataSource } from 'x'\n\nexport function createRepositories(options: { dataSource?: string } = {}) {\n  const dataSource =\n    options.dataSource ?? ${call}\n  return dataSource\n}\n`
  const NEW = "resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')"

  it('troca a chamada do modelo antigo, mesmo quebrada em linhas', () => {
    const plan = planWith({
      'src/repositories/index.ts': container("resolveDataSource(\n      undefined,\n      DATA_SOURCES,\n      'mock',\n    )"),
    })
    expect(readDataSourceFromEnv(plan)).toBeUndefined()
    expect(read(plan, 'repositories/index.ts')).toContain(`options.dataSource ?? ${NEW}`)
  })

  it('não toca no container que já lê a variável', () => {
    const plan = planWith({ 'src/repositories/index.ts': container(NEW) })
    expect(readDataSourceFromEnv(plan)).toBeUndefined()
    expect(plan.summary().modified).toEqual([])
  })

  it('avisa, sem tocar, quando a chamada é outra ou o container falta', () => {
    const other = planWith({ 'src/repositories/index.ts': container("resolveDataSource(undefined, DATA_SOURCES, 'http')") })
    expect(readDataSourceFromEnv(other)).toContain('não lê a VITE_DATA_SOURCE')
    expect(other.summary().modified).toEqual([])
    expect(readDataSourceFromEnv(planWith({ 'src/a.ts': '' }))).toContain('não achei src/repositories/index.ts')
  })
})
