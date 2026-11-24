import { afterEach, beforeEach, describe } from 'vitest'

/**
 * Teste de contrato: o mesmo conjunto de casos roda contra qualquer implementação de uma
 * interface (um repositório, um use case): o mock de um use case e a API real, por exemplo. O
 * contrato é o que o produto espera da interface, não o que uma implementação faz.
 *
 * ```ts
 * const signInContract = defineContractSuite<IUseCase<SignInInput, SignInOutput>>(
 *   'SignInUseCase contract',
 *   ({ repo: signIn }) => {
 *     it('devolve o token', async () => {
 *       const { token } = await signIn.execute({ email: 'ana@x.com', password: '12345678' })
 *       expect(token).not.toBe('')
 *     })
 *   },
 * )
 *
 * // O mesmo contrato contra o `http` de mentira e, com API_TEST_URL, contra a API real
 * runContractSuite(signInContract, {
 *   name: 'mock',
 *   create: () => new SignInUseCase(createMockHttp(signInRoutes)),
 * })
 * ```
 *
 * O parâmetro de contexto se chama `repo` por histórico: com use cases, renomeie-o na
 * desestruturação (`({ repo: signIn })`).
 *
 * **Os dados.** Os casos que dependem dos dados do mock (as fixtures: "lista as 18 linhas")
 * só valem para uma implementação que parte dos mesmos dados. Quem adiciona outra implementação
 * a semeia com as mesmas fixtures no `create`, ou deixa os casos de dados fora do contrato dela.
 */

/** Uma implementação (de um repositório ou de um use case) contra a qual o contrato roda. */
export interface ContractImplementation<R extends object> {
  /** O nome da implementação, que entra no título do `describe` (`MockTaskRepository`, `SignInUseCase (mock)`). */
  name: string
  /**
   * Cria uma instância nova, com o estado de partida. O contrato chama uma vez por teste e a cada
   * `create` do contexto, então nenhuma instância herda estado de outra.
   */
  create: () => R
  /**
   * Libera o que as instâncias do teste deixaram (um banco, um arquivo). Roda uma vez depois de
   * cada teste, também quando ele falha. Quem cria mais de um recurso por teste os registra no
   * `create` e os libera aqui.
   */
  dispose?: () => void | Promise<void>
}

/** O que cada caso do contrato recebe. */
export interface ContractContext<R extends object> {
  /**
   * A instância do teste em andamento (o repositório ou o use case): uma instância nova, criada antes dele. É uma referência
   * estável que repassa para a instância do teste atual, então vale ler `repo` fora do `it` (em
   * uma função auxiliar, por exemplo), mas só chamar métodos dentro de um teste ou de um hook.
   */
  repo: R
  /** Cria uma instância a mais, com o estado de partida: para testes com dois repositórios. */
  create: () => R
}

/** Os casos de um contrato, ainda sem implementação. */
export interface ContractSuite<R extends object> {
  readonly name: string
  readonly cases: (context: ContractContext<R>) => void
}

/**
 * Declara o contrato de um repositório ou de um use case. `cases` registra os `it` e `describe`
 * do Vitest e recebe o acesso à instância de cada teste. Os `beforeEach` e `afterEach` de `cases`
 * (um relógio falso, por exemplo) rodam antes da criação do repositório, e os `afterEach` depois
 * da limpeza dele.
 *
 * @param name o nome do contrato (`IBillingRepository contract`, `SignInUseCase contract`); o título do `describe` é
 * `<name>: <nome da implementação>`.
 */
export function defineContractSuite<R extends object>(
  name: string,
  cases: (context: ContractContext<R>) => void,
): ContractSuite<R> {
  return { name, cases }
}

/**
 * Roda o contrato contra uma implementação: um `describe` com uma instância nova por teste
 * e o `dispose` no fim de cada um. Chame uma vez por implementação.
 */
export function runContractSuite<R extends object>(
  suite: ContractSuite<R>,
  implementation: ContractImplementation<R>,
): void {
  describe(`${suite.name}: ${implementation.name}`, () => {
    let current: R | undefined

    suite.cases({
      repo: currentInstance(
        () => current,
        `${suite.name}: o repositório só existe dentro de um teste ou de um hook, depois da criação.`,
      ),
      create: implementation.create,
    })

    // Depois dos hooks dos casos: eles preparam o ambiente antes de a instância nascer
    beforeEach(() => {
      current = implementation.create()
    })

    afterEach(async () => {
      await implementation.dispose?.()
    })
  })
}

/** Um método de um repositório, de qualquer assinatura. */
type AnyMethod = (...args: unknown[]) => unknown

/**
 * Uma referência fixa para a instância do teste em andamento: um proxy que repassa tudo para ela,
 * então o `repo` se usa como uma variável comum (`vi.spyOn(repo, 'list')`, atribuição,
 * `Object.keys`, `instanceof`). O estado que o teste grava fica na instância, e o teste seguinte,
 * com instância nova, não o vê.
 *
 * Os métodos saem presos à instância (`this` do repositório, não do proxy), para campos privados e
 * métodos soltos funcionarem; a função presa é sempre a mesma enquanto a instância é a mesma
 * (`repo.list === repo.list`). Um spy de `vi.spyOn(repo, ...)` é o que o `spyOn` devolve, e não o
 * que se lê de `repo.<método>` depois.
 */
function currentInstance<R extends object>(get: () => R | undefined, outsideMessage: string): R {
  const instance = (): R => {
    const value = get()
    if (value === undefined) throw new Error(outsideMessage)
    return value
  }
  // Uma função presa por instância e por função original, para a identidade ser estável
  const bound = new WeakMap<object, WeakMap<AnyMethod, AnyMethod>>()
  const boundTo = (target: R, method: AnyMethod): AnyMethod => {
    const methods = bound.get(target) ?? new WeakMap<AnyMethod, AnyMethod>()
    bound.set(target, methods)
    const existing = methods.get(method)
    if (existing) return existing
    const created = method.bind(target)
    methods.set(method, created)
    return created
  }

  return new Proxy({} as R, {
    get(_target, property) {
      const target = instance()
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function' ? boundTo(target, value as AnyMethod) : value
    },
    set(_target, property, value) {
      const target = instance()
      return Reflect.set(target, property, value, target)
    },
    has: (_target, property) => Reflect.has(instance(), property),
    deleteProperty: (_target, property) => Reflect.deleteProperty(instance(), property),
    defineProperty(_target, property, descriptor) {
      // O alvo do proxy é um objeto vazio e fixo: ele só aceita propriedade que continua configurável
      if (descriptor.configurable === false) {
        throw new TypeError(
          `${outsideMessage.split(':')[0]}: a propriedade '${String(property)}' não pode ser não configurável, porque o repo é uma referência para a instância de cada teste.`,
        )
      }
      return Reflect.defineProperty(instance(), property, descriptor)
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(instance(), property)
      // O proxy não pode relatar uma propriedade fixa que o alvo vazio dele não tem
      return descriptor && { ...descriptor, configurable: true }
    },
    ownKeys: () => Reflect.ownKeys(instance()),
    getPrototypeOf: () => Reflect.getPrototypeOf(instance()),
  })
}
