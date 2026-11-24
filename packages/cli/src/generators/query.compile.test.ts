import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { project, tsc, vitest, writeIn } from '../test/compile.ts'
import { exec } from '../test/run.ts'

/**
 * As queries geradas de verdade: o projeto temporário de `test/compile.ts` (o app que o `prumo new`
 * gera) recebe o schema, o repositório e as queries pelos comandos; o `tsc` estrito compila tudo
 * e um teste de hooks roda contra o mock.
 */
const HOOKS_TEST = `import { act, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderHookWithProviders } from '@/test/render'
import {
  clienteKeys,
  clienteQueries,
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

it('atualiza: o detalhe muda', async () => {
  const id = MOCK_CLIENTES[0]!.id
  const { result } = renderHookWithProviders(() => ({
    detail: useClienteDetail(id),
    update: useUpdateCliente(),
  }))
  await waitFor(() => expect(result.current.detail.isSuccess).toBe(true))
  await act(async () => {
    await result.current.update.mutateAsync({ id, input: { nome: 'Editado' } })
  })
  await waitFor(() => expect(result.current.detail.data?.nome).toBe('Editado'))
})

it('remove com o detalhe fora da tela: a lista atualiza e o get do removido não é chamado', async () => {
  const id = MOCK_CLIENTES[0]!.id
  const { result, repositories, queryClient } = renderHookWithProviders(() => ({
    list: useClientesList(),
    remove: useRemoveCliente(),
  }))
  const get = vi.spyOn(repositories.clientes, 'get')
  await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
  await queryClient.prefetchQuery(clienteQueries.detail(repositories.clientes, id))
  get.mockClear()
  await act(async () => {
    await result.current.remove.mutateAsync(id)
  })
  await waitFor(() => expect(result.current.list.data?.total).toBe(MOCK_CLIENTES.length - 1))
  expect(get).not.toHaveBeenCalled()
  expect(queryClient.getQueryData(clienteKeys.detail(id))).toBeUndefined()
})

it('remove com o detalhe ainda na tela: o detalhe busca de novo e termina em NOT_FOUND', async () => {
  const id = MOCK_CLIENTES[0]!.id
  const { result } = renderHookWithProviders(() => ({
    detail: useClienteDetail(id),
    remove: useRemoveCliente(),
  }))
  await waitFor(() => expect(result.current.detail.isSuccess).toBe(true))
  await act(async () => {
    await result.current.remove.mutateAsync(id)
  })
  await waitFor(() => expect(result.current.detail.isError).toBe(true))
  expect(result.current.detail.error).toMatchObject({ code: 'CLIENTE_NOT_FOUND' })
})
`

const ALL_TYPES =
  'titulo:string,ano:number,paginas:int,situacao:enum(lido|lendo),disponivel:boolean,publicadoEm:date,lidoEm?:datetime'

/**
 * Os três casos dividem um projeto, cada um com o seu domínio: `clientes` (com o teste de hooks),
 * `livros` (schema editado depois do repositório) e `filmes` (campos de todos os tipos, em storage).
 * O `tsc` e o `vitest` rodam uma vez.
 */
describe('as queries geradas compilam (tsc estrito) e funcionam com o mock', () => {
  let root: string
  let compiled: ReturnType<typeof tsc>
  let tests: ReturnType<typeof vitest>

  const run = async (...args: string[]) => {
    const made = await exec(args, root)
    expect(made.code, `${args.join(' ')}\n${made.stdout}${made.stderr}`).toBe(0)
  }

  beforeAll(async () => {
    root = await project('nome:string')
    writeIn(root, 'src/queries/clientes.hooks.test.tsx', HOOKS_TEST)
    await run('make:repository', 'clientes')
    await run('make:query', 'clientes')

    await run('make:schema', 'livros', '--fields', 'nome:string')
    await run('make:repository', 'livros')
    const schema = path.join(root, 'src/schemas/entities/livro.ts')
    writeFileSync(
      schema,
      readFileSync(schema, 'utf8').replace(
        '  createdAt: z.string(),',
        '  tags: z.array(z.string()).optional(),\n  email: z.string().email().nullable().optional(),\n  createdAt: z.string(),',
      ),
    )
    await run('make:query', 'livros')

    await run('make:schema', 'filmes', '--fields', ALL_TYPES)
    await run('make:repository', 'filmes', '--data-source', 'storage')
    await run('make:query', 'filmes')

    compiled = tsc(root)
    tests = vitest(root, {}, ['src/queries'])
  }, 240_000)

  it('compila e os hooks de lista e de mutation passam, pelo índice @/queries', () => {
    expect(compiled).toEqual({ status: 0, output: '' })
    expect(tests.status, tests.output).toBe(0)
    expect(tests.output).toMatch(/a mutation de criar invalida a lista/)
  })

  it('com o schema editado depois do repositório (array, email, nullable): sai com 0 e compila', () => {
    expect(readFileSync(path.join(root, 'src/queries/livros.ts'), 'utf8')).toContain('useLivrosList')
    expect(compiled).toEqual({ status: 0, output: '' })
  })

  it('com campos de todos os tipos e a fonte storage no repositório', () => {
    expect(readFileSync(path.join(root, 'src/queries/filmes.ts'), 'utf8')).toContain('useFilmesList')
    expect(compiled).toEqual({ status: 0, output: '' })
  })
})
