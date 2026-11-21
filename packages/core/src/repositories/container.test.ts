import { describe, expect, it, vi } from 'vitest'
import { createRepositoryContainer, resolveDataSource, type RepositoryOptions } from './index.ts'

const SOURCES = ['memory', 'indexeddb'] as const

describe('createRepositoryContainer', () => {
  it('chama cada fábrica com as mesmas opções e guarda o resultado sob o nome do domínio', () => {
    const createTasks = vi.fn((options: RepositoryOptions<'memory' | 'indexeddb'>) => ({
      kind: 'tasks',
      source: options.dataSource,
    }))
    const createAuth = vi.fn(({ latencyMs }: RepositoryOptions<'memory' | 'indexeddb'>) => ({
      kind: 'auth',
      latencyMs,
    }))
    const options = { dataSource: 'indexeddb', latencyMs: 0 } as const

    const container = createRepositoryContainer({ tasks: createTasks, auth: createAuth }, options)

    expect(container).toEqual({
      tasks: { kind: 'tasks', source: 'indexeddb' },
      auth: { kind: 'auth', latencyMs: 0 },
    })
    expect(createTasks).toHaveBeenCalledExactlyOnceWith(options)
    expect(createAuth).toHaveBeenCalledExactlyOnceWith(options)
  })

  it('tipa o container com o que cada fábrica devolve', () => {
    const container = createRepositoryContainer(
      { count: () => 3, label: () => 'x' },
      { dataSource: 'memory' },
    )

    // Se o tipo do container se perdesse, estas linhas deixariam de compilar (o typecheck cobre)
    const count: number = container.count
    const label: string = container.label
    expect([count, label]).toEqual([3, 'x'])
  })
})

describe('resolveDataSource', () => {
  it.each([undefined, ''])('usa o fallback quando o valor é %j', (value) => {
    expect(resolveDataSource(value, SOURCES, 'memory')).toBe('memory')
  })

  it.each(SOURCES)('aceita a fonte %s', (source) => {
    expect(resolveDataSource(source, SOURCES, 'memory')).toBe(source)
  })

  it('lança em vez de cair em outra fonte quando o valor é inválido', () => {
    expect(() => resolveDataSource('foo', SOURCES, 'memory')).toThrow(
      'Invalid dataSource "foo". Expected one of: memory, indexeddb.',
    )
  })

  it('usa o nome da configuração na mensagem de erro', () => {
    expect(() => resolveDataSource('foo', SOURCES, 'memory', 'VITE_DATA_SOURCE')).toThrow(
      'Invalid VITE_DATA_SOURCE "foo". Expected one of: memory, indexeddb.',
    )
  })
})
