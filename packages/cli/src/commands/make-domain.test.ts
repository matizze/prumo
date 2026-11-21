import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemod/test-support.ts'
import { createRoot } from '../root.ts'
import { runCli } from '../run.ts'
import { captureRuntime } from '../test-support.ts'

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
  it('gera o domínio, faz as costuras e lista tudo, sem violação do check', async () => {
    const { root } = fixtureProject()
    const result = await run(['make:domain', 'suppliers'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout)
      .toBe(`prumo make:domain: suppliers (entidade supplier), a partir de customers.

Criados (7):
  src/queries/suppliers.ts
  src/repositories/suppliers/fixtures.ts
  src/repositories/suppliers/index.ts
  src/repositories/suppliers/repository.contract.test.ts
  src/repositories/suppliers/repository.contract.ts
  src/repositories/suppliers/repository.mock.ts
  src/schemas/entities/supplier.ts

Alterados (3):
  src/queries/index.ts
  src/repositories/index.ts
  src/schemas/index.ts

prumo check: nenhuma violação.

Os campos e as fixtures são os de customers: edite src/schemas/entities/supplier.ts e src/repositories/suppliers/fixtures.ts. A mensagem de erro do "não encontrado" é "Registro não encontrado.".

Para rodar os testes do domínio novo:
  pnpm exec vitest run src/repositories/suppliers
`)
    expect(read(root, 'src/queries/suppliers.ts')).toContain(
      "export const supplierKeys = createQueryKeys('suppliers', {",
    )
    expect(read(root, 'src/queries/index.ts')).toContain(
      "export { supplierKeys, supplierQueries } from './suppliers'",
    )
    expect(read(root, 'src/repositories/index.ts')).toContain(
      '  suppliers: createSuppliersRepository,\n  support: createSupportRepository,',
    )
    expect(read(root, 'src/schemas/index.ts')).toContain("export * from './entities/supplier'\n")
  })

  it('a mensagem de erro do domínio gerado é a que a saída diz, e não a de customers', async () => {
    const { root } = fixtureProject()
    await run(['make:domain', 'suppliers'], root)

    expect(read(root, 'src/repositories/suppliers/repository.mock.ts')).toContain(
      "'Registro não encontrado.'",
    )
    expect(read(root, 'src/repositories/suppliers/repository.mock.ts')).not.toContain('Cliente')
  })

  it('com registry.json, o item que publica o índice ganha o schema novo, e o arquivo vai na lista de alterados', async () => {
    const { root } = fixtureProject()
    const registry = {
      items: [
        {
          name: 'schemas',
          files: [
            { path: 'src/schemas/index.ts', type: 'registry:lib', target: 'src/schemas/index.ts' },
          ],
        },
      ],
    }
    writeFileSync(path.join(root, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`)

    const dry = await run(['make:domain', 'suppliers', '--dry-run'], root)
    expect(dry.code, dry.stderr).toBe(0)
    expect(dry.stdout).toContain(
      'Seriam alterados (4):\n  registry.json\n  src/queries/index.ts\n  src/repositories/index.ts\n  src/schemas/index.ts\n',
    )
    expect(read(root, 'registry.json')).not.toContain('supplier')

    const result = await run(['make:domain', 'suppliers'], root)
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('Alterados (4):\n  registry.json\n')
    expect(JSON.parse(read(root, 'registry.json')).items[0].files).toEqual([
      {
        path: 'src/schemas/entities/supplier.ts',
        type: 'registry:lib',
        target: 'src/schemas/entities/supplier.ts',
      },
      { path: 'src/schemas/index.ts', type: 'registry:lib', target: 'src/schemas/index.ts' },
    ])
  })

  it('sem registry.json, o registry.json não aparece e nenhum é criado', async () => {
    const { root } = fixtureProject()
    const result = await run(['make:domain', 'suppliers'], root)

    expect(result.stdout).not.toContain('registry.json')
    expect(existsSync(path.join(root, 'registry.json'))).toBe(false)
  })

  it('a ajuda e a saída não dizem que a mensagem de erro é a de customers', async () => {
    const { root } = fixtureProject()
    const help = await run(['make:domain', '--help'], root)

    expect(help.stdout).not.toContain('as fixtures e a mensagem de erro')
    expect(help.stdout).toContain('vira "Registro não encontrado."')
    expect(help.stdout).toContain('registry.json')
  })

  it('mostra o aviso do snapshot das chaves quando o projeto tem o keys.test.ts', async () => {
    const { root } = fixtureProject()
    writeFileSync(path.join(root, 'src/queries/keys.test.ts'), '')
    const result = await run(['make:domain', 'suppliers'], root)

    expect(result.stdout).toContain(
      'As chaves (supplierKeys) não entram sozinhas no snapshot de src/queries/keys.test.ts: acrescente-as à lista de grupos protegidos dele, se quiser congelá-las.\n',
    )
  })

  it('--entity vale mais que a regra do singular', async () => {
    const { root } = fixtureProject()
    const result = await run(['make:domain', 'categories', '--entity', 'category'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('categories (entidade category)')
    expect(read(root, 'src/schemas/entities/category.ts')).toContain('export const categorySchema')
    expect(read(root, 'src/repositories/index.ts')).toContain(
      '  categories: createCategoriesRepository,',
    )
  })

  it('--dry-run lista o que seria criado e alterado e não escreve nada', async () => {
    const { root } = fixtureProject()
    const before = snapshot(root)
    const result = await run(['make:domain', 'suppliers', '--dry-run'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout)
      .toBe(`prumo make:domain: suppliers (entidade supplier), a partir de customers.

Seriam criados (7):
  src/queries/suppliers.ts
  src/repositories/suppliers/fixtures.ts
  src/repositories/suppliers/index.ts
  src/repositories/suppliers/repository.contract.test.ts
  src/repositories/suppliers/repository.contract.ts
  src/repositories/suppliers/repository.mock.ts
  src/schemas/entities/supplier.ts

Seriam alterados (3):
  src/queries/index.ts
  src/repositories/index.ts
  src/schemas/index.ts

Simulação (--dry-run): nada foi escrito.
`)
    expect(snapshot(root)).toEqual(before)
  })

  it('aceita --root, relativo à pasta atual, e mostra o comando com o script de teste do projeto', async () => {
    const { root } = fixtureProject()
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'app', scripts: { test: 'vitest run --project unit' } }),
    )
    const result = await run(
      ['make:domain', 'suppliers', '--root', path.basename(root)],
      path.dirname(root),
    )

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain(
      `Para rodar os testes do domínio novo:\n  pnpm --dir ${path.basename(root)} test src/repositories/suppliers\n`,
    )
  })

  describe('erros de uso, que saem com 2 antes de escrever qualquer coisa', () => {
    const cases: { title: string; args: string[]; reason: string }[] = [
      {
        title: 'nome que não é kebab-case',
        args: ['Fornecedores'],
        reason: "o nome do domínio 'Fornecedores' é inválido",
      },
      {
        title: 'entidade inválida',
        args: ['suppliers', '--entity', 'Supplier'],
        reason: "a entidade 'Supplier' é inválido",
      },
      {
        title: 'singular que a regra não deriva',
        args: ['staff'],
        reason: 'Informe o singular com --entity',
      },
      {
        title: 'o domínio da própria referência',
        args: ['customers'],
        reason: "o domínio 'customers' é o da referência",
      },
      {
        title: 'entidade que já existe',
        args: ['users', '--entity', 'customer'],
        reason: 'já existe: src/schemas/entities/customer.ts',
      },
      {
        title: 'singular suspeito: status viraria statu',
        args: ['status'],
        reason: "'status' parece já estar no singular",
      },
      {
        title: 'singular suspeito: categories viraria categorie',
        args: ['categories'],
        reason: "daria 'categorie'",
      },
      {
        title: 'entidade que é palavra reservada',
        args: ['classes', '--entity', 'class'],
        reason: "a entidade 'class' vira o identificador 'class', que é palavra reservada",
      },
      {
        title: 'entidade que é nome global',
        args: ['records', '--entity', 'record'],
        reason: "a entidade 'record' vira o identificador 'Record', que é um nome global",
      },
      {
        title: 'nomes exportados que um índice já exporta (TS2308)',
        args: ['profiles'],
        reason: 'src/schemas/index.ts: ProfileSchema, profileSchema',
      },
    ]

    it.each(
      cases.flatMap((entry) => [
        entry,
        { ...entry, title: `${entry.title} (--dry-run)`, args: [...entry.args, '--dry-run'] },
      ]),
    )('$title', async ({ args, reason }) => {
      const { root } = fixtureProject()
      const before = snapshot(root)
      const result = await run(['make:domain', ...args], root)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain(reason)
      expect(result.stdout).toBe('')
      expect(snapshot(root)).toEqual(before)
    })

    it('sem o nome do domínio, mostra a ajuda do comando', async () => {
      const { root } = fixtureProject()
      const result = await run(['make:domain'], root)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain('falta o argumento <nome>.')
      expect(result.stderr).toContain('prumo make:domain')
    })

    it('numa pasta que não é projeto', async () => {
      const { root } = fixtureProject()
      const result = await run(
        ['make:domain', 'suppliers', '--root', path.join(root, 'nada')],
        root,
      )

      expect(result.code).toBe(2)
      expect(result.stderr).toContain('não existe')
    })
  })

  it('a ajuda do comando mostra a sintaxe e as opções', async () => {
    const result = await run(['make:domain', '--help'], process.cwd())

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('make:domain')
    expect(result.stdout).toContain('--entity')
    expect(result.stdout).toContain('--dry-run')
    expect(result.stdout).toContain('--root')
  })

  it('o prumo --help lista o comando', async () => {
    const result = await run(['--help'], process.cwd())

    expect(result.stdout).toContain('make:domain')
  })
})
