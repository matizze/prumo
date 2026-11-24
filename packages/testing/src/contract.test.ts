import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineContractSuite, runContractSuite } from './contract.ts'

/** Um repositório de mentira, com campo privado: o `repo` do contrato precisa prender o `this`. */
class Counter {
  #value = 0

  increment() {
    this.#value += 1
    return this.#value
  }

  get value() {
    return this.#value
  }
}

const trace = {
  /** O valor de `hookRan` quando cada instância nasceu. */
  hookSeenAtCreate: [] as boolean[],
  hookRan: false,
  created: 0,
  disposed: 0,
}

let outsideRepo: Counter | undefined

const contract = defineContractSuite<Counter>('Counter', ({ repo, subject, create }) => {
  outsideRepo = repo

  // Hook do caso: roda antes de a instância nascer
  beforeEach(() => {
    trace.hookRan = true
  })

  it('repassa os métodos e os getters para a instância do teste', () => {
    expect(repo.increment()).toBe(1)
    expect(repo.increment()).toBe(2)
    expect(repo.value).toBe(2)
    expect('increment' in repo).toBe(true)
    // subject é o mesmo objeto que repo (o nome antigo), a mesma instância do teste
    expect(subject.value).toBe(2)
    expect(subject.increment).toBe(repo.increment)
  })

  it('cria uma instância nova por teste, sem o estado do anterior', () => {
    expect(repo.value).toBe(0)
  })

  it('entrega outra instância, com o estado de partida, no create do contexto', () => {
    repo.increment()
    const other = create()
    expect(other).not.toBe(repo)
    expect(other.value).toBe(0)
  })
})

// Declarado antes de a suíte rodar: nenhum teste do contrato começou, então a instância não existe
describe('o repo do contrato', () => {
  it('recusa o uso fora de um teste, antes da criação', () => {
    expect(() => outsideRepo?.increment()).toThrow(/só existe dentro de um teste/)
  })
})

runContractSuite(contract, {
  name: 'Memória',
  create: () => {
    trace.created += 1
    trace.hookSeenAtCreate.push(trace.hookRan)
    return new Counter()
  },
  dispose: () => {
    trace.disposed += 1
  },
})

// Os testes abaixo rodam depois dos três do contrato (o Vitest roda o arquivo em ordem)
describe('runContractSuite', () => {
  it('chama o dispose uma vez depois de cada teste', () => {
    expect(trace.disposed).toBe(3)
  })

  it('cria uma instância por teste mais as do create do contexto, depois dos hooks do caso', () => {
    // 3 testes + 1 `create()` do terceiro
    expect(trace.created).toBe(4)
    expect(trace.hookSeenAtCreate.every(Boolean)).toBe(true)
  })
})

/** O `repo` se usa como uma variável comum: spy, atribuição e reflexão valem para a instância do teste. */
type Extended = Counter & { extra?: number }

const extendable = defineContractSuite<Extended>('Proxy do repo', ({ repo }) => {
  it('vi.spyOn(repo, método) vê a chamada e troca o retorno, sem mexer no resto da instância', () => {
    const spy = vi.spyOn(repo, 'increment').mockReturnValue(42)

    expect(repo.increment()).toBe(42)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(vi.isMockFunction(spy)).toBe(true)
    spy.mockRestore()
    expect(repo.increment()).toBe(1)
    expect(repo.value).toBe(1)
  })

  it('o spy do teste anterior não vale para a instância nova', () => {
    expect(vi.isMockFunction(repo.increment)).toBe(false)
    expect(repo.increment()).toBe(1)
  })

  it('o spy chama o método de verdade, com o this da instância (campos privados)', () => {
    const spy = vi.spyOn(repo, 'increment')

    expect(repo.increment()).toBe(1)
    expect(repo.increment()).toBe(2)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveNthReturnedWith(2, 2)
  })

  it('a atribuição troca o método da instância e grava propriedade nova', () => {
    repo.increment = () => 99
    repo.extra = 7

    expect(repo.increment()).toBe(99)
    expect(repo.extra).toBe(7)
    expect('extra' in repo).toBe(true)
  })

  it('a atribuição do teste anterior não vale para a instância nova', () => {
    expect(repo.extra).toBeUndefined()
    expect('extra' in repo).toBe(false)
    expect(repo.increment()).toBe(1)
  })

  it('Object.defineProperty, delete, Object.keys e o descritor valem para a instância', () => {
    expect(Object.keys(repo)).toEqual([])

    Object.defineProperty(repo, 'extra', { value: 3, configurable: true, enumerable: true })
    expect(repo.extra).toBe(3)
    expect(Object.keys(repo)).toEqual(['extra'])
    expect(Object.getOwnPropertyDescriptor(repo, 'extra')).toMatchObject({
      value: 3,
      enumerable: true,
    })

    expect(delete repo.extra).toBe(true)
    expect(repo.extra).toBeUndefined()
    expect(Object.keys(repo)).toEqual([])
  })

  it('o protótipo é o da instância, então instanceof funciona', () => {
    expect(repo instanceof Counter).toBe(true)
    expect(Object.getPrototypeOf(repo)).toBe(Counter.prototype)
  })

  it('o mesmo método lido duas vezes é a mesma função', () => {
    expect(repo.increment).toBe(repo.increment)
  })

  it('recusa definir propriedade explicitamente não configurável: a referência vale para vários testes', () => {
    expect(() => Object.defineProperty(repo, 'fixa', { value: 1, configurable: false })).toThrow(
      /não configurável/,
    )
    // Sem dizer o contrário, a propriedade vai para a instância do teste, como em qualquer objeto
    Object.defineProperty(repo, 'solta', { value: 1 })
    expect((repo as Counter & { solta: number }).solta).toBe(1)
  })
})

runContractSuite(extendable, { name: 'Contador', create: () => new Counter() })

interface JsonReport {
  testResults: { assertionResults: { fullName: string; status: string }[] }[]
}

describe('o mesmo contrato contra duas implementações', () => {
  // Roda o contrato num Vitest filho, a partir do fixture, para ver uma implementação falhar
  // sem derrubar este arquivo. Tira do ambiente o que o Vitest pai deixa para os workers.
  function runFixture() {
    const require = createRequire(import.meta.url)
    const vitestBin = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
    const root = path.join(import.meta.dirname, '__fixtures__', 'contract')
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith('VITEST')),
    )
    const outputDir = mkdtempSync(path.join(tmpdir(), 'prumo-contract-'))
    const outputFile = path.join(outputDir, 'report.json')
    const result = spawnSync(
      process.execPath,
      [
        vitestBin,
        'run',
        '--root',
        root,
        '--config',
        path.join(root, 'vitest.config.ts'),
        '--reporter=json',
        `--outputFile=${outputFile}`,
      ],
      { encoding: 'utf8', env: { ...env, CI: '1' } },
    )
    const report = JSON.parse(readFileSync(outputFile, 'utf8')) as JsonReport
    rmSync(outputDir, { recursive: true, force: true })
    return {
      status: result.status,
      tests: report.testResults.flatMap((file) => file.assertionResults),
    }
  }

  it('passa na implementação certa e falha na que tem defeito', () => {
    const { status, tests } = runFixture()
    const byImplementation = (name: string) => tests.filter((t) => t.fullName.includes(name))

    expect(byImplementation('NotesRepository: MapNotesRepository')).toHaveLength(3)
    expect(byImplementation('NotesRepository: MapNotesRepository').map((t) => t.status)).toEqual([
      'passed',
      'passed',
      'passed',
    ])

    const broken = byImplementation('NotesRepository: BrokenNotesRepository')
    expect(broken).toHaveLength(3)
    // O defeito tem de ser acusado pelos casos que o tocam; o que não o toca segue passando
    expect(broken.filter((t) => t.status === 'failed').map((t) => t.fullName)).toEqual([
      'NotesRepository: BrokenNotesRepository guarda a nota e devolve pelo id',
      'NotesRepository: BrokenNotesRepository recusa um id que não existe',
    ])
    expect(status).toBe(1)
  }, 60_000)
})
