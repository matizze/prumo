import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineContractSuite, runContractSuite } from './contract.ts'

/** Um objeto de mentira, com campo privado: o `subject` do contrato precisa prender o `this`. */
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

let outsideSubject: Counter | undefined

const contract = defineContractSuite<Counter>('Counter', ({ subject, create }) => {
  outsideSubject = subject

  // Hook do caso: roda antes de a instância nascer
  beforeEach(() => {
    trace.hookRan = true
  })

  it('repassa os métodos e os getters para a instância do teste', () => {
    expect(subject.increment()).toBe(1)
    expect(subject.increment()).toBe(2)
    expect(subject.value).toBe(2)
    expect('increment' in subject).toBe(true)
    expect(subject.increment).toBe(subject.increment)
  })

  it('cria uma instância nova por teste, sem o estado do anterior', () => {
    expect(subject.value).toBe(0)
  })

  it('entrega outra instância, com o estado de partida, no create do contexto', () => {
    subject.increment()
    const other = create()
    expect(other).not.toBe(subject)
    expect(other.value).toBe(0)
  })
})

// Declarado antes de a suíte rodar: nenhum teste do contrato começou, então a instância não existe
describe('o subject do contrato', () => {
  it('recusa o uso fora de um teste, antes da criação', () => {
    expect(() => outsideSubject?.increment()).toThrow(/só existe dentro de um teste/)
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

/** O `subject` se usa como uma variável comum: spy, atribuição e reflexão valem para a instância do teste. */
type Extended = Counter & { extra?: number }

const extendable = defineContractSuite<Extended>('Proxy do subject', ({ subject }) => {
  it('vi.spyOn(subject, método) vê a chamada e troca o retorno, sem mexer no resto da instância', () => {
    const spy = vi.spyOn(subject, 'increment').mockReturnValue(42)

    expect(subject.increment()).toBe(42)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(vi.isMockFunction(spy)).toBe(true)
    spy.mockRestore()
    expect(subject.increment()).toBe(1)
    expect(subject.value).toBe(1)
  })

  it('o spy do teste anterior não vale para a instância nova', () => {
    expect(vi.isMockFunction(subject.increment)).toBe(false)
    expect(subject.increment()).toBe(1)
  })

  it('o spy chama o método de verdade, com o this da instância (campos privados)', () => {
    const spy = vi.spyOn(subject, 'increment')

    expect(subject.increment()).toBe(1)
    expect(subject.increment()).toBe(2)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveNthReturnedWith(2, 2)
  })

  it('a atribuição troca o método da instância e grava propriedade nova', () => {
    subject.increment = () => 99
    subject.extra = 7

    expect(subject.increment()).toBe(99)
    expect(subject.extra).toBe(7)
    expect('extra' in subject).toBe(true)
  })

  it('a atribuição do teste anterior não vale para a instância nova', () => {
    expect(subject.extra).toBeUndefined()
    expect('extra' in subject).toBe(false)
    expect(subject.increment()).toBe(1)
  })

  it('Object.defineProperty, delete, Object.keys e o descritor valem para a instância', () => {
    expect(Object.keys(subject)).toEqual([])

    Object.defineProperty(subject, 'extra', { value: 3, configurable: true, enumerable: true })
    expect(subject.extra).toBe(3)
    expect(Object.keys(subject)).toEqual(['extra'])
    expect(Object.getOwnPropertyDescriptor(subject, 'extra')).toMatchObject({
      value: 3,
      enumerable: true,
    })

    expect(delete subject.extra).toBe(true)
    expect(subject.extra).toBeUndefined()
    expect(Object.keys(subject)).toEqual([])
  })

  it('o protótipo é o da instância, então instanceof funciona', () => {
    expect(subject instanceof Counter).toBe(true)
    expect(Object.getPrototypeOf(subject)).toBe(Counter.prototype)
  })

  it('o mesmo método lido duas vezes é a mesma função', () => {
    expect(subject.increment).toBe(subject.increment)
  })

  it('recusa definir propriedade explicitamente não configurável: a referência vale para vários testes', () => {
    expect(() => Object.defineProperty(subject, 'fixa', { value: 1, configurable: false })).toThrow(
      /não configurável/,
    )
    // Sem dizer o contrário, a propriedade vai para a instância do teste, como em qualquer objeto
    Object.defineProperty(subject, 'solta', { value: 1 })
    expect((subject as Counter & { solta: number }).solta).toBe(1)
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

    expect(byImplementation('Notes: MapNotes')).toHaveLength(3)
    expect(byImplementation('Notes: MapNotes').map((t) => t.status)).toEqual([
      'passed',
      'passed',
      'passed',
    ])

    const broken = byImplementation('Notes: BrokenNotes')
    expect(broken).toHaveLength(3)
    // O defeito tem de ser acusado pelos casos que o tocam; o que não o toca segue passando
    expect(broken.filter((t) => t.status === 'failed').map((t) => t.fullName)).toEqual([
      'Notes: BrokenNotes guarda a nota e devolve pelo id',
      'Notes: BrokenNotes recusa um id que não existe',
    ])
    expect(status).toBe(1)
  }, 60_000)
})
