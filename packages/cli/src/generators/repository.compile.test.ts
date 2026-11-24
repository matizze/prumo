import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { project, tsc, useFakeApi, vitest } from '../test/compile.ts'
import { exec } from '../test/run.ts'

/**
 * O repositório gerado de verdade: o projeto temporário (`test/compile.ts`) recebe o schema (do
 * `make:schema`, às vezes editado à mão) e o repositório (do `make:repository`), e o `tsc` roda nele.
 */

/**
 * Uma API de clientes falsa, na memória, no lugar do \`fetch\` global: segue o formato do app
 * (\`{ items, total }\`, a lista com search, sort, page e page_size, \`PATCH\`, \`DELETE\` e o 404) e
 * volta às fixtures antes de cada teste.
 */
const FAKE_API = `import { beforeEach, vi } from 'vitest'
import { matchesSearch, paginate, sortBy } from '@matizze/prumo-core/mock'
import { MOCK_CLIENTES } from '@/repositories/clientes/fixtures'

type Item = (typeof MOCK_CLIENTES)[number]

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

let items: Item[] = []
let sequence = 0
beforeEach(() => {
  items = MOCK_CLIENTES.map((item) => ({ ...item }))
  sequence = items.length
})

vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input))
  const method = init?.method ?? 'GET'
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
  if (url.origin !== 'http://api.test') return json(500)

  if (url.pathname === '/clientes' && method === 'GET') {
    const found = items.filter((item) =>
      matchesSearch(
        Object.entries(item).flatMap(([key, value]) =>
          key !== 'id' && key !== 'createdAt' && typeof value === 'string' ? [value] : [],
        ),
        url.searchParams.get('search') ?? undefined,
      ),
    )
    const [key = '', direction] = (url.searchParams.get('sort') ?? '').split(':')
    const sorted = key
      ? sortBy(found, { key, direction: direction === 'desc' ? 'desc' : 'asc' }, {
          [key]: (item: Item) => {
            const value = (item as Record<string, unknown>)[key]
            return typeof value === 'number' ? value : String(value ?? '')
          },
        })
      : found
    const page = Number(url.searchParams.get('page') ?? 1)
    const size = Number(url.searchParams.get('page_size') ?? 0)
    return json(200, paginate(sorted, page, size || undefined))
  }
  if (url.pathname === '/clientes' && method === 'POST') {
    sequence += 1
    const created = { id: \`cliente-\${sequence}\`, ...body, createdAt: new Date().toISOString() } as Item
    items.push(created)
    return json(201, created)
  }
  const id = /^\\/clientes\\/([^/]+)$/.exec(url.pathname)?.[1]
  const at = items.findIndex((item) => item.id === (id === undefined ? id : decodeURIComponent(id)))
  const found = items[at]
  if (!found) return json(404)
  if (method === 'PATCH') {
    items[at] = { ...found, ...body }
    return json(200, items[at])
  }
  if (method === 'DELETE') {
    items.splice(at, 1)
    // O backend pode confirmar de três jeitos: 204, 200 sem corpo ou 200 com um texto qualquer
    if (process.env.FAKE_DELETE === 'empty') return new Response('', { status: 200 })
    if (process.env.FAKE_DELETE === 'ok') {
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
    return json(204)
  }
  return json(200, found)
})
`

const SCHEMA = 'src/schemas/entities/cliente.ts'

function edit(root: string, change: (text: string) => string, entity = 'cliente'): void {
  const file = path.join(root, SCHEMA.replace('cliente', entity))
  writeFileSync(file, change(readFileSync(file, 'utf8')))
}

async function generate(root: string, ...extra: string[]): Promise<void> {
  const result = await exec(['make:repository', 'clientes', ...extra], root)
  expect(result.code, `${result.stdout}${result.stderr}`).toBe(0)
}

/**
 * Os casos de schema que só pedem "o tsc sai com 0 e o contrato passa" dividem um projeto: cada um
 * é um domínio próprio (com o mesmo schema de partida), e o `tsc` e o `vitest` rodam uma vez.
 */
const FIELDS = 'nome:string,idade:int,ativo:boolean'
const VARIATIONS = [
  {
    name: 'com o schema sem edição',
    domain: 'clientes',
    entity: 'cliente',
    edit: (text: string) => text,
  },
  {
    name: 'com um campo acrescentado à mão ao z.object, ao pick e à SortKey',
    domain: 'produtos',
    entity: 'produto',
    edit: (text: string) =>
      text
        .replace('  createdAt: z.string(),', '  peso: z.number(),\n  createdAt: z.string(),')
        .replace('.pick({ ', '.pick({ peso: true, ')
        .replace(/(export type ProdutoSortKey =[^\n]*)/, "$1 | 'peso'"),
    mock: (mock: string) => expect(mock).toContain('peso: input.peso,'),
  },
  {
    name: 'com um campo acrescentado só ao z.object (fora do pick e da SortKey)',
    domain: 'pedidos',
    entity: 'pedido',
    edit: (text: string) =>
      text.replace('  createdAt: z.string(),', '  calculado: z.number().int(),\n  createdAt: z.string(),'),
    mock: (mock: string) => expect(mock).not.toContain('input.calculado'),
  },
  {
    name: 'com um campo fora do pick, mas na SortKey',
    domain: 'lojas',
    entity: 'loja',
    edit: (text: string) =>
      text.replace(/\.pick\(\{[^)]*\}\)/, '.pick({ nome: true, ativo: true })'),
    mock: (mock: string) => {
      expect(mock).not.toContain('input.idade')
      expect(mock).toContain('idade: (item) => item.idade')
    },
  },
  {
    name: 'com um campo fora da SortKey',
    domain: 'cidades',
    entity: 'cidade',
    edit: (text: string) =>
      text.replace(/export type CidadeSortKey =[^\n]*/, "export type CidadeSortKey = 'nome' | 'createdAt'"),
    mock: (mock: string) => expect(mock).not.toContain('idade: (item)'),
  },
  {
    name: 'com uma SortKey sem createdAt e um campo obrigatório fora do pick',
    domain: 'bairros',
    entity: 'bairro',
    edit: (text: string) =>
      text
        .replace(/export type BairroSortKey =[^\n]*/, "export type BairroSortKey = 'idade'")
        .replace(/\.pick\(\{[^)]*\}\)/, '.pick({ nome: true })'),
  },
] as const

describe('o repositório gerado compila (tsc estrito) e passa no contrato', () => {
  let root: string
  let compiled: ReturnType<typeof tsc>
  let tests: ReturnType<typeof vitest>

  beforeAll(async () => {
    root = await project(FIELDS)
    for (const { domain, entity, edit: change } of VARIATIONS) {
      if (domain !== 'clientes') {
        const made = await exec(['make:schema', domain, '--entity', entity, '--fields', FIELDS], root)
        expect(made.code, made.stderr).toBe(0)
      }
      edit(root, change, entity)
      const result = await exec(['make:repository', domain], root)
      expect(result.code, `${result.stdout}${result.stderr}`).toBe(0)
    }
    compiled = tsc(root)
    tests = vitest(root, {}, ['src/repositories'])
  }, 180_000)

  it.each(VARIATIONS)('$name', (variation) => {
    if ('mock' in variation) {
      const file = `src/repositories/${variation.domain}/repository.mock.ts`
      variation.mock(readFileSync(path.join(root, file), 'utf8'))
    }
    expect(compiled).toEqual({ status: 0, output: '' })
    expect(tests.status, tests.output).toBe(0)
    expect(tests.output).toContain(`src/repositories/${variation.domain}/repository.contract.test.ts`)
  })

  it('recusa um booleano na SortKey, em vez de gerar um mock que não compila', async () => {
    const root = await project()
    edit(root, (text) => text.replace(/export type ClienteSortKey =[^\n]*/, "export type ClienteSortKey = 'nome' | 'ativo' | 'createdAt'"))
    const result = await exec(['make:repository', 'clientes'], root)
    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(/cliente\.ts:\d+: o ClienteSortKey tem 'ativo', que é booleano/)
  })
})

describe('as fontes storage e http compilam (tsc estrito) e passam no contrato', () => {
  const LIVROS =
    'titulo:string,ano:number,paginas:int,situacao:enum(lido|lendo|desejado),disponivel:boolean,publicadoEm:date,lidoEm?:datetime,apelido?:string'

  it('storage: o contrato roda contra o localStorage, em cima do mock', async () => {
    const root = await project()
    await generate(root)
    await generate(root, '--data-source', 'storage')
    expect(readFileSync(path.join(root, 'src/repositories/options.ts'), 'utf8')).toContain(
      "['mock', 'storage']",
    )
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root, {}, ['src/repositories'])
    expect(tests.status, tests.output).toBe(0)
    expect(tests.output).toMatch(/StorageClientesRepository > busca um registro/)
    expect(tests.output).not.toMatch(/skipped/)
  }, 120_000)

  it('storage num repositório que ainda não existe, com campos de todos os tipos', async () => {
    const root = await project(LIVROS)
    await generate(root, '--data-source', 'storage')
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root, {}, ['src/repositories'])
    expect(tests.status, tests.output).toBe(0)
    expect(tests.output).toMatch(/StorageClientesRepository > ordena e pagina/)
  }, 120_000)

  it('storage: grava com a chave do app, ignora undefined no update, rejeita o inválido e descarta só o registro corrompido', async () => {
    const root = await project('nome:string')
    await generate(root, '--data-source', 'storage')
    writeFileSync(
      path.join(root, 'src/repositories/clientes/persistence.test.ts'),
      `import { afterEach, expect, it, vi } from 'vitest'
import { MOCK_CLIENTES } from './fixtures'
import { STORAGE_KEY, StorageClientesRepository } from './repository.storage'

const repo = () => new StorageClientesRepository({ latencyMs: 0 })

afterEach(() => vi.restoreAllMocks())

it('grava no localStorage com a chave do app e lê de volta', async () => {
  localStorage.removeItem(STORAGE_KEY)
  expect(STORAGE_KEY).toBe('app:clientes')
  const created = await repo().create({ nome: 'Gravado' })
  expect(localStorage.getItem(STORAGE_KEY)).toContain('Gravado')
  expect(await repo().get(created.id)).toEqual(created)
})

it('update com campo undefined não muda o campo, nem no que fica gravado', async () => {
  localStorage.removeItem(STORAGE_KEY)
  const before = await repo().get('cliente-1')
  expect(await repo().update('cliente-1', { nome: undefined })).toEqual(before)
  expect((await repo().get('cliente-1')).nome).toBe(before.nome)
  expect(localStorage.getItem(STORAGE_KEY)).toContain(before.nome)
})

it('create e update inválidos rejeitam com CLIENTE_INVALID e não gravam nada', async () => {
  localStorage.removeItem(STORAGE_KEY)
  await expect(repo().create({ nome: 123 as unknown as string })).rejects.toMatchObject({ code: 'CLIENTE_INVALID' })
  await expect(repo().update('cliente-1', { nome: 123 as unknown as string })).rejects.toMatchObject({ code: 'CLIENTE_INVALID' })
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  expect((await repo().list()).total).toBe(MOCK_CLIENTES.length)
})

it('um registro corrompido é descartado, com aviso, e os outros ficam', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ sequence: 9, items: [MOCK_CLIENTES[0], { id: 'quebrado', nome: 5 }, MOCK_CLIENTES[1]] }),
  )
  const { items, total } = await repo().list()
  expect(total).toBe(2)
  expect(items.map((item) => item.id)).toEqual([MOCK_CLIENTES[0]!.id, MOCK_CLIENTES[1]!.id])
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('app:clientes'))
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('quebrado'))
})

it('JSON ilegível volta às fixtures, com aviso', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  localStorage.setItem(STORAGE_KEY, '{ não é json')
  expect((await repo().list()).total).toBe(MOCK_CLIENTES.length)
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('app:clientes'))
})
`,
    )
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root, {}, ['src/repositories'])
    expect(tests.status, tests.output).toBe(0)
  }, 120_000)

  it('http: o cliente tira a barra do fim, só lê corpo em JSON, e a VITE_API_URL vazia vale como ausente', async () => {
    const root = await project('nome:string')
    await generate(root, '--data-source', 'http')
    writeFileSync(
      path.join(root, 'src/repositories/http.test.ts'),
      `import { expect, it, vi } from 'vitest'
import { createHttp, HttpError } from './http'

const withFetch = (reply: () => Response, calls: string[] = []) =>
  createHttp({
    baseUrl: 'http://api.test///',
    fetch: (async (url: string) => {
      calls.push(url)
      return reply()
    }) as unknown as typeof fetch,
  })

it('tira as barras do fim do baseUrl', async () => {
  const calls: string[] = []
  await withFetch(() => Response.json({}), calls)('/clientes')
  expect(calls).toEqual(['http://api.test/clientes'])
})

it('devolve undefined para o corpo vazio, o que não é JSON e o 204; lê o JSON; erro lança', async () => {
  expect(await withFetch(() => new Response(null, { status: 204 }))('/a')).toBeUndefined()
  expect(await withFetch(() => new Response('', { status: 200 }))('/a')).toBeUndefined()
  expect(await withFetch(() => new Response('OK', { status: 200 }))('/a')).toBeUndefined()
  expect(await withFetch(() => Response.json({ a: 1 }))('/a')).toEqual({ a: 1 })
  // JSON sem content-type de JSON: o corpo que começa com { ou [ é lido do mesmo jeito
  expect(await withFetch(() => new Response(' {"a":1}', { status: 200 }))('/a')).toEqual({ a: 1 })
  expect(await withFetch(() => new Response('[1,2]', { status: 200 }))('/a')).toEqual([1, 2])
  expect(await withFetch(() => new Response('  ', { status: 200 }))('/a')).toBeUndefined()
  await expect(withFetch(() => new Response('', { status: 500 }))('/a')).rejects.toBeInstanceOf(HttpError)
})

it('a VITE_API_URL vazia vale como ausente (/api), e a com barra no fim é aparada', async () => {
  const urls: string[] = []
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url)
    return Response.json({})
  })
  for (const value of ['', 'http://api.test/']) {
    vi.stubEnv('VITE_API_URL', value)
    vi.resetModules()
    const { api } = await import('./api')
    await api('/ping')
  }
  expect(urls).toEqual(['/api/ping', 'http://api.test/ping'])
})
`,
    )
    useFakeApi(root, FAKE_API)
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root, {}, ['src/repositories'])
    expect(tests.status, tests.output).toBe(0)
  }, 120_000)

  it('http: o contrato fica pulado sem API_TEST_URL e roda contra uma API falsa em memória', async () => {
    const root = await project(LIVROS)
    await generate(root, '--data-source', 'http')
    useFakeApi(root, FAKE_API)
    expect(tsc(root)).toEqual({ status: 0, output: '' })

    const skipped = vitest(root, {}, ['src/repositories'])
    expect(skipped.status, skipped.output).toBe(0)
    expect(skipped.output).toMatch(/skipped/)
    expect(skipped.output).toMatch(/pulado: defina API_TEST_URL/)

    // O remove passa com o DELETE respondendo 204, 200 sem corpo e 200 com 'OK'
    for (const FAKE_DELETE of ['204', 'empty', 'ok']) {
      const ran = vitest(root, { API_TEST_URL: 'http://api.test', FAKE_DELETE }, ['src/repositories'])
      expect(ran.status, `${FAKE_DELETE}: ${ran.output}`).toBe(0)
      expect(ran.output).toMatch(/HttpClientesRepository > cria um registro/)
      expect(ran.output).toMatch(/HttpClientesRepository > remove um registro/)
      expect(ran.output).toMatch(/HttpClientesRepository > ignora o campo indefinido/)
      expect(ran.output).not.toMatch(/skipped/)
    }
  }, 120_000)

  it('http e storage no mesmo domínio, com o app já tendo o cliente http', async () => {
    const root = await project()
    await generate(root, '--data-source', 'http')
    await generate(root, '--data-source', 'storage')
    useFakeApi(root, FAKE_API)
    expect(tsc(root)).toEqual({ status: 0, output: '' })
    const tests = vitest(root, { API_TEST_URL: 'http://api.test' }, ['src/repositories'])
    expect(tests.status, tests.output).toBe(0)
    expect(tests.output).toMatch(/StorageClientesRepository > lista as fixtures/)
    expect(tests.output).toMatch(/HttpClientesRepository > lista as fixtures/)
  }, 120_000)
})
