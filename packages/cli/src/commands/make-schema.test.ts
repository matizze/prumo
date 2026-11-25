import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../test/fixture-project.ts'
import { makeDir } from '../test/fs.ts'
import { exec } from '../test/run.ts'

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

describe('prumo make:schema', () => {
  it('cria o schema e registra no índice, e diz o próximo passo', async () => {
    const { root } = fixtureProject()
    const result = await exec(['make:schema', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('prumo make:schema: clientes (entidade cliente).')
    expect(result.stdout).toContain(
      'Entidade: cliente (derivada de clientes; use --entity para trocar).',
    )
    expect(result.stdout).toContain('Campos: name (string).')
    expect(result.stdout).toContain('Criados (1):\n  src/schemas/entities/cliente.ts')
    expect(result.stdout).toContain('Alterados (1):\n  src/schemas/index.ts')
    expect(result.stdout).toContain('Próximo passo: prumo make:usecase clientes --crud')
    expect(read(root, 'src/schemas/entities/cliente.ts')).toContain('clienteSchema')
    expect(read(root, 'src/schemas/index.ts')).toContain("export * from './entities/cliente'")
  })

  it('--fields e --entity: os campos e a entidade, e o próximo passo repete a entidade', async () => {
    const { root } = fixtureProject()
    const result = await exec(
      ['make:schema', 'paes', '--entity', 'pao', '--fields', 'nome:string,peso?:int,tipo:enum(a|b)'],
      root,
    )

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('Campos: nome (string), peso (int, opcional), tipo (enum(a|b)).')
    expect(result.stdout).toContain('Entidade: pao (--entity).')
    expect(result.stdout).toContain('Próximo passo: prumo make:usecase paes --crud --entity pao')
    expect(read(root, 'src/schemas/entities/pao.ts')).toContain('  peso: z.number().int().optional(),')
  })

  it('a entidade derivada só tira o s, e a saída avisa: fornecedores vira fornecedore', async () => {
    const { root } = fixtureProject()
    const result = await exec(['make:schema', 'fornecedores'], root)
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain(
      'Entidade: fornecedore (derivada de fornecedores; use --entity para trocar).',
    )
    expect(existsSync(path.join(root, 'src/schemas/entities/fornecedore.ts'))).toBe(true)
  })

  it('o próximo passo traz o --entity quando a entidade não é a derivada', async () => {
    const { root } = fixtureProject()
    const result = await exec(['make:schema', 'categories', '--entity', 'category'], root)
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('Próximo passo: prumo make:usecase categories --crud --entity category')
  })

  it('--root aponta para o projeto', async () => {
    const { root } = fixtureProject()
    const result = await exec(['make:schema', 'clientes', '--root', root], makeDir())
    expect(result.code, result.stderr).toBe(0)
    expect(existsSync(path.join(root, 'src/schemas/entities/cliente.ts'))).toBe(true)
  })

  it('--dry-run mostra o plano e não escreve nada', async () => {
    const { root } = fixtureProject()
    const before = read(root, 'src/schemas/index.ts')
    const result = await exec(['make:schema', 'clientes', '--dry-run'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('(simulação)')
    expect(result.stdout).toContain('Seriam criados (1):')
    expect(result.stdout).toContain('Seriam alterados (1):')
    expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(existsSync(path.join(root, 'src/schemas/entities/cliente.ts'))).toBe(false)
    expect(read(root, 'src/schemas/index.ts')).toBe(before)
  })

  it.each([
    [['make:schema', 'Clientes'], /o nome do domínio 'Clientes' é inválido/],
    [['make:schema', 'categories'], /--entity category/],
    [['make:schema', 'clientes', '--entity', 'Cliente'], /a entidade 'Cliente' é inválido/],
    [['make:schema', 'clientes', '--entity', ''], /a opção '--entity' precisa de um valor/],
    [['make:schema', 'clientes', '--fields', 'a:text'], /--fields 'a:text' é inválido/],
    [['make:schema', 'clientes', '--fields', ''], /--fields '' é inválido/],
    [['make:schema', 'clientes', '--fields', 'a:string,a:int'], /aparece mais de uma vez/],
    [['make:schema', 'new', '--entity', 'novo'], /palavra reservada/],
    [['make:schema'], /falta o argumento/],
    [['make:schema', 'clientes', '--nada'], /opção desconhecida/],
  ])('%j sai com 2, em português, sem escrever nada', async (argv, message) => {
    const { root } = fixtureProject()
    const before = read(root, 'src/schemas/index.ts')
    const result = await exec(argv, root)

    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(message)
    expect(result.stdout).toBe('')
    expect(existsSync(path.join(root, 'src/schemas/entities'))).toBe(false)
    expect(read(root, 'src/schemas/index.ts')).toBe(before)
  })

  it('o mesmo schema duas vezes: a segunda sai com 2 e não muda nada', async () => {
    const { root } = fixtureProject()
    expect((await exec(['make:schema', 'clientes'], root)).code).toBe(0)
    const after = read(root, 'src/schemas/index.ts')
    const again = await exec(['make:schema', 'clientes', '--fields', 'a:int'], root)

    expect(again.code).toBe(2)
    expect(again.stderr).toContain("o schema 'cliente' já existe")
    expect(read(root, 'src/schemas/index.ts')).toBe(after)
    expect(read(root, 'src/schemas/entities/cliente.ts')).toContain('name: z.string()')
  })

  it('fora de um projeto sai com 2', async () => {
    const result = await exec(['make:schema', 'clientes'], makeDir())
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('nenhum projeto Prumo achado a partir de')
  })
})
