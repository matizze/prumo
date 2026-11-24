import { Project, ts } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import {
  assertNotReserved,
  assertValidName,
  deriveNames,
  domainNames,
  entityFlag,
  GLOBAL_NAMES,
  isValidName,
  pageNames,
  RESERVED_WORDS,
  singularOf,
  usableNames,
  useCaseNames,
} from './names.ts'

describe('isValidName', () => {
  it.each(['produtos', 'pedidos-recentes', 'error-404', 'a', 'tela2', 'ai-settings-general'])(
    'aceita %s',
    (name) => expect(isValidName(name)).toBe(true),
  )

  it.each([
    '',
    'Produtos',
    'pedidosRecentes',
    'pedidos_recentes',
    '2fa',
    '-produtos',
    'produtos-',
    'pedidos--recentes',
    'pedidos recentes',
    'pedidos/recentes',
    'pedidos.recentes',
    'ações',
  ])('recusa %j', (name) => expect(isValidName(name)).toBe(false))
})

describe('assertValidName', () => {
  it('lança um UsageError (saída 2) que diz o que foi recusado e a regra', () => {
    expect(() => assertValidName('Pedidos', 'o nome da tela')).toThrow(UsageError)
    expect(() => assertValidName('Pedidos', 'o nome da tela')).toThrow(
      /o nome da tela 'Pedidos' é inválido: use kebab-case/,
    )
    expect(() => assertValidName('ok')).not.toThrow()
  })
})

describe('deriveNames', () => {
  it('deriva Pascal e camel do kebab', () => {
    expect(deriveNames('pedidos-recentes')).toEqual({
      kebab: 'pedidos-recentes',
      pascal: 'PedidosRecentes',
      camel: 'pedidosRecentes',
    })
    expect(deriveNames('produtos')).toEqual({
      kebab: 'produtos',
      pascal: 'Produtos',
      camel: 'produtos',
    })
  })

  it('mantém os números como no app (error-404 vira Error404 e error404)', () => {
    expect(deriveNames('error-404')).toMatchObject({ pascal: 'Error404', camel: 'error404' })
    expect(deriveNames('ai-settings-general')).toMatchObject({ camel: 'aiSettingsGeneral' })
  })

  it('recusa nome inválido', () => {
    expect(() => deriveNames('Produtos')).toThrow(UsageError)
  })
})

describe('palavras reservadas', () => {
  it('a lista tem as palavras do JavaScript, as estritas e as que o modo estrito proíbe', () => {
    for (const word of [
      'new',
      'default',
      'class',
      'delete',
      'let',
      'static',
      'implements',
      'interface',
      'package',
      'private',
      'protected',
      'public',
      'yield',
      'await',
      'enum',
      'null',
      'true',
      'false',
      'eval',
      'arguments',
      'undefined',
    ]) {
      expect(RESERVED_WORDS.has(word), word).toBe(true)
    }
  })

  it('não tem palavra contextual, que serve de identificador (type, from, of, async, get, set)', () => {
    for (const word of ['type', 'from', 'of', 'as', 'async', 'get', 'set', 'name', 'status']) {
      expect(RESERVED_WORDS.has(word), word).toBe(false)
    }
  })

  /**
   * Se o TypeScript aceita o que o `make:page` escreve no índice de mensagens: o
   * `import <nome> from './<nome>.json'` e a chave `<nome>,` do objeto exportado. Os erros de
   * módulo e de tipos globais que faltam (a lib não é carregada) não contam.
   */
  function indexParses(name: string): boolean {
    const project = new Project({
      useInMemoryFileSystem: true,
      skipLoadingLibFiles: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
    })
    const file = project.createSourceFile(
      'index.ts',
      `import ${name} from './${name}.json'\nexport default { ${name} }\n`,
    )
    const ignored = new Set([2307, 2318, 6053])
    return file.getPreEmitDiagnostics().every((diagnostic) => ignored.has(diagnostic.getCode()))
  }

  it('cada palavra da lista quebra o índice de mensagens, e as contextuais não', () => {
    // `eval`, `arguments` e `undefined` são proibidos pelo modo estrito, mas não pelo verificador
    const checked = [...RESERVED_WORDS].filter(
      (word) => !['eval', 'arguments', 'undefined'].includes(word),
    )
    for (const word of checked) expect(indexParses(word), word).toBe(false)
    for (const word of ['type', 'from', 'of', 'as', 'async', 'get', 'set', 'name', 'status']) {
      expect(indexParses(word), word).toBe(true)
    }
  })

  it('usableNames recusa o camel reservado, com a mensagem em português e o nome derivado', () => {
    expect(() => usableNames('new', 'o nome da tela')).toThrow(UsageError)
    expect(() => usableNames('new', 'o nome da tela')).toThrow(
      /o nome da tela 'new' vira o identificador 'new', que é palavra reservada do JavaScript.*escolha outro nome/,
    )
    expect(usableNames('novo', 'o nome da tela')).toEqual(deriveNames('novo'))
    // O nome inválido continua com a mensagem de kebab-case
    expect(() => usableNames('Class', 'o nome da tela')).toThrow(/é inválido: use kebab-case/)
  })

  it('o hífen e os números já tiram o nome da lista: `new-item` e `class2` servem', () => {
    expect(usableNames('new-item', 'o nome da tela').camel).toBe('newItem')
    expect(usableNames('class2', 'o nome da tela').camel).toBe('class2')
  })

  it('o Pascal global só conta onde o nome é usado sozinho (globals)', () => {
    expect(() => assertNotReserved(deriveNames('date'), 'o nome', { globals: true })).toThrow(
      /vira o identificador 'Date', que é um nome global/,
    )
    // Numa tela, `Date` vira `DatePage`, `useDateModel`...: não esconde nada
    expect(() => assertNotReserved(deriveNames('date'), 'o nome da tela')).not.toThrow()
    expect(GLOBAL_NAMES.has('Record')).toBe(true)
    expect(GLOBAL_NAMES.has('Customer')).toBe(false)
  })
})

describe('singularOf', () => {
  it('tira o s final, em inglês e em português', () => {
    expect(singularOf('suppliers')).toBe('supplier')
    expect(singularOf('customers')).toBe('customer')
    expect(singularOf('pedidos')).toBe('pedido')
    expect(singularOf('order-items')).toBe('order-item')
  })

  it('não adivinha o que não termina em s e pede o singular explícito', () => {
    expect(() => singularOf('inventory')).toThrow(/--entity/)
    expect(() => singularOf('s')).toThrow(UsageError)
  })

  it.each([
    ['categories', 'category'],
    ['companies', 'company'],
    ['classes', 'class'],
    ['boxes', 'box'],
    ['matches', 'match'],
    ['wishes', 'wish'],
  ])('recusa %s e sugere --entity %s, em vez de derivar um singular errado', (plural, entity) => {
    expect(() => singularOf(plural)).toThrow(UsageError)
    expect(() => singularOf(plural)).toThrow(new RegExp(`--entity ${entity}\\b`))
    expect(() => singularOf(plural)).toThrow(`'${plural.slice(0, -1)}'`)
  })

  it.each(['status', 'campus', 'address', 'access'])(
    'recusa %s, que já parece singular, sem sugerir um palpite',
    (plural) => {
      expect(() => singularOf(plural)).toThrow(UsageError)
      expect(() => singularOf(plural)).toThrow(/já estar no singular.*--entity/)
      expect(() => singularOf(plural)).not.toThrow(/provavelmente/)
    },
  )

  it.each(['items', 'orders', 'pedidos', 'purchase-orders', 'users', 'taxes-rates', 'aliases'])(
    'não incomoda o plural comum: %s',
    (plural) => {
      // `taxes-rates` termina em `rates` e `aliases` em `ases`: nada da lista de suspeitos
      expect(singularOf(plural)).toBe(plural.slice(0, -1))
    },
  )
})

describe('singularOf, a regra do s final', () => {
  it.each([
    ['screens', 'screen'],
    ['cores', 'core'],
    ['herois', 'heroi'],
    ['maes', 'mae'],
    ['paes', 'pae'],
    ['fornecedores', 'fornecedore'],
    ['clientes', 'cliente'],
    ['livros', 'livro'],
    ['pedidos-itens', 'pedidos-iten'],
  ])('%s vira %s (só tira o s; o --entity corrige o resto)', (plural, singular) => {
    expect(singularOf(plural)).toBe(singular)
  })

  it('entityFlag só traz o --entity quando a entidade difere da derivada', () => {
    expect(entityFlag(domainNames('paes'))).toBe('')
    expect(entityFlag(domainNames('paes', 'pao'))).toBe(' --entity pao')
    expect(entityFlag(domainNames('categories', 'category'))).toBe(' --entity category')
    expect(entityFlag(domainNames('clientes', 'cli'))).toBe(' --entity cli')
  })
})

describe('domainNames', () => {
  it('deriva o singular do plural', () => {
    const names = domainNames('suppliers')
    expect(names.plural).toEqual({ kebab: 'suppliers', pascal: 'Suppliers', camel: 'suppliers' })
    expect(names.singular).toEqual({ kebab: 'supplier', pascal: 'Supplier', camel: 'supplier' })
  })

  it('aceita um singular explícito para o que a regra erra', () => {
    expect(domainNames('categories', 'category').singular.pascal).toBe('Category')
    expect(domainNames('inventory', 'product').singular.camel).toBe('product')
  })

  it('recusa singular inválido ou igual ao plural', () => {
    expect(() => domainNames('suppliers', 'Supplier')).toThrow(/a entidade 'Supplier' é inválido/)
    expect(() => domainNames('status', 'status')).toThrow(/igual ao nome do domínio/)
    expect(() => domainNames('Suppliers')).toThrow(/o nome do domínio/)
  })
})

describe('nomes reservados do domínio', () => {
  it('domainNames recusa singular ou plural reservado ou global', () => {
    expect(() => domainNames('classes', 'class')).toThrow(
      /a entidade 'class' vira o identificador 'class', que é palavra reservada/,
    )
    expect(() => domainNames('records', 'record')).toThrow(
      /a entidade 'record' vira o identificador 'Record', que é um nome global/,
    )
    expect(() => domainNames('dates', 'date')).toThrow(/'Date'/)
    expect(() => domainNames('new', 'new-item')).toThrow(/o nome do domínio 'new'.*reservada/)
    expect(() => domainNames('maps', 'map')).toThrow(/'Map'/)
  })
})

describe('pageNames', () => {
  it('um nome só é uma tela de primeiro nível', () => {
    expect(pageNames('clientes')).toEqual({
      kebab: 'clientes',
      pascal: 'Clientes',
      camel: 'clientes',
      path: 'clientes',
    })
  })

  it.each(['auth.login', 'auth/login'])('%s vira a pasta auth/login e os nomes juntos', (input) => {
    expect(pageNames(input)).toEqual({
      kebab: 'auth-login',
      pascal: 'AuthLogin',
      camel: 'authLogin',
      path: 'auth/login',
    })
  })

  it('aceita mais de dois segmentos e dígitos', () => {
    expect(pageNames('admin.fases-2.novo')).toMatchObject({
      kebab: 'admin-fases-2-novo',
      path: 'admin/fases-2/novo',
    })
  })

  it.each(['auth..login', '/login', 'auth/', 'auth./login', '.', ''])(
    'recusa o segmento vazio de %j',
    (input) => expect(() => pageNames(input)).toThrow(/segmento vazio/),
  )

  it('a palavra reservada só vale para o nome junto: auth.new e clientes.delete passam', () => {
    expect(pageNames('auth.new').pascal).toBe('AuthNew')
    expect(pageNames('clientes/delete').camel).toBe('clientesDelete')
  })

  it('diz qual segmento é inválido ou reservado', () => {
    expect(() => pageNames('auth.Login')).toThrow(/segmento do nome da tela 'Login' é inválido/)
    expect(() => pageNames('new')).toThrow(/o nome da tela 'new'.*reservada/)
    expect(() => pageNames('Auth')).toThrow(/o nome da tela 'Auth' é inválido/)
    expect(() => pageNames('auth.2fa')).toThrow(UsageError)
  })
})

describe('useCaseNames', () => {
  it.each(['auth.sign-in', 'auth/sign-in'])('%s vira o domínio auth e a ação sign-in', (input) => {
    expect(useCaseNames(input)).toEqual({
      domain: { kebab: 'auth', pascal: 'Auth', camel: 'auth' },
      action: { kebab: 'sign-in', pascal: 'SignIn', camel: 'signIn' },
    })
  })

  it('exige o domínio e a ação, e só os dois', () => {
    for (const input of ['stores', 'a.b.c', 'a/b.c']) {
      expect(() => useCaseNames(input)).toThrow(/precisa ter o domínio e a ação, como em auth\.sign-in/)
    }
  })

  it('recusa segmento vazio e nome fora do kebab-case', () => {
    expect(() => useCaseNames('auth.')).toThrow(/o nome do use case 'auth\.' tem um segmento vazio/)
    expect(() => useCaseNames('Auth.sign-in')).toThrow(/um segmento do nome do use case 'Auth' é inválido/)
  })

  it('recusa a ação que vira palavra reservada, e aceita o domínio com o nome dela', () => {
    expect(() => useCaseNames('auth.delete')).toThrow(/a ação 'delete' vira o identificador 'delete'/)
    expect(useCaseNames('delete.remove').domain.camel).toBe('delete')
  })
})
