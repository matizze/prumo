import { Project, ts } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import {
  assertNotReserved,
  assertValidName,
  deriveNames,
  GLOBAL_NAMES,
  isValidName,
  RESERVED_WORDS,
  usableNames,
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
