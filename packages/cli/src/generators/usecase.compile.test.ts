import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { project, tsc, vitest, writeIn } from '../test/compile.ts'
import { exec } from '../test/run.ts'

/**
 * Os use cases gerados de verdade: o projeto temporário (`test/compile.ts`) recebe o schema `clientes`
 * e os use cases (do `make:usecase`), e o `tsc` e o Vitest rodam nele, contra o mock.
 */

async function generate(root: string, ...args: string[]): Promise<void> {
  const result = await exec(['make:usecase', ...args], root)
  expect(result.code, `${result.stdout}${result.stderr}`).toBe(0)
}

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

describe('os use cases gerados compilam (tsc estrito) e passam nos testes', () => {
  let root: string
  let compiled: ReturnType<typeof tsc>
  let tests: ReturnType<typeof vitest>

  beforeAll(async () => {
    root = await project('nome:string,idade:int')
    await generate(root, 'clientes.get-clientes', '--output', 'cliente[]')
    await generate(root, 'clientes.get-cliente', '--endpoint', 'GET /clientes/:id', '--input', 'id:string', '--output', 'cliente')
    await generate(
      root,
      'clientes.update-cliente',
      '--endpoint',
      'PATCH /clientes/:id',
      '--input',
      'id:string,nome?:string',
      '--output',
      'cliente',
    )
    await generate(root, 'auth.sign-in', '--input', 'email:string,password:string', '--output', 'token:string')
    await generate(root, 'auth.sign-out')
    await generate(root, 'cart.add-item', '--local', '--input', 'productId:string,quantity:int')
    await generate(root, 'cart.get-items', '--local', '--output', 'count:int')
    // O registro e os testes de uso: o app monta o container e as telas o leem
    writeIn(
      root,
      'src/use-cases/registry.test.tsx',
      `import { expect, it, vi } from 'vitest'
import { createAppUseCases } from './index'

it('com VITE_DATA_SOURCE=storage (dos repositórios) os use cases usam o mock', async () => {
  vi.stubEnv('VITE_DATA_SOURCE', 'storage')
  const useCases = createAppUseCases({ latencyMs: 0 })
  expect(await useCases.getClientes.execute({})).toHaveLength(2)
  vi.unstubAllEnvs()
})

it('o registro junta os use cases dos domínios, sobre o http de mentira', async () => {
  const useCases = createAppUseCases({ dataSource: 'mock', latencyMs: 0 })
  expect(Object.keys(useCases).sort()).toEqual([
    'addItem',
    'getCliente',
    'getClientes',
    'getItems',
    'signIn',
    'signOut',
    'updateCliente',
  ])
  expect(await useCases.getClientes.execute({})).toHaveLength(2)
  expect(Object.keys(createAppUseCases({ latencyMs: 0 }))).toHaveLength(7)
  expect(await useCases.signIn.execute({ email: 'a@b.c', password: 'x' })).toEqual({ token: 'Token 1' })
  expect(await useCases.updateCliente.execute({ id: 'a b', nome: 'Novo' })).toMatchObject({ id: 'cliente-1' })
})
`,
    )
    compiled = tsc(root)
    tests = vitest(root, {}, ['src'])
  }, 240_000)

  it('o app compila com os use cases registrados', () => {
    expect(compiled).toEqual({ status: 0, output: '' })
  })

  it('os testes gerados passam contra o mock, e o da API fica pulado sem API_TEST_URL', () => {
    expect(tests.status, tests.output).toBe(0)
    expect(tests.output).toMatch(/SignInUseCase contract: mock > aceita um Input válido/)
    expect(tests.output).toMatch(/SignInUseCase contra a API de teste/)
    expect(tests.output).toMatch(/add-item.usecase.test.ts > aceita um Input válido/)
    expect(tests.output).toMatch(/traduz o erro da API em UIError SIGN_IN_FAILED/)
  })

  it('o registro tem os domínios em ordem alfabética', () => {
    const index = read(root, 'src/use-cases/index.ts')
    expect(index).toContain(
      "import { createAuthUseCases, authRoutes } from './auth'\nimport { createCartUseCases, cartRoutes } from './cart'\nimport { createClientesUseCases, clientesRoutes } from './clientes'",
    )
    expect(index).toContain(
      'export function createUseCases(deps: UseCaseDeps) {\n  return {\n    ...createAuthUseCases(deps),\n    ...createCartUseCases(deps),\n    ...createClientesUseCases(deps),\n  }\n}',
    )
    expect(index).toContain('export const mockRoutes = {\n  ...authRoutes,\n  ...cartRoutes,\n  ...clientesRoutes,\n}')
  })

  it('o use case de escrita com :parâmetro tira o campo do corpo e codifica o valor', () => {
    const usecase = read(root, 'src/use-cases/clientes/update-cliente.usecase.ts')
    expect(usecase).toContain('const { id, ...body } = UpdateClienteInput.parse(input)')
    expect(usecase).toContain("const path = ENDPOINT.path.replace(':id', encodeURIComponent(id))")
  })

  it('o texto do erro entra nos dois idiomas', () => {
    expect(JSON.parse(read(root, 'src/messages/pt-BR/errors.json'))).toMatchObject({
      GET_CLIENTES_FAILED: 'Não foi possível carregar os dados.',
      SIGN_IN_FAILED: 'Não foi possível concluir a ação.',
    })
    expect(JSON.parse(read(root, 'src/messages/en/errors.json'))).toMatchObject({
      SIGN_IN_FAILED: 'Could not complete the action.',
    })
  })
})

describe('o use case contra uma API de teste', () => {
  it('roda o contrato contra a API falsa, com API_TEST_URL', async () => {
    const root = await project('nome:string')
    await generate(root, 'auth.sign-in', '--input', 'email:string', '--output', 'token:string')
    writeFileSync(
      path.join(root, 'src/test/fake-api.ts'),
      `import { vi } from 'vitest'

vi.stubGlobal('fetch', async () => Response.json({ token: 'abc' }))
`,
    )
    writeFileSync(path.join(root, 'src/test/setup.ts'), `${read(root, 'src/test/setup.ts')}\nimport './fake-api'\n`)
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const ran = vitest(root, { API_TEST_URL: 'http://api.test' }, ['src/use-cases'])
    expect(ran.status, ran.output).toBe(0)
    expect(ran.output).toMatch(/SignInUseCase contract: API > aceita um Input válido/)
  }, 120_000)
})
