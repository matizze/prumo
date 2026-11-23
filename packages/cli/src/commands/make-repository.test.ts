import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemods/test-support.ts'
import { exec } from '../test-support.ts'

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

/** Um projeto de fixture com o schema `clientes` já gerado pelo comando. */
async function withSchema(args: string[] = ['clientes']) {
  const { root } = fixtureProject()
  const made = await exec(['make:schema', ...args], root)
  expect(made.code, made.stderr).toBe(0)
  return root
}

describe('prumo make:repository', () => {
  it('cria o repositório, registra no container e diz o próximo passo', async () => {
    const root = await withSchema()
    const result = await exec(['make:repository', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('prumo make:repository: clientes (entidade cliente, fonte mock).')
    expect(result.stdout).toContain('Campos (lidos do schema): name (string).')
    expect(result.stdout).toContain('Criados (5):\n  src/repositories/clientes/fixtures.ts')
    expect(result.stdout).toContain('Alterados (1):\n  src/repositories/index.ts')
    expect(result.stdout).toContain('Próximo passo: prumo make:query clientes\n')
    expect(read(root, 'src/repositories/clientes/index.ts')).toContain('createClientesRepository')
    expect(read(root, 'src/repositories/index.ts')).toContain('  clientes: createClientesRepository,')
  })

  it('sem o schema: saída 2, a dica, e nada criado', async () => {
    const { root } = fixtureProject()
    const result = await exec(['make:repository', 'paes', '--entity', 'pao'], root)

    expect(result.code).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('falta o schema paes (src/schemas/entities/pao.ts); rode prumo make:schema paes --entity pao.')
    expect(existsSync(path.join(root, 'src/repositories/paes'))).toBe(false)
  })

  it('o mesmo repositório duas vezes: a segunda sai com 2 e não muda nada', async () => {
    const root = await withSchema()
    expect((await exec(['make:repository', 'clientes'], root)).code).toBe(0)
    const container = read(root, 'src/repositories/index.ts')

    const again = await exec(['make:repository', 'clientes'], root)

    expect(again.code).toBe(2)
    expect(again.stderr).toContain("o repositório 'clientes' já existe")
    expect(read(root, 'src/repositories/index.ts')).toBe(container)
  })

  it('--dry-run lista o plano e não escreve nada', async () => {
    const root = await withSchema()
    const result = await exec(['make:repository', 'clientes', '--dry-run'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('(simulação)')
    expect(result.stdout).toContain('Seriam criados (5):')
    expect(result.stdout).toContain('Seriam alterados (1):')
    expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(existsSync(path.join(root, 'src/repositories/clientes'))).toBe(false)
  })

  it('um campo novo de tipo reconhecido, posto à mão no schema, entra no mock', async () => {
    const root = await withSchema()
    const file = path.join(root, 'src/schemas/entities/cliente.ts')
    writeFileSync(file, read(root, 'src/schemas/entities/cliente.ts').replace('  name: z.string(),', '  name: z.string(),\n  idade: z.number().int(),'))

    const result = await exec(['make:repository', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('Campos (lidos do schema): name (string), idade (int).')
    expect(read(root, 'src/repositories/clientes/fixtures.ts')).toContain('idade:')
    expect(read(root, 'src/repositories/clientes/repository.mock.ts')).toContain('idade: input.idade,')
  })

  it('avisa quando o app não tem o errors.json, e acrescenta a chave quando tem', async () => {
    const root = await withSchema()
    const warned = await exec(['make:repository', 'clientes', '--dry-run'], root)
    expect(warned.stdout).toContain('Aviso: o texto de CLIENTE_NOT_FOUND não foi acrescentado')

    writeFileSync(path.join(root, 'src/messages/pt-BR/errors.json'), '{}\n')
    writeFileSync(path.join(root, 'src/messages/en/errors.json'), '{}\n')
    const done = await exec(['make:repository', 'clientes'], root)
    expect(done.code, done.stderr).toBe(0)
    expect(done.stdout).not.toContain('Aviso')
    expect(done.stdout).toContain('src/messages/pt-BR/errors.json')
    expect(JSON.parse(read(root, 'src/messages/en/errors.json'))).toEqual({ CLIENTE_NOT_FOUND: 'Record not found.' })
  })

  it('recusa --entity e --root vazios, e opção desconhecida (a do passo seguinte), com 2', async () => {
    const root = await withSchema()
    expect((await exec(['make:repository', 'clientes', '--entity', ' '], root)).code).toBe(2)
    expect((await exec(['make:repository', 'clientes', '--root', ''], root)).code).toBe(2)
    expect((await exec(['make:repository', 'clientes', '--data-source', 'mock'], root)).code).toBe(2)
    expect((await exec(['make:repository'], root)).code).toBe(2)
  })

  it('--root aponta para o projeto', async () => {
    const root = await withSchema()
    const outside = path.dirname(root)
    const result = await exec(['make:repository', 'clientes', '--root', root], outside)
    expect(result.code, result.stderr).toBe(0)
    expect(existsSync(path.join(root, 'src/repositories/clientes/index.ts'))).toBe(true)
  })
})
