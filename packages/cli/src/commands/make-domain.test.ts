import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemod/test-support.ts'
import { createRoot } from '../root.ts'
import { runCli } from '../run.ts'
import { captureRuntime, makeDir } from '../test-support.ts'

async function run(args: string[], cwd: string) {
  const runtime = captureRuntime(cwd)
  const code = await runCli(createRoot(runtime), args, runtime)
  return { code, stdout: runtime.stdout, stderr: runtime.stderr }
}

/** Caminho relativo de cada arquivo da pasta, com o hash do conteúdo, para comparar antes e depois. */
function snapshot(root: string, dir = root): Record<string, string> {
  const result: Record<string, string> = {}
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) Object.assign(result, snapshot(root, full))
    else
      result[path.relative(root, full)] = createHash('sha1')
        .update(readFileSync(full))
        .digest('hex')
  }
  return result
}

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

describe('prumo make:domain', () => {
  it('gera o domínio, registra nos índices, roda o check e mostra como testar', async () => {
    const { root } = fixtureProject()
    const result = await run(['make:domain', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe(`prumo make:domain: clientes (entidade cliente).

Criados (7):
  src/queries/clientes.ts
  src/repositories/clientes/fixtures.ts
  src/repositories/clientes/index.ts
  src/repositories/clientes/repository.contract.test.ts
  src/repositories/clientes/repository.contract.ts
  src/repositories/clientes/repository.mock.ts
  src/schemas/entities/cliente.ts

Alterados (3):
  src/queries/index.ts
  src/repositories/index.ts
  src/schemas/index.ts

prumo check: nenhuma violação.

Edite o schema (src/schemas/entities/cliente.ts) e as fixtures (src/repositories/clientes/fixtures.ts); o teste de contrato acompanha.
As queries importam useRepositories de @/providers/repository, e o projeto não tem src/providers/repository: crie-o com createRepositoryContext, de @matizze/prumo-core/repositories.

Para rodar os testes do domínio novo:
  pnpm exec vitest run src/repositories/clientes
`)
    expect(read(root, 'src/queries/clientes.ts')).toContain(
      "export const clienteKeys = createQueryKeys('clientes', {",
    )
    expect(read(root, 'src/repositories/index.ts')).toContain(
      '  clientes: createClientesRepository,\n  customers: createCustomersRepository,',
    )
  })

  it('usa o script test do projeto, e não avisa do provedor quando ele existe', async () => {
    const { root } = fixtureProject()
    writeFileSync(path.join(root, 'package.json'), '{ "scripts": { "test": "vitest run" } }\n')
    mkdirSync(path.join(root, 'src/providers/repository'), { recursive: true })
    writeFileSync(path.join(root, 'src/providers/repository/index.ts'), 'export {}\n')

    const result = await run(['make:domain', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).not.toContain('providers/repository')
    expect(result.stdout).toContain('\n  pnpm test src/repositories/clientes\n')
  })

  it('--entity dá o singular, e --root aponta o projeto de fora dele', async () => {
    const { root } = fixtureProject()
    const outside = makeDir()
    const result = await run(
      ['make:domain', 'categories', '--entity', 'category', '--root', root],
      outside,
    )

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('prumo make:domain: categories (entidade category).')
    expect(existsSync(path.join(root, 'src/schemas/entities/category.ts'))).toBe(true)
    expect(result.stdout).toContain(
      `pnpm --dir ${root} exec vitest run src/repositories/categories`,
    )
    expect(readdirSync(outside)).toEqual([])
  })

  it('--dry-run lista o que seria feito e não escreve nada', async () => {
    const { root } = fixtureProject()
    const before = snapshot(root)
    const result = await run(['make:domain', 'clientes', '--dry-run'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('Seriam criados (7):\n  src/queries/clientes.ts\n')
    expect(result.stdout).toContain(
      'Seriam alterados (3):\n  src/queries/index.ts\n  src/repositories/index.ts\n  src/schemas/index.ts\n',
    )
    expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(result.stdout).not.toContain('prumo check')
    expect(snapshot(root)).toEqual(before)
  })

  it('o --dry-run também valida: nome inválido sai com 2 e não escreve', async () => {
    const { root } = fixtureProject()
    const before = snapshot(root)
    const result = await run(['make:domain', 'Clientes', '--dry-run'], root)

    expect(result.code).toBe(2)
    expect(snapshot(root)).toEqual(before)
  })

  it('recusa o nome inválido com 2, antes de escrever, e explica', async () => {
    const { root } = fixtureProject()
    const before = snapshot(root)
    const result = await run(['make:domain', 'Meus_Clientes'], root)

    expect(result.code).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain("make:domain: o nome do domínio 'Meus_Clientes' é inválido")
    expect(result.stderr).toContain('Uso: prumo make:domain <nome>')
    expect(snapshot(root)).toEqual(before)
  })

  it('recusa o plural suspeito, sugerindo a entidade', async () => {
    const { root } = fixtureProject()
    const result = await run(['make:domain', 'categories'], root)

    expect(result.code).toBe(2)
    expect(result.stderr).toContain('--entity category')
  })

  it('recusa sobrescrever: o domínio que já existe sai com 2 e não mexe em nada', async () => {
    const { root } = fixtureProject()
    expect((await run(['make:domain', 'clientes'], root)).code).toBe(0)
    const before = snapshot(root)

    const again = await run(['make:domain', 'clientes'], root)

    expect(again.code).toBe(2)
    expect(again.stderr).toContain("o domínio 'clientes' já existe")
    expect(snapshot(root)).toEqual(before)
  })

  it('recusa um arquivo que já existe, mesmo sem o domínio registrado, e não escreve nada', async () => {
    const { root } = fixtureProject()
    mkdirSync(path.join(root, 'src/schemas/entities'), { recursive: true })
    writeFileSync(path.join(root, 'src/schemas/entities/cliente.ts'), 'export const meu = 1\n')
    const before = snapshot(root)

    const result = await run(['make:domain', 'clientes'], root)

    expect(result.code).toBe(2)
    expect(result.stderr).toContain("'src/schemas/entities/cliente.ts' já existe.")
    expect(snapshot(root)).toEqual(before)
  })

  it('um índice que falta sai com 2 e não deixa o projeto pela metade', async () => {
    const { root } = fixtureProject()
    rmSync(path.join(root, 'src/queries/index.ts'))
    const before = snapshot(root)

    const result = await run(['make:domain', 'clientes'], root)

    expect(result.code).toBe(2)
    expect(result.stderr).toContain('o projeto não tem src/queries/index.ts.')
    expect(snapshot(root)).toEqual(before)
  })

  it('uma pasta que não é projeto sai com 2', async () => {
    const result = await run(['make:domain', 'clientes'], makeDir())

    expect(result.code).toBe(2)
    expect(result.stderr).toContain('não tem package.json')
  })

  it('sem o nome ou com opção desconhecida, sai com 2', async () => {
    const { root } = fixtureProject()

    const missing = await run(['make:domain'], root)
    expect(missing.code).toBe(2)
    expect(missing.stderr).toContain('falta o argumento <nome>.')

    const unknown = await run(['make:domain', 'clientes', '--entidade', 'cliente'], root)
    expect(unknown.code).toBe(2)
    expect(unknown.stderr).toContain("opção desconhecida: '--entidade'.")
  })

  it('com violação do check, sai com 1 e o domínio já está gerado', async () => {
    const { root } = fixtureProject()
    // Uma tela sem index nem view: a análise page-structure do check acusa
    mkdirSync(path.join(root, 'src/pages/orfa'), { recursive: true })
    writeFileSync(path.join(root, 'src/pages/orfa/model.ts'), 'export const model = 1\n')

    const result = await run(['make:domain', 'clientes'], root)

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('prumo check: 2 violações (o domínio foi gerado')
    expect(result.stderr).toContain("src/pages/orfa/index.tsx  [page-structure]  A tela 'orfa'")
    expect(result.stdout).toContain('Criados (7):')
    expect(result.stdout).toContain('Para rodar os testes do domínio novo:')
    expect(existsSync(path.join(root, 'src/repositories/clientes/index.ts'))).toBe(true)
  })

  it('a ajuda mostra o uso, as opções e o que o comando gera', async () => {
    const { root } = fixtureProject()
    const help = await run(['make:domain', '--help'], root)

    expect(help.code).toBe(0)
    expect(help.stdout).toContain(
      'Uso: prumo make:domain <nome> [--entity <singular>] [--root <pasta>] [--dry-run]',
    )
    expect(help.stdout).toContain('--dry-run')
    expect(help.stdout).toContain('src/schemas/entities/<entidade>.ts')
    expect(help.stdout).toContain('@matizze/prumo-testing')
  })

  it('aparece na lista de comandos do prumo', async () => {
    const { root } = fixtureProject()
    const help = await run(['--help'], root)

    expect(help.stdout).toMatch(/\n {2}make:domain {2}Gera um domínio de dados novo/)
  })
})
