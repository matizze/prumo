import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import { connect, makeDir, makeProject, REPOSITORY, textOf } from './test-support.ts'

const exists = (root: string, file: string) => existsSync(path.join(root, file))
const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

describe('o servidor MCP', () => {
  it('se chama prumo, tem a versão do pacote e só ferramentas', async () => {
    const client = await connect({ cwd: makeProject() })

    expect(client.getServerVersion()).toMatchObject({ name: 'prumo', version: pkg.version })
    const capabilities = client.getServerCapabilities()
    expect(capabilities?.tools).toBeDefined()
    expect(capabilities?.resources).toBeUndefined()
    expect(capabilities?.prompts).toBeUndefined()
  })

  it('lista uma ferramenta por comando, com a descrição e o esquema de entrada', async () => {
    const client = await connect({ cwd: makeProject() })
    const { tools } = await client.listTools()

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'add',
      'agents',
      'catalog',
      'check',
      'doctor',
      'make_component',
      'make_domain',
      'make_page',
      'new',
      'patterns',
      'promote',
    ])
    const makePage = tools.find((tool) => tool.name === 'make_page')
    expect(makePage?.description).toContain('Gera uma tela nova')
    expect(makePage?.inputSchema).toMatchObject({
      type: 'object',
      required: ['nome'],
      additionalProperties: false,
      properties: {
        nome: { type: 'string' },
        like: { type: 'string' },
        menu: { type: 'string' },
        root: { type: 'string' },
        'dry-run': { type: 'boolean' },
      },
    })
  })
})

describe('as chamadas', () => {
  it('make_page com like e dry-run lista o que seria criado e não escreve nada', async () => {
    const root = makeProject()
    const client = await connect({ cwd: root })
    const result = await client.callTool({
      name: 'make_page',
      arguments: { nome: 'produtos', like: 'products-list', 'dry-run': true },
    })

    expect(result.isError).toBeFalsy()
    const text = textOf(result as never)
    expect(text).toContain(
      'prumo make:page: produtos a partir de products-list, na rota /produtos.',
    )
    expect(text).toContain('src/pages/produtos/index.tsx')
    expect(text).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(text).not.toContain('[saída')
    expect(exists(root, 'src/pages/produtos')).toBe(false)
  })

  it('make_page de verdade gera a tela e a rota, e o check em seguida passa', async () => {
    const root = makeProject()
    const client = await connect({ cwd: root })

    const made = await client.callTool({
      name: 'make_page',
      arguments: { nome: 'produtos', like: 'products-list' },
    })
    expect(made.isError, textOf(made as never)).toBeFalsy()
    expect(exists(root, 'src/pages/produtos/index.tsx')).toBe(true)
    expect(read(root, 'src/App.tsx')).toContain('/produtos')

    const checked = await client.callTool({ name: 'check', arguments: {} })
    expect(checked.isError).toBeFalsy()
    expect(textOf(checked as never)).toBe('prumo check: nenhuma violação.\n')
  })

  it('check num projeto com violação é erro da ferramenta, com as violações e o código de saída', async () => {
    const root = makeProject()
    mkdirSync(path.join(root, 'src/components/widgets'))
    const client = await connect({ cwd: root })
    const result = await client.callTool({ name: 'check', arguments: {} })

    expect(result.isError).toBe(true)
    const text = textOf(result as never)
    expect(text).toContain('src/components/widgets  [components-folders]')
    expect(text).toContain('prumo check: 1 violação.')
    expect(text.endsWith('\n[saída 1]')).toBe(true)
  })

  it('uso errado do comando vira isError com a mensagem da CLI e [saída 2]', async () => {
    const root = makeProject()
    const client = await connect({ cwd: root })
    const result = await client.callTool({
      name: 'make_page',
      arguments: { nome: 'Nome Inválido' },
    })

    expect(result.isError).toBe(true)
    const text = textOf(result as never)
    expect(text).toMatch(/^prumo make:page: .*nome/i)
    expect(text.endsWith('[saída 2]')).toBe(true)
    expect(exists(root, 'src/pages/Nome Inválido')).toBe(false)
  })

  it('entrada que o esquema recusa volta como isError, sem rodar o comando', async () => {
    const client = await connect({ cwd: makeProject() })

    const dash = await client.callTool({ name: 'make_page', arguments: { nome: '-x' } })
    expect(dash.isError).toBe(true)
    expect(textOf(dash as never)).toContain("não pode começar com '-'")

    const unknown = await client.callTool({ name: 'make_page', arguments: { nome: 'x', bogus: 1 } })
    expect(unknown.isError).toBe(true)
    expect(textOf(unknown as never)).toContain('bogus')

    const missing = await client.callTool({ name: 'make_page', arguments: {} })
    expect(missing.isError).toBe(true)
    expect(textOf(missing as never)).toContain('nome')

    const emptyList = await client.callTool({ name: 'add', arguments: { item: [] } })
    expect(emptyList.isError).toBe(true)
    expect(textOf(emptyList as never)).toContain('ao menos um')

    const badEnum = await client.callTool({ name: 'catalog', arguments: { kind: 'foo' } })
    expect(badEnum.isError).toBe(true)
  })

  it('patterns e catalog com from devolvem as linhas, e o --json é a forma estruturada', async () => {
    const client = await connect({ cwd: makeProject() })

    const patterns = await client.callTool({
      name: 'patterns',
      arguments: { from: REPOSITORY, busca: 'dashboard' },
    })
    expect(patterns.isError, textOf(patterns as never)).toBeFalsy()
    const lines = textOf(patterns as never)
      .trimEnd()
      .split('\n')
    expect(lines.at(-1)).toMatch(/^\d+ padrões?\.$/)
    expect(lines.some((line) => line.startsWith('dashboard — '))).toBe(true)

    const json = await client.callTool({
      name: 'patterns',
      arguments: { from: REPOSITORY, busca: 'dashboard', json: true },
    })
    const parsed = JSON.parse(textOf(json as never)) as { patterns: Array<{ like?: string }> }
    expect(parsed.patterns.length).toBeGreaterThan(0)

    const catalog = await client.callTool({
      name: 'catalog',
      arguments: { from: REPOSITORY, kind: 'page' },
    })
    expect(catalog.isError, textOf(catalog as never)).toBeFalsy()
    const items = textOf(catalog as never)
      .trimEnd()
      .split('\n')
    expect(items.at(-1)).toMatch(/^\d+ itens?\.$/)
    const rows = items.slice(0, -1).filter((line) => line !== '')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((line) => / — page — /.test(line))).toBe(true)
  })

  it('cada chamada é isolada: a saída de uma não aparece na seguinte', async () => {
    const root = makeProject()
    const client = await connect({ cwd: root })

    const first = textOf(
      (await client.callTool({
        name: 'make_page',
        arguments: { nome: 'produtos', like: 'products-list', 'dry-run': true },
      })) as never,
    )
    const second = textOf((await client.callTool({ name: 'check', arguments: {} })) as never)

    expect(first).toContain('produtos')
    expect(second).toBe('prumo check: nenhuma violação.\n')
  })

  it('chamadas simultâneas rodam uma de cada vez: duas telas, as duas rotas no App.tsx', async () => {
    const root = makeProject()
    const client = await connect({ cwd: root })
    const [a, b] = await Promise.all([
      client.callTool({ name: 'make_page', arguments: { nome: 'alfa', like: 'products-list' } }),
      client.callTool({ name: 'make_page', arguments: { nome: 'beta', like: 'products-list' } }),
    ])

    expect(a.isError, textOf(a as never)).toBeFalsy()
    expect(b.isError, textOf(b as never)).toBeFalsy()
    const app = read(root, 'src/App.tsx')
    expect(app).toContain('/alfa')
    expect(app).toContain('/beta')
  })

  it('o root é relativo à pasta do servidor: uma subpasta é aceita', async () => {
    const parent = makeDir()
    const root = path.join(parent, 'app')
    mkdirSync(root)
    // O projeto de fixture dentro de uma subpasta do cwd do servidor
    cpSync(makeProject(), root, { recursive: true })
    const client = await connect({ cwd: parent })

    const result = await client.callTool({ name: 'check', arguments: { root: 'app' } })
    expect(result.isError, textOf(result as never)).toBeFalsy()
  })
})

describe('o root e o dir ficam dentro da pasta do servidor', () => {
  it('recusa, sem rodar o comando, o que sai da pasta', async () => {
    const parent = makeDir()
    const cwd = path.join(parent, 'servidor')
    mkdirSync(cwd)
    const client = await connect({ cwd })

    for (const call of [
      { name: 'check', arguments: { root: '/' } },
      { name: 'check', arguments: { root: '..' } },
      { name: 'make_page', arguments: { nome: 'x', root: '../outro' } },
      { name: 'new', arguments: { nome: 'loja', dir: '..', 'dry-run': true, from: REPOSITORY } },
      { name: 'new', arguments: { nome: 'loja', dir: parent, 'dry-run': true, from: REPOSITORY } },
    ]) {
      const result = await client.callTool(call)
      const text = textOf(result as never)
      expect(result.isError, call.name).toBe(true)
      expect(text, call.name).toContain('fica fora da pasta do servidor')
      expect(text, call.name).toContain('[saída 2]')
      // O comando não rodou: nenhum texto da CLI
      expect(text, call.name).not.toMatch(/^prumo \S+:/)
    }
  })

  it('recusa um link simbólico que aponta para fora', async () => {
    const parent = makeDir()
    const cwd = path.join(parent, 'servidor')
    mkdirSync(cwd)
    const outside = makeProject()
    symlinkSync(outside, path.join(cwd, 'atalho'))
    const client = await connect({ cwd })

    const result = await client.callTool({ name: 'check', arguments: { root: 'atalho' } })
    expect(result.isError).toBe(true)
    expect(textOf(result as never)).toContain('fica fora da pasta do servidor')
  })

  it('aceita o que fica dentro, inclusive uma pasta que ainda não existe (new --dir)', async () => {
    const cwd = makeDir()
    const client = await connect({ cwd })
    const result = await client.callTool({
      name: 'new',
      arguments: {
        nome: 'loja',
        dir: 'produtos/novos',
        'dry-run': true,
        install: false,
        from: REPOSITORY,
      },
    })

    expect(result.isError, textOf(result as never)).toBeFalsy()
    expect(textOf(result as never)).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(exists(cwd, 'produtos')).toBe(false)
  })
})
