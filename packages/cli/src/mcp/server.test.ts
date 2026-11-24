import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { afterAll, describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemods/test-support.ts'
import { createMcpServer, resultOf } from './server.ts'
import { describeTools } from './tools.ts'
import { createProgram } from '../program.ts'

type Result = { text: string; isError: boolean }

/** Um projeto de fixture e um cliente ligado, no mesmo processo, ao servidor que roda nele. */
async function connect(root = fixtureProject().root) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const server = createMcpServer({ root, version: '9.9.9' })
  const client = new Client({ name: 'teste', version: '0.0.0' })
  await server.connect(serverSide)
  await client.connect(clientSide)
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<Result> => {
    const result = await client.callTool({ name, arguments: args })
    const text = (result.content as { type: string; text?: string }[])
      .map((block) => block.text ?? '')
      .join('')
    return { text, isError: result.isError === true }
  }
  return { root, client, call }
}

const connections: Awaited<ReturnType<typeof connect>>[] = []
afterAll(async () => {
  await Promise.all(connections.map(({ client }) => client.close()))
})
async function open() {
  const connection = await connect()
  connections.push(connection)
  return connection
}

describe('prumo mcp, cliente e servidor no mesmo processo', () => {
  it('informa o nome e a versão e lista as seis ferramentas', async () => {
    const { client } = await open()
    expect(client.getServerVersion()).toMatchObject({ name: 'prumo', version: '9.9.9' })
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      ['check', 'list', 'make_page', 'make_query', 'make_repository', 'make_schema'].sort(),
    )
    const schema = tools.find((tool) => tool.name === 'make_schema')
    expect(schema?.description).toContain('Cria o schema')
    expect(schema?.inputSchema.required).toEqual(['dominio'])
  })

  it('gera schema, repositório, query e tela, e confere com check e list', async () => {
    const { root, call } = await open()
    const made = [
      await call('make_schema', { dominio: 'livros', fields: 'title:string,year?:int' }),
      await call('make_repository', { dominio: 'livros', data_source: 'storage' }),
      await call('make_query', { dominio: 'livros' }),
      await call('make_page', { nome: 'livros', query: 'livros', path: '/livros' }),
    ]
    for (const result of made) expect(result, result.text).toMatchObject({ isError: false })
    expect(made[3]?.text).toContain('make:page: livros')
    expect(existsSync(path.join(root, 'src/pages/livros/model.ts'))).toBe(true)
    expect(readFileSync(path.join(root, 'src/App.tsx'), 'utf8')).toContain('<Route path="/livros">')

    const check = await call('check')
    expect(check).toEqual({ text: 'prumo check: nenhuma violação.\n', isError: false })

    const list = await call('list')
    expect(list.isError).toBe(false)
    const listing = JSON.parse(list.text) as {
      schemas: { entity: string }[]
      repositories: { sources: string[] }[]
      pages: { name: string; query?: string }[]
    }
    expect(listing.schemas.map((schema) => schema.entity)).toEqual(['Livro'])
    expect(listing.repositories[0]?.sources).toEqual(['mock', 'storage'])
    expect(listing.pages.find((page) => page.name === 'livros')?.query).toBe('livros')
  })

  it('dry_run só mostra o plano, sem escrever', async () => {
    const { root, call } = await open()
    const before = readdirSync(path.join(root, 'src'), { recursive: true }).sort()
    const result = await call('make_schema', { dominio: 'livros', fields: 'title:string', dry_run: true })
    expect(result.isError).toBe(false)
    expect(result.text).toContain('(simulação)')
    expect(readdirSync(path.join(root, 'src'), { recursive: true }).sort()).toEqual(before)
  })

  it('um erro de uso volta com isError e a mensagem em português', async () => {
    const { call } = await open()
    const result = await call('make_page', { nome: 'livros', query: 'inexistente' })
    expect(result.isError).toBe(true)
    expect(result.text).toContain("prumo: a query 'inexistente' não existe")
    expect(result.text).toMatch(/query/i)
  })

  it('o check com violação é resultado, não erro', async () => {
    const { root, call } = await open()
    const { mkdirSync, writeFileSync } = await import('node:fs')
    mkdirSync(path.join(root, 'src/pages/solta'), { recursive: true })
    writeFileSync(path.join(root, 'src/pages/solta/index.tsx'), 'export {}\n')
    const result = await call('check')
    expect(result.isError).toBe(false)
    expect(result.text).toContain('[')
    expect(result.text).toMatch(/violaç/)
  })

  it('recusa campo fora do esquema (o servidor não aceita root) e posicional com -', async () => {
    const { client, root } = await open()
    const outside = await client.callTool({ name: 'check', arguments: { root: '/' } })
    expect(outside.isError).toBe(true)
    const dash = await client.callTool({ name: 'make_query', arguments: { dominio: '--root=/tmp/x' } })
    expect(dash.isError).toBe(true)
    expect(existsSync(path.join(root, '..', 'x'))).toBe(false)
  })

  it('não escreve fora do projeto', async () => {
    // Uma pasta-mãe só deste teste: a pasta temporária do sistema muda com os outros testes, que
    // rodam ao mesmo tempo, então compará-la antes e depois não prova nada
    const parent = mkdtempSync(path.join(tmpdir(), 'prumo-mcp-fora-'))
    try {
      const root = path.join(parent, 'app')
      cpSync(fixtureProject().root, root, { recursive: true })
      const connection = await connect(root)
      connections.push(connection)
      await connection.call('make_schema', { dominio: 'livros', fields: 'title:string' })
      await connection.call('make_page', { nome: 'sobre' })
      expect(readdirSync(parent)).toEqual(['app'])
      expect(existsSync(path.join(root, 'src/pages/sobre/index.tsx'))).toBe(true)
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })

  it('chamadas juntas rodam uma de cada vez, sem se atropelar', async () => {
    const { root, call } = await open()
    const results = await Promise.all([
      call('make_page', { nome: 'um' }),
      call('make_page', { nome: 'dois' }),
      call('make_page', { nome: 'tres' }),
    ])
    for (const result of results) expect(result, result.text).toMatchObject({ isError: false })
    const app = readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
    for (const name of ['um', 'dois', 'tres']) expect(app).toContain(`<Route path="/${name}">`)
  })
})

describe('resultOf', () => {
  const noop = (): void => undefined
  const check = describeTools(createProgram({ cwd: '.', out: noop, err: noop })).find(
    (tool) => tool.command === 'check',
  )!

  it('o check com violação (código 1) é resultado', () => {
    expect(resultOf(check, { code: 1, kind: 'exit' }, '', 'a.ts  [regra]  x\n\nprumo check: 1 violação.\n').isError).toBe(false)
  })

  it('o erro inesperado (código 1) é erro, mesmo no check', () => {
    expect(resultOf(check, { code: 1, kind: 'unexpected' }, '', 'prumo: erro inesperado: x\n').isError).toBe(true)
  })

  it('outro código no check é erro', () => {
    expect(resultOf(check, { code: 2, kind: 'usage' }, '', 'prumo: x\n').isError).toBe(true)
  })
})
