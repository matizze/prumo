import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { exec } from '../test-support.ts'
import { project, tsc, vitest } from './compile-test-support.ts'

/**
 * As queries geradas de verdade: o projeto temporário de `compile-test-support.ts` (com React e React
 * Query) recebe o schema, o repositório e as queries pelos comandos; o `tsc` estrito compila tudo
 * e um teste de hooks roda contra o mock.
 */
const TEMPLATES = path.resolve(import.meta.dirname, '../../templates')

/** O ponto de ligação do app: o provedor de repositórios (o modelo do `prumo new`) e um render só com ele. */
const RENDER = `import { QueryClient } from '@tanstack/react-query'
import { createRenderHookWithProviders, createTestQueryClient } from '@matizze/prumo-testing'
import type { ReactNode } from 'react'
import { RepositoryProvider } from '@/providers/repository'
import { createRepositories, type RepositoryContainer } from '@/repositories'

export const renderHookWithProviders = createRenderHookWithProviders<RepositoryContainer>({
  Providers: ({ children, repositories }: { children: ReactNode; repositories: RepositoryContainer }) => (
    <RepositoryProvider value={repositories}>{children}</RepositoryProvider>
  ),
  createRepositories: (overrides?: Partial<RepositoryContainer>) => ({
    ...createRepositories({ dataSource: 'mock', latencyMs: 0 }),
    ...overrides,
  }),
  createQueryClient: () => createTestQueryClient((options) => new QueryClient({ defaultOptions: options })),
})
`

// O Vitest procura essa marca no texto do arquivo todo: separada, ela só vale dentro do projeto gerado
const JSDOM = '// @vitest-' + 'environment jsdom'

const HOOKS_TEST = `${JSDOM}
import { act, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderHookWithProviders } from '@/test/render'
import {
  useClienteDetail,
  useClientesList,
  useCreateCliente,
  useRemoveCliente,
  useUpdateCliente,
} from '@/queries'
import { MOCK_CLIENTES } from '@/repositories/clientes/fixtures'

it('lista os clientes do mock', async () => {
  const { result } = renderHookWithProviders(() => useClientesList())
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.total).toBe(MOCK_CLIENTES.length)
})

it('a mutation de criar invalida a lista, que passa a ter o novo registro', async () => {
  const { result } = renderHookWithProviders(() => ({ list: useClientesList(), create: useCreateCliente() }))
  await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
  await act(async () => {
    await result.current.create.mutateAsync({ nome: 'Novo' })
  })
  await waitFor(() => expect(result.current.list.data?.total).toBe(MOCK_CLIENTES.length + 1))
  expect(result.current.list.data?.items.some((item) => item.nome === 'Novo')).toBe(true)
})

it('atualiza e remove: o detalhe muda, e o removido sai da lista sem buscar o detalhe', async () => {
  const id = MOCK_CLIENTES[0]!.id
  const { result } = renderHookWithProviders(() => ({
    list: useClientesList(),
    detail: useClienteDetail(id),
    update: useUpdateCliente(),
    remove: useRemoveCliente(),
  }))
  await waitFor(() => expect(result.current.detail.isSuccess).toBe(true))
  await act(async () => {
    await result.current.update.mutateAsync({ id, input: { nome: 'Editado' } })
  })
  await waitFor(() => expect(result.current.detail.data?.nome).toBe('Editado'))
  await act(async () => {
    await result.current.remove.mutateAsync(id)
  })
  await waitFor(() => expect(result.current.list.data?.total).toBe(MOCK_CLIENTES.length - 1))
  expect(result.current.detail.isError).toBe(false)
})
`

describe('as queries geradas compilam (tsc estrito) e funcionam com o mock', () => {
  it('compila e os hooks de lista e de mutation passam, pelo índice @/queries', async () => {
    const root = await project('nome:string', { react: true })
    const write = (file: string, content: string) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      writeFileSync(path.join(root, file), content)
    }
    write(
      'src/providers/repository/index.ts',
      readFileSync(path.join(TEMPLATES, 'app/src/providers/repository/index.ts.tpl'), 'utf8'),
    )
    write('src/queries/index.ts', readFileSync(path.join(TEMPLATES, 'app/src/queries-index.ts.tpl'), 'utf8'))
    write('src/test/render.tsx', RENDER)
    write('src/queries/clientes.hooks.test.tsx', HOOKS_TEST)
    for (const args of [['make:repository', 'clientes'], ['make:query', 'clientes']]) {
      const made = await exec(args, root)
      expect(made.code, `${made.stdout}${made.stderr}`).toBe(0)
    }
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root)
    expect(tests.status, tests.output).toBe(0)
    expect(tests.output).toMatch(/a mutation de criar invalida a lista/)
  }, 180_000)

  it('com campos de todos os tipos e a fonte storage no repositório', async () => {
    const fields =
      'titulo:string,ano:number,paginas:int,situacao:enum(lido|lendo),disponivel:boolean,publicadoEm:date,lidoEm?:datetime'
    const root = await project(fields, { react: true })
    const write = (file: string, content: string) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      writeFileSync(path.join(root, file), content)
    }
    write(
      'src/providers/repository/index.ts',
      readFileSync(path.join(TEMPLATES, 'app/src/providers/repository/index.ts.tpl'), 'utf8'),
    )
    write('src/queries/index.ts', readFileSync(path.join(TEMPLATES, 'app/src/queries-index.ts.tpl'), 'utf8'))
    for (const args of [
      ['make:repository', 'clientes', '--data-source', 'storage'],
      ['make:query', 'clientes'],
    ]) {
      const made = await exec(args, root)
      expect(made.code, `${made.stdout}${made.stderr}`).toBe(0)
    }
    expect(tsc(root)).toEqual({ status: 0, output: '' })
  }, 180_000)
})
