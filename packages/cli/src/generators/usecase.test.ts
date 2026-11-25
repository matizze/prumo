import { rmSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { fixtureProject } from '../test/fixture-project.ts'
import { generateSchema } from './schema.ts'
import { generateUseCase, type UseCaseRequest } from './usecase.ts'

/** Um projeto de fixture, com o schema `stores` (entidade `store`) já no disco. */
function projectWithStores() {
  const project = fixtureProject()
  generateSchema(project, { name: 'stores', fields: 'name:string,city:string' }).plan.commit()
  return project
}

const text = (result: ReturnType<typeof generateUseCase>, name: string) =>
  result.plan.createdSources().find((source) => source.getFilePath().endsWith(name))!.getFullText()

/** Gera e grava o use case, como o comando faz. */
function commit(project: ReturnType<typeof fixtureProject>, request: UseCaseRequest) {
  const result = generateUseCase(project, request)
  result.plan.commit()
  return result
}

describe('generateUseCase', () => {
  it('leitura: os quatro arquivos, o índice do domínio e o registro, sem tocar o disco', () => {
    const project = projectWithStores()
    const result = generateUseCase(project, { name: 'stores.get-stores', output: 'store[]' })

    expect(result.kind).toBe('read')
    expect(result.key).toBe('getStores')
    expect(result.endpoint).toEqual({ method: 'GET', path: '/stores/get-stores', params: [] })
    expect(result.plan.summary()).toEqual({
      created: [
        'src/use-cases/stores/index.ts',
        'src/use-cases/stores/mocks/get-stores.ts',
        'src/use-cases/stores/services/get-stores.usecase.test.ts',
        'src/use-cases/stores/services/get-stores.usecase.ts',
        'src/use-cases/stores/types/get-stores.ts',
      ],
      modified: ['src/use-cases/index.ts'],
    })
    expect(text(result, 'types/get-stores.ts')).toBe(`import { z } from 'zod'
import { storeSchema } from '@/schemas'

export const ENDPOINT = { method: 'GET', path: '/stores/get-stores' } as const

export const GetStoresRequest = z.object({})

export type GetStoresRequest = z.infer<typeof GetStoresRequest>

export const GetStoresResponse = z.array(storeSchema)

export type GetStoresResponse = z.infer<typeof GetStoresResponse>

export function getStoresKey(input: GetStoresRequest) {
  return ['stores', 'get-stores', input] as const
}
`)
    const usecase = text(result, 'services/get-stores.usecase.ts')
    expect(usecase).toContain('export class GetStoresUseCase implements IUseCase<GetStoresRequest, GetStoresResponse> {')
    expect(usecase).toContain('readonly #http: Http')
    expect(usecase).toContain(
      'const response = await this.#http(ENDPOINT.path, { method: ENDPOINT.method, query: GetStoresRequest.parse(input) })',
    )
    expect(usecase).toContain('return GetStoresResponse.parse(response)')
    expect(usecase).not.toContain('try')
    expect(usecase).not.toContain('UIError')
    expect(text(result, 'mocks/get-stores.ts')).toContain("id: 'store-1',")
    expect(text(result, 'mocks/get-stores.ts')).toContain(
      '[`${ENDPOINT.method} ${ENDPOINT.path}` as const]: (): GetStoresResponse => [',
    )
  })

  it('escrita: o Request vai no corpo, e o Response em campos vira z.object', () => {
    const result = generateUseCase(projectWithStores(), {
      name: 'auth.sign-in',
      input: 'email:string,password:string',
      output: 'token:string',
    })

    expect(result.kind).toBe('write')
    expect(result.endpoint).toMatchObject({ method: 'POST', path: '/auth/sign-in' })
    const types = text(result, 'types/sign-in.ts')
    expect(types).toContain('export const SignInRequest = z.object({\n  email: z.string(),\n  password: z.string(),\n})')
    expect(types).toContain('export const SignInResponse = z.object({\n  token: z.string(),\n})')
    expect(types).not.toContain('signInKey')
    expect(text(result, 'services/sign-in.usecase.ts')).toContain(
      'this.#http(ENDPOINT.path, { method: ENDPOINT.method, body: SignInRequest.parse(input) })',
    )
    expect(text(result, 'mocks/sign-in.ts')).toContain("(): SignInResponse => ({ token: 'Token 1' })")
    expect(result.warnings).toEqual([])
  })

  it('sem --input e --output: avisa, e o Response padrão depende do tipo', () => {
    const project = projectWithStores()
    const read = generateUseCase(project, { name: 'stores.count-stores' })
    expect(text(read, 'types/count-stores.ts')).toContain('CountStoresResponse = z.unknown()')
    expect(text(read, 'mocks/count-stores.ts')).toContain('(): CountStoresResponse => ({})')
    const write = generateUseCase(project, { name: 'stores.close-store' })
    expect(text(write, 'types/close-store.ts')).toContain('CloseStoreResponse = z.unknown()')
    expect(text(write, 'mocks/close-store.ts')).toContain('(): CloseStoreResponse => ({})')
    expect(write.warnings).toEqual([
      'sem --input, o Request é um objeto vazio: descreva os campos em src/use-cases/stores/types/close-store.ts.',
      'sem --output, o Response é z.unknown(): descreva o que o use case devolve em src/use-cases/stores/types/close-store.ts.',
    ])
  })

  it.each(['get', 'list', 'search', 'find', 'check', 'count'])('o verbo %s é leitura', (verb) => {
    const { kind } = generateUseCase(projectWithStores(), { name: `stores.${verb}-stores` })
    expect(kind).toBe('read')
  })

  it('o verbo sozinho conta, e --read e --write forçam o tipo', () => {
    const project = projectWithStores()
    expect(generateUseCase(project, { name: 'stores.list' }).kind).toBe('read')
    expect(generateUseCase(project, { name: 'stores.listing' }).kind).toBe('write')
    expect(generateUseCase(project, { name: 'stores.publish', read: true }).kind).toBe('read')
    expect(generateUseCase(project, { name: 'stores.get-stores', write: true }).kind).toBe('write')
    expect(() => generateUseCase(project, { name: 'stores.get-stores', read: true, write: true })).toThrow(
      "use '--read' ou '--write', não os dois.",
    )
  })

  it('--endpoint com :parâmetro: o campo sai do corpo e entra no caminho, codificado', () => {
    const result = generateUseCase(projectWithStores(), {
      name: 'stores.update-store',
      endpoint: 'patch /stores/:id',
      input: 'id:string,name?:string',
    })

    expect(result.endpoint).toEqual({ method: 'PATCH', path: '/stores/:id', params: ['id'] })
    const usecase = text(result, 'services/update-store.usecase.ts')
    expect(usecase).toContain('const { id, ...body } = UpdateStoreRequest.parse(input)')
    expect(usecase).toContain("const path = ENDPOINT.path.replace(':id', encodeURIComponent(id))")
    expect(usecase).toContain('this.#http(path, { method: ENDPOINT.method, body })')
  })

  it('--endpoint só com :parâmetros no Request: nada vai na query nem no corpo, e vários parâmetros se encadeiam', () => {
    const project = projectWithStores()
    const one = generateUseCase(project, { name: 'stores.get-store', endpoint: 'GET /stores/:id', input: 'id:string' })
    expect(text(one, 'services/get-store.usecase.ts')).toContain('const { id } = GetStoreRequest.parse(input)')
    expect(text(one, 'services/get-store.usecase.ts')).toContain('this.#http(path, { method: ENDPOINT.method })')
    const two = generateUseCase(project, {
      name: 'stores.get-item',
      endpoint: 'GET /stores/:storeId/items/:itemId',
      input: 'storeId:string,itemId:int,page?:int',
    })
    expect(text(two, 'services/get-item.usecase.ts')).toContain(
      "const path = ENDPOINT.path\n      .replace(':storeId', encodeURIComponent(storeId))\n      .replace(':itemId', encodeURIComponent(itemId))",
    )
    expect(text(two, 'services/get-item.usecase.ts')).toContain('const { storeId, itemId, ...query } = GetItemRequest.parse(input)')
  })

  it.each([
    ['GET', '--endpoint \'GET\' é inválido'],
    ['TRACE /stores', '--endpoint \'TRACE /stores\' é inválido'],
    ['GET /stores?a=1', 'é inválido'],
    ['GET stores', 'é inválido'],
  ])('--endpoint %s: recusa o formato', (endpoint, message) => {
    expect(() => generateUseCase(projectWithStores(), { name: 'stores.get-stores', endpoint })).toThrow(message)
  })

  it('--endpoint recusa o :parâmetro que não está no Input, que é opcional, que confunde ou que redeclara', () => {
    const project = projectWithStores()
    const gen = (endpoint: string, input?: string) =>
      generateUseCase(project, { name: 'stores.update-store', endpoint, input })
    expect(() => gen('PATCH /stores/:id')).toThrow("o parâmetro ':id' do caminho não é um campo do Request: acrescente 'id:string' ao --input")
    expect(() => gen('PATCH /stores/:id', 'id?:string')).toThrow("o campo 'id' do Request tem que ser obrigatório")
    expect(() => gen('PATCH /stores/:id/:idx', 'id:string,idx:string')).toThrow("':id' é o começo de ':idx'")
    expect(() => gen('PATCH /stores/:path', 'path:string')).toThrow("tem o nome de uma variável do execute gerado")
  })

  it('--endpoint recusa :parâmetro reservado ou de tipo que não cabe no caminho', () => {
    const project = projectWithStores()
    const gen = (endpoint: string, input: string) =>
      generateUseCase(project, { name: 'stores.update-store', endpoint, input })
    expect(() => gen('PATCH /stores/:delete', 'delete:string')).toThrow("':delete' é palavra reservada")
    expect(() => gen('PATCH /stores/:day', 'day:date')).toThrow("o campo 'day' do Request é date")
    expect(gen('PATCH /stores/:kind', 'kind:enum(a|b)').endpoint?.params).toEqual(['kind'])
  })

  it('escrita com GET é recusada', () => {
    expect(() => generateUseCase(projectWithStores(), { name: 'stores.close-store', endpoint: 'GET /stores/close' })).toThrow(
      'uma escrita não pode usar GET',
    )
  })

  it('--output com entidade: o schema precisa existir, e o nome precisa ser válido', () => {
    const project = projectWithStores()
    expect(() => generateUseCase(project, { name: 'stores.get-stores', output: 'loja[]' })).toThrow(
      "--output 'loja[]': o schema da entidade 'loja' não existe (src/schemas/entities/loja.ts). Crie com prumo make:schema <domínio> --entity loja",
    )
    expect(() => generateUseCase(project, { name: 'stores.get-stores', output: 'Loja' })).toThrow(
      "a entidade do --output 'Loja' é inválido",
    )
    const one = generateUseCase(project, { name: 'stores.get-store', output: 'store' })
    expect(text(one, 'types/get-store.ts')).toContain('export const GetStoreResponse = storeSchema')
    expect(text(one, 'mocks/get-store.ts')).toContain(
      "(): GetStoreResponse => ({\n    id: 'store-1',\n    name: 'Exemplo 1',\n    city: 'City 1',\n    createdAt: '2026-01-05T12:00:00.000Z',\n  }),",
    )
  })

  it('--input e --output aceitam id e createdAt', () => {
    const result = generateUseCase(projectWithStores(), {
      name: 'stores.get-store',
      input: 'id:string',
      output: 'id:string,createdAt:datetime',
    })
    expect(text(result, 'types/get-store.ts')).toContain('createdAt: z.iso.datetime(),')
  })

  it('campo inválido no --input diz de onde veio', () => {
    expect(() => generateUseCase(projectWithStores(), { name: 'stores.get-stores', input: 'a' })).toThrow(
      "--input 'a' é inválido: 'a' não está no formato nome:tipo",
    )
    expect(() => generateUseCase(projectWithStores(), { name: 'stores.get-stores', output: 'a:b' })).toThrow(
      "--output 'a:b' é inválido",
    )
  })

  it('--local: sem ENDPOINT nem mocks; recebe o storage', () => {
    const result = generateUseCase(projectWithStores(), {
      name: 'cart.add-item',
      local: true,
      input: 'productId:string,quantity:int',
    })

    expect(result.kind).toBe('local')
    expect(result.access).toBe('write')
    expect(result.endpoint).toBeNull()
    expect(result.plan.summary()).toEqual({
      created: [
        'src/use-cases/cart/index.ts',
        'src/use-cases/cart/services/add-item.usecase.test.ts',
        'src/use-cases/cart/services/add-item.usecase.ts',
        'src/use-cases/cart/types/add-item.ts',
      ],
      modified: ['src/use-cases/index.ts'],
    })
    expect(text(result, 'types/add-item.ts')).not.toContain('ENDPOINT')
    const usecase = text(result, 'services/add-item.usecase.ts')
    expect(usecase).toContain('readonly #storage: Storage')
    expect(usecase).toContain("const STORAGE_KEY = 'cart:add-item'")
    expect(usecase).toContain('// A regra do use case entra aqui.')
    expect(usecase).toContain('return AddItemResponse.parse({})')
    expect(text(result, 'index.ts')).toContain('addItem: new AddItemUseCase(deps.storage)')
    expect(text(result, 'index.ts')).not.toContain('Routes,')
  })

  it('--local na leitura lê do storage e leva a chave de cache', () => {
    const result = generateUseCase(projectWithStores(), { name: 'cart.get-items', local: true, output: 'count:int' })
    const usecase = text(result, 'services/get-items.usecase.ts')
    expect(usecase).toContain('GetItemsRequest.parse(input)\n')
    expect(usecase).toContain('const stored = this.#storage.getItem(STORAGE_KEY)')
    expect(usecase).toContain('return GetItemsResponse.parse(stored === null ? { count: 10 } : JSON.parse(stored))')
    expect(text(result, 'types/get-items.ts')).toContain('export function getItemsKey(')
  })

  it('--local com --endpoint é recusado', () => {
    expect(() => generateUseCase(projectWithStores(), { name: 'cart.add-item', local: true, endpoint: 'POST /x' })).toThrow(
      "um use case '--local' não chama a API",
    )
  })

  it('o use case gerado não trata erro, e o errors.json não muda', () => {
    const project = projectWithStores()
    const http = generateUseCase(project, { name: 'stores.get-stores' })
    expect(http.plan.summary().modified).toEqual(['src/use-cases/index.ts'])
    expect(http.warnings.join('\n')).not.toContain('errors.json')
  })

  it('o segundo use case do domínio reaproveita o índice: ordena as chaves e as rotas', () => {
    const project = projectWithStores()
    commit(project, { name: 'stores.list-stores' })
    const second = generateUseCase(project, { name: 'stores.count-stores' })
    expect(second.plan.summary().created).not.toContain('src/use-cases/stores/index.ts')
    const index = second.plan.source(path.join(project.src, 'use-cases/stores/index.ts')).getFullText()
    expect(index).toContain(
      "export function createStoresUseCases(deps: UseCaseDeps) {\n  return {\n    countStores: new CountStoresUseCase(deps.http),\n    listStores: new ListStoresUseCase(deps.http),\n  }\n}",
    )
    expect(index).toContain('export const storesRoutes = {\n  ...countStoresRoutes,\n  ...listStoresRoutes,\n}')
    // O domínio já está no registro: ele não muda
    expect(second.plan.summary().modified).not.toContain('src/use-cases/index.ts')
  })

  it('recusa o use case que já existe e a chave que outro domínio já usa', () => {
    const project = projectWithStores()
    commit(project, { name: 'stores.get-stores' })
    expect(() => generateUseCase(project, { name: 'stores.get-stores' })).toThrow(
      "o use case 'stores.get-stores' já existe.",
    )
    expect(() => generateUseCase(project, { name: 'orders/get-stores' })).toThrow(
      "a chave 'getStores' do registro já é do use case 'stores.get-stores': as chaves são únicas no app",
    )
    expect(() => generateUseCase(project, { name: 'orders.get-stores' })).toThrow(UsageError)
  })

  it('recusa domínio e ação com o mesmo camelCase', () => {
    expect(() => generateUseCase(projectWithStores(), { name: 'cart.cart' })).toThrow('dão o mesmo nome em camelCase')
  })

  it('recusa o nome sem a ação, com ação inválida ou reservada', () => {
    const project = projectWithStores()
    expect(() => generateUseCase(project, { name: 'stores' })).toThrow('precisa ter o domínio e a ação')
    expect(() => generateUseCase(project, { name: 'a.b.c' })).toThrow('precisa ter o domínio e a ação')
    expect(() => generateUseCase(project, { name: 'stores.GetStores' })).toThrow(
      "um segmento do nome do use case 'GetStores' é inválido",
    )
    expect(() => generateUseCase(project, { name: 'stores.delete' })).toThrow("vira o identificador 'delete'")
  })

  it('sem o registro de use cases, explica de onde ele vem e não escreve nada', () => {
    const project = projectWithStores()
    rmSync(path.join(project.src, 'use-cases/index.ts'))
    expect(() => generateUseCase(project, { name: 'stores.get-stores' })).toThrow(
      'o projeto não tem src/use-cases/index.ts: a camada de use cases vem no app criado pelo prumo new',
    )
  })
})
