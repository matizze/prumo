import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import { createServer } from './server.ts'
import { connect, makeDir, makeProject, textOf } from './test-support.ts'

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
      'check',
      'doctor',
      'make_component',
      'make_domain',
      'make_page',
      'new',
    ])
    const check = tools.find((tool) => tool.name === 'check')
    expect(check?.description).toContain('Analisa o projeto')
    expect(check?.inputSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: { root: { type: 'string' } },
    })
    expect(check?.inputSchema.required).toBeUndefined()
  })
})

describe('as chamadas', () => {
  it('check num projeto limpo devolve o texto da CLI, sem erro', async () => {
    const client = await connect({ cwd: makeProject() })
    const result = await client.callTool({ name: 'check', arguments: {} })

    expect(result.isError).toBeFalsy()
    expect(textOf(result as never)).toBe('prumo check: nenhuma violação.\n')
  })

  it('check num projeto com violação é erro da ferramenta, com as violações e o código de saída', async () => {
    const client = await connect({ cwd: makeProject({ broken: true }) })
    const result = await client.callTool({ name: 'check', arguments: {} })

    expect(result.isError).toBe(true)
    const text = textOf(result as never)
    expect(text).toContain('src/pages/solta')
    expect(text).toContain('prumo check: 2 violações.')
    expect(text.endsWith('\n[saída 1]')).toBe(true)
  })

  it('doctor devolve o relatório na resposta', async () => {
    const client = await connect({ cwd: makeProject() })
    const result = await client.callTool({ name: 'doctor', arguments: {} })

    expect(textOf(result as never)).toMatch(/Node: .*\nprumo doctor: /s)
  })

  describe('make_domain, a ferramenta que vem da árvore da CLI', () => {
    /** Um projeto com os três índices de um app novo, sem domínios. */
    function appProject(inside: string): string {
      const root = makeProject({ inside })
      const write = (file: string, content: string) => {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
        writeFileSync(path.join(root, file), content)
      }
      write('src/schemas/index.ts', "export * from '@matizze/prumo-core/data'\n")
      write('src/queries/index.ts', '// Queries, uma por domínio.\n')
      write(
        'src/repositories/index.ts',
        "import { createRepositoryContainer } from '@matizze/prumo-core/repositories'\nconst factories = {}\nexport const container = createRepositoryContainer(factories, { dataSource: 'memory' })\n",
      )
      return root
    }

    it('tem o esquema do comando: o nome obrigatório, a entidade, os campos, o root e o dry-run', async () => {
      const client = await connect({ cwd: makeProject() })
      const { tools } = await client.listTools()
      const tool = tools.find((candidate) => candidate.name === 'make_domain')

      expect(tool?.description).toContain('Gera um domínio de dados novo')
      expect(tool?.inputSchema).toMatchObject({
        type: 'object',
        required: ['nome'],
        properties: {
          nome: { type: 'string' },
          entity: { type: 'string' },
          fields: { type: 'string' },
          root: { type: 'string' },
          'dry-run': { type: 'boolean' },
        },
      })
    })

    it('gera o domínio com os campos de fields, e recusa o que o --fields recusa', async () => {
      const parent = makeDir()
      const root = appProject(parent)
      const client = await connect({ cwd: parent })

      const bad = await client.callTool({
        name: 'make_domain',
        arguments: { nome: 'livros', root, fields: 'id:string' },
      })
      expect(bad.isError).toBe(true)
      expect(textOf(bad as never)).toContain("'id' é reservado")
      expect(existsSync(path.join(root, 'src/repositories/livros'))).toBe(false)

      const result = await client.callTool({
        name: 'make_domain',
        arguments: { nome: 'livros', root, fields: 'titulo:string,ano:number,apelido?:string' },
      })
      expect(result.isError).toBeFalsy()
      expect(textOf(result as never)).toContain('Campos: titulo (string), ano (number), apelido (string, opcional).')
      const schema = readFileSync(path.join(root, 'src/schemas/entities/livro.ts'), 'utf8')
      expect(schema).toContain('  ano: z.number(),')
      expect(schema).not.toContain('name')
    })

    it('gera o domínio no projeto e devolve o texto da CLI', async () => {
      const parent = makeDir()
      const root = appProject(parent)
      const client = await connect({ cwd: parent })

      const dry = await client.callTool({
        name: 'make_domain',
        arguments: { nome: 'clientes', root, 'dry-run': true },
      })
      expect(dry.isError).toBeFalsy()
      expect(textOf(dry as never)).toContain('Seriam criados (7):')
      expect(existsSync(path.join(root, 'src/repositories/clientes'))).toBe(false)

      const result = await client.callTool({
        name: 'make_domain',
        arguments: { nome: 'clientes', root },
      })
      expect(result.isError).toBeFalsy()
      expect(textOf(result as never)).toContain('prumo check: nenhuma violação.')
      expect(existsSync(path.join(root, 'src/repositories/clientes/repository.mock.ts'))).toBe(true)

      const again = await client.callTool({
        name: 'make_domain',
        arguments: { nome: 'clientes', root },
      })
      expect(again.isError).toBe(true)
      expect(textOf(again as never)).toContain("o domínio 'clientes' já existe")
      expect(textOf(again as never).endsWith('[saída 2]')).toBe(true)
    })

    it('recusa a pasta fora da pasta do servidor, e não escreve', async () => {
      const parent = makeDir()
      const outside = appProject(makeDir())
      const client = await connect({ cwd: parent })

      const result = await client.callTool({
        name: 'make_domain',
        arguments: { nome: 'clientes', root: outside },
      })

      expect(result.isError).toBe(true)
      expect(existsSync(path.join(outside, 'src/repositories/clientes'))).toBe(false)
    })
  })

  it('uso errado do comando vira isError com a mensagem da CLI e [saída 2]', async () => {
    const client = await connect({ cwd: makeProject() })
    const result = await client.callTool({
      name: 'check',
      arguments: { root: 'nao-existe' },
    })

    expect(result.isError).toBe(true)
    const text = textOf(result as never)
    expect(text).toMatch(/^prumo check: a pasta .* não existe\./)
    expect(text.endsWith('[saída 2]')).toBe(true)
  })

  it('entrada que o esquema recusa volta como isError, sem rodar o comando', async () => {
    const client = await connect({ cwd: makeProject() })

    const unknown = await client.callTool({ name: 'check', arguments: { bogus: 1 } })
    expect(unknown.isError).toBe(true)
    expect(textOf(unknown as never)).toContain('bogus')

    const empty = await client.callTool({ name: 'check', arguments: { root: '' } })
    expect(empty.isError).toBe(true)
    expect(textOf(empty as never)).toContain('não pode ser vazio')

    const wrongType = await client.callTool({ name: 'check', arguments: { root: 1 } })
    expect(wrongType.isError).toBe(true)
  })

  it('cada chamada é isolada: a saída de uma não aparece na seguinte', async () => {
    const parent = makeDir()
    const client = await connect({ cwd: parent })
    const broken = makeProject({ broken: true, inside: parent })
    const clean = makeProject({ inside: parent })

    const first = textOf(
      (await client.callTool({ name: 'check', arguments: { root: broken } })) as never,
    )
    const second = textOf(
      (await client.callTool({ name: 'check', arguments: { root: clean } })) as never,
    )

    expect(first).toContain('src/pages/solta')
    expect(second).toBe('prumo check: nenhuma violação.\n')
  })

  it('chamadas simultâneas voltam cada uma com o próprio resultado', async () => {
    const parent = makeDir()
    const clean = makeProject({ inside: parent })
    const broken = makeProject({ broken: true, inside: parent })
    const client = await connect({ cwd: parent })
    const [good, bad] = await Promise.all([
      client.callTool({ name: 'check', arguments: { root: clean } }),
      client.callTool({ name: 'check', arguments: { root: broken } }),
    ])

    expect(good.isError).toBeFalsy()
    expect(textOf(good as never)).toBe('prumo check: nenhuma violação.\n')
    expect(bad.isError).toBe(true)
    expect(textOf(bad as never)).toContain('src/pages/solta')
  })

  it('o root é relativo à pasta do servidor: uma subpasta é aceita', async () => {
    const parent = makeDir()
    const child = path.join(parent, 'filho')
    mkdirSync(path.join(child, 'src'), { recursive: true })
    writeFileSync(path.join(child, 'package.json'), '{}\n')
    const client = await connect({ cwd: parent })

    const result = await client.callTool({ name: 'check', arguments: { root: 'filho' } })

    expect(result.isError, textOf(result as never)).toBeFalsy()
  })
})

describe('o root e o dir ficam dentro da pasta do servidor', () => {
  it('recusa, sem rodar o comando, o que sai da pasta', async () => {
    const parent = makeDir()
    const cwd = path.join(parent, 'servidor')
    mkdirSync(cwd)
    const client = await connect({ cwd })

    for (const root of ['/', '..', '../outro', parent]) {
      const result = await client.callTool({ name: 'check', arguments: { root } })
      const text = textOf(result as never)
      expect(result.isError, root).toBe(true)
      expect(text, root).toContain('fica fora da pasta do servidor')
      expect(text, root).toContain('[saída 2]')
      // O comando não rodou: nenhum texto da CLI
      expect(text, root).not.toMatch(/^prumo \S+:/)
    }
  })

  it('vale para o dir de qualquer comando, não só para o root', async () => {
    const cwd = makeDir()
    const { tools } = await createServer({
      cwd,
      commands: [
        {
          name: 'make:thing',
          path: ['make:thing'],
          toolName: 'make_thing',
          summary: 'Gera.',
          description: 'Gera.',
          options: [
            {
              name: 'dir',
              kind: 'string',
              required: false,
              variadic: false,
              description: 'A pasta.',
              aliases: [],
            },
          ],
        },
      ],
    })

    const result = await tools[0]!.call({ dir: '..' })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain("o campo 'dir' ('..') fica fora da pasta do servidor")
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
  describe('a ferramenta new', () => {
    it('cria o app dentro da pasta do servidor, sem escrever no stdout do processo', async () => {
      const cwd = makeDir()
      const client = await connect({ cwd })

      const result = await client.callTool({
        name: 'new',
        arguments: { nome: 'meu-app', dir: 'apps', install: false },
      })
      expect(result.isError, textOf(result as never)).toBe(false)
      expect(textOf(result as never)).toContain('prumo new: meu-app.')
      expect(existsSync(path.join(cwd, 'apps/meu-app/src/pages/home/view.tsx'))).toBe(true)
      expect(existsSync(path.join(cwd, 'apps/meu-app/.mcp.json'))).toBe(true)

      // E as outras ferramentas já enxergam o app novo
      const check = await client.callTool({
        name: 'check',
        arguments: { root: 'apps/meu-app' },
      })
      expect(check.isError, textOf(check as never)).toBe(false)
    })

    it('recusa o dir fora da pasta do servidor, e não escreve', async () => {
      const parent = makeDir()
      const cwd = path.join(parent, 'servidor')
      mkdirSync(cwd)
      const client = await connect({ cwd })

      const result = await client.callTool({
        name: 'new',
        arguments: { nome: 'meu-app', dir: '..', install: false },
      })
      expect(result.isError).toBe(true)
      expect(textOf(result as never)).toContain(
        "o campo 'dir' ('..') fica fora da pasta do servidor",
      )
      expect(existsSync(path.join(parent, 'meu-app'))).toBe(false)
    })

    it('o nome inválido volta como erro de uso, com [saída 2]', async () => {
      const client = await connect({ cwd: makeDir() })
      const result = await client.callTool({
        name: 'new',
        arguments: { nome: 'Meu App', install: false },
      })
      expect(result.isError).toBe(true)
      expect(textOf(result as never)).toMatch(/kebab-case[\s\S]*\[saída 2\]$/)
    })
  })
})
