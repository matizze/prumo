import { existsSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemods/test-support.ts'
import { exec, makeDir } from '../test-support.ts'

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

/** Um projeto de fixture com o schema, o repositório e a query (`make:query`) de um domínio. */
async function withQuery(args: string[] = ['clientes'], schemaArgs: string[] = []) {
  const { root } = fixtureProject()
  for (const command of ['make:schema', 'make:repository', 'make:query']) {
    const made = await exec([command, ...args, ...(command === 'make:schema' ? schemaArgs : [])], root)
    expect(made.code, made.stderr).toBe(0)
  }
  return root
}

describe('prumo make:page', () => {
  it('só o título: cria a tela, registra tudo e diz como rodar os testes', async () => {
    const { root } = fixtureProject()
    const result = await exec(['make:page', 'pedidos-recentes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('prumo make:page: pedidos-recentes (rota /pedidos-recentes).')
    expect(result.stdout).toContain('Criados (6):')
    expect(result.stdout).toContain('Alterados (3):')
    expect(result.stdout).toContain('Para rodar os testes da tela nova:\n  pnpm exec vitest run src/pages/pedidos-recentes\n')
    expect(read(root, 'src/App.tsx')).toContain('<Route path="/pedidos-recentes">')
    expect(read(root, 'src/messages/pt-BR/index.ts')).toContain('pedidosRecentes')
  })

  it('com --query e --path: o detalhe da entidade do contrato, sem --entity', async () => {
    const root = await withQuery(['paes', '--entity', 'pao'])
    const result = await exec(['make:page', 'pao', '--query', 'paes', '--path', '/paes/:id'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('prumo make:page: pao (rota /paes/:id, query paes).')
    expect(read(root, 'src/pages/pao/model.ts')).toContain('usePaoDetail(id)')
    expect(JSON.parse(read(root, 'src/messages/en/pao.json'))).toHaveProperty('loading')
  })

  it('com --query: a lista, com o campo de texto do schema', async () => {
    const root = await withQuery()
    const result = await exec(['make:page', 'clientes', '--query', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(read(root, 'src/pages/clientes/view.tsx')).toContain('{i.name}')
    expect(read(root, 'src/pages/clientes/model.ts')).toContain('useClientesList()')
  })

  it('sem campo de texto: mostra o id e escreve o aviso, com saída 0', async () => {
    const root = await withQuery(['clientes'], ['--fields', 'idade:int'])
    const result = await exec(['make:page', 'clientes', '--query', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('Aviso: o schema do domínio (src/schemas/entities/cliente.ts) não tem campo de texto')
    expect(read(root, 'src/pages/clientes/view.tsx')).toContain('{i.id}')
  })

  it('--query sem a query: saída 2, a dica, e nada criado', async () => {
    const { root } = fixtureProject()
    const result = await exec(['make:page', 'clientes', '--query', 'clientes'], root)

    expect(result.code).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('rode prumo make:query clientes')
    expect(existsSync(path.join(root, 'src/pages/clientes'))).toBe(false)
  })

  it('--path inválido: saída 2, em português, e nada criado', async () => {
    const { root } = fixtureProject()
    const before = read(root, 'src/App.tsx')
    for (const [route, reason] of [
      ['clientes', 'precisa começar com /'],
      ['/clientes/:id?', 'modificador do wouter'],
      ['/a/:x/:y', '2 parâmetros'],
    ] as const) {
      const result = await exec(['make:page', 'clientes', '--path', route], root)
      expect(result.code).toBe(2)
      expect(result.stderr).toContain(reason)
    }
    expect(existsSync(path.join(root, 'src/pages/clientes'))).toBe(false)
    expect(read(root, 'src/App.tsx')).toBe(before)
  })

  it('--path ou --query vazio: saída 2', async () => {
    const { root } = fixtureProject()
    expect((await exec(['make:page', 'a', '--path', ''], root)).code).toBe(2)
    expect((await exec(['make:page', 'a', '--query', ''], root)).code).toBe(2)
  })

  it('--dry-run: lista o que seria feito e não escreve nada', async () => {
    const { root } = fixtureProject()
    const before = read(root, 'src/App.tsx')
    const result = await exec(['make:page', 'sobre', '--dry-run'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('(simulação)')
    expect(result.stdout).toContain('Seriam criados (6):')
    expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(existsSync(path.join(root, 'src/pages/sobre'))).toBe(false)
    expect(read(root, 'src/App.tsx')).toBe(before)
  })

  it('a mesma tela duas vezes, nome reservado e rota repetida: saída 2', async () => {
    const { root } = fixtureProject()
    expect((await exec(['make:page', 'sobre'], root)).code).toBe(0)
    const again = await exec(['make:page', 'sobre'], root)
    expect(again.code).toBe(2)
    expect(again.stderr).toContain("a tela 'sobre' já existe")

    expect((await exec(['make:page', 'new'], root)).code).toBe(2)
    const taken = await exec(['make:page', 'outra', '--path', '/sobre'], root)
    expect(taken.code).toBe(2)
    expect(taken.stderr).toContain("já tem uma rota '/sobre'")
    expect(existsSync(path.join(root, 'src/pages/outra'))).toBe(false)
  })

  it('--path que conflita com uma rota de parâmetro do App.tsx: saída 2 e nada escrito', async () => {
    const { root } = fixtureProject()
    expect((await exec(['make:page', 'clientes', '--path', '/clientes/:id'], root)).code).toBe(0)
    const app = read(root, 'src/App.tsx')
    const result = await exec(['make:page', 'novo', '--path', '/clientes/novo'], root)

    expect(result.code).toBe(2)
    expect(result.stderr).toContain("conflita com a rota '/clientes/:id'")
    expect(existsSync(path.join(root, 'src/pages/novo'))).toBe(false)
    expect(read(root, 'src/App.tsx')).toBe(app)
  })

  it('o comando dos testes usa o script test do projeto e a pasta dele, de fora', async () => {
    const { root } = fixtureProject()
    writeFileSync(path.join(root, 'package.json'), '{ "name": "app", "scripts": { "test": "vitest run" } }\n')
    const result = await exec(['make:page', 'sobre', '--root', root], path.dirname(root))

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain(`pnpm --dir ${path.basename(root)} test src/pages/sobre`)
  })
})

describe('prumo make:page com link simbólico para fora do projeto', () => {
  it('sai com 2, diz qual é o link, sem a ajuda, e não escreve nada, nem dentro nem fora', async () => {
    const { root } = fixtureProject()
    const outside = makeDir()
    symlinkSync(outside, path.join(root, 'src/pages'))
    const app = readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
    const result = await exec(['make:page', 'sobre'], root)
    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(/'src\/pages\/sobre\/index.tsx' levaria a escrita para fora do projeto: 'src\/pages' é um link simbólico/)
    expect(result.stderr).not.toContain('Uso: prumo make:page')
    expect(readdirSync(outside)).toEqual([])
    expect(readFileSync(path.join(root, 'src/App.tsx'), 'utf8')).toBe(app)
  })
})
