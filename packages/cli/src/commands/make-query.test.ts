import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemods/test-support.ts'
import { exec } from '../test-support.ts'

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

/** Um projeto de fixture com o schema e o repositório `clientes` já gerados pelos comandos. */
async function withRepository(args: string[] = ['clientes']) {
  const { root } = fixtureProject()
  for (const command of ['make:schema', 'make:repository']) {
    const made = await exec([command, ...args], root)
    expect(made.code, made.stderr).toBe(0)
  }
  return root
}

describe('prumo make:query', () => {
  it('cria as queries, registra no índice e diz o próximo passo', async () => {
    const root = await withRepository()
    const result = await exec(['make:query', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('prumo make:query: clientes (entidade cliente).')
    expect(result.stdout).toContain('Criados (1):\n  src/queries/clientes.ts')
    expect(result.stdout).toContain('Alterados (1):\n  src/queries/index.ts')
    expect(result.stdout).toContain('Próximo passo: prumo make:page clientes --query clientes\n')
    expect(read(root, 'src/queries/clientes.ts')).toContain('export function useClientesList(')
    expect(read(root, 'src/queries/index.ts')).toContain(
      "export { clienteKeys, clienteQueries, useClientesList, useClienteDetail, useCreateCliente, useUpdateCliente, useRemoveCliente } from './clientes'",
    )
  })

  it('com --entity, usa a entidade nos nomes', async () => {
    const root = await withRepository(['paes', '--entity', 'pao'])
    const result = await exec(['make:query', 'paes', '--entity', 'pao'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(read(root, 'src/queries/paes.ts')).toContain('export const paoKeys')
    expect(read(root, 'src/queries/paes.ts')).toContain('export function usePaesList(')
  })

  it('sem o repositório: saída 2, a dica, e nada criado', async () => {
    const { root } = fixtureProject()
    const result = await exec(['make:query', 'paes', '--entity', 'pao'], root)

    expect(result.code).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('falta o repositório paes (src/repositories/paes); rode prumo make:repository paes --entity pao.')
    expect(existsSync(path.join(root, 'src/queries/paes.ts'))).toBe(false)
  })

  it('a mesma query duas vezes: a segunda sai com 2 e não muda nada', async () => {
    const root = await withRepository()
    expect((await exec(['make:query', 'clientes'], root)).code).toBe(0)
    const index = read(root, 'src/queries/index.ts')

    const again = await exec(['make:query', 'clientes'], root)

    expect(again.code).toBe(2)
    expect(again.stderr).toContain("a query 'clientes' já existe")
    expect(read(root, 'src/queries/index.ts')).toBe(index)
  })

  it('--dry-run lista o plano e não escreve nada', async () => {
    const root = await withRepository()
    const before = read(root, 'src/queries/index.ts')
    const result = await exec(['make:query', 'clientes', '--dry-run'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('(simulação)')
    expect(result.stdout).toContain('nada foi escrito')
    expect(existsSync(path.join(root, 'src/queries/clientes.ts'))).toBe(false)
    expect(read(root, 'src/queries/index.ts')).toBe(before)
  })

  it('--entity vazio e --root vazio saem com 2', async () => {
    const root = await withRepository()
    expect((await exec(['make:query', 'clientes', '--entity', ''], root)).code).toBe(2)
    expect((await exec(['make:query', 'clientes', '--root', ''], root)).code).toBe(2)
  })

  it('sem o src/queries/index.ts: saída 2 e nada criado', async () => {
    const root = await withRepository()
    const { rmSync } = await import('node:fs')
    rmSync(path.join(root, 'src/queries/index.ts'))
    const result = await exec(['make:query', 'clientes'], root)
    expect(result.code).toBe(2)
    expect(result.stderr).toContain('src/queries/index.ts')
    expect(existsSync(path.join(root, 'src/queries/clientes.ts'))).toBe(false)
  })
})
