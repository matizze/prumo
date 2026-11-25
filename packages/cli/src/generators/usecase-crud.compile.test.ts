import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { project, tsc, vitest } from '../test/compile.ts'
import { exec } from '../test/run.ts'

/**
 * O CRUD gerado de verdade: o projeto temporário (`test/compile.ts`) recebe o schema `clientes` e os
 * cinco use cases do `make:usecase --crud`, e o `tsc` e o Vitest rodam nele, contra o mock.
 */


const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

describe('o CRUD gerado compila (tsc estrito) e passa nos testes', () => {
  let root: string
  let compiled: ReturnType<typeof tsc>
  let tests: ReturnType<typeof vitest>

  beforeAll(async () => {
    root = await project('nome:string,apelido?:string,idade:int,ativo:boolean,nascimento:date,perfil:enum(admin|comum)')
    const made = await exec(['make:usecase', 'clientes', '--crud'], root)
    expect(made.code, `${made.stdout}${made.stderr}`).toBe(0)
    compiled = tsc(root)
    tests = vitest(root, {}, ['src/use-cases'])
  }, 240_000)

  it('o app compila com os cinco use cases', () => {
    expect(compiled).toEqual({ status: 0, output: '' })
  })

  it('os testes dos cinco passam contra o mock, e o da API fica pulado sem API_TEST_URL', () => {
    expect(tests.status, tests.output).toBe(0)
    for (const action of ['list-clientes', 'get-cliente', 'create-cliente', 'update-cliente', 'remove-cliente']) {
      expect(tests.output).toContain(`${action}.usecase.test.ts`)
    }
    expect(tests.output).toMatch(/ListClientesUseCase contra a API de teste/)
    expect(tests.output).toMatch(/CreateClienteUseCase contract: mock > cria um registro com id e data, e ele aparece na lista/)
  })

  it('o registro tem as cinco chaves, e o mock dos cinco divide a coleção', () => {
    expect(read(root, 'src/use-cases/clientes/index.ts')).toContain('listClientes: new ListClientesUseCase(deps.http)')
    expect(read(root, 'src/use-cases/clientes/mocks/collection.ts')).toContain('createMockCollection(MOCK_CLIENTES')
  })
})
