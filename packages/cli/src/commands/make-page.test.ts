import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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

function withDomain(root: string) {
  mkdirSync(path.join(root, 'src/queries'), { recursive: true })
  writeFileSync(
    path.join(root, 'src/queries/clientes.ts'),
    'export function useClientesList() {\n  return null\n}\n',
  )
}

describe('prumo make:page', () => {
  it('gera a tela, registra a rota e as mensagens, roda o check e mostra como testar', async () => {
    const { root } = fixtureProject()
    const result = await run(['make:page', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe(`prumo make:page: clientes (rota /clientes).

Criados (6):
  src/messages/en/clientes.json
  src/messages/pt-BR/clientes.json
  src/pages/clientes/index.test.tsx
  src/pages/clientes/index.tsx
  src/pages/clientes/model.ts
  src/pages/clientes/view.tsx

Alterados (3):
  src/App.tsx
  src/messages/en/index.ts
  src/messages/pt-BR/index.ts

prumo check: nenhuma violação.

Edite o model (src/pages/clientes/model.ts), a view (view.tsx) e os textos (src/messages/<idioma>/clientes.json); o teste acompanha.

Para rodar os testes da tela nova:
  pnpm exec vitest run src/pages/clientes
`)
    expect(readFileSync(path.join(root, 'src/messages/en/clientes.json'), 'utf8')).toBe(
      '{\n  "title": "Clientes"\n}\n',
    )
    expect(readFileSync(path.join(root, 'src/App.tsx'), 'utf8')).toContain(
      '<Route path="/clientes">',
    )
  })

  it('--domain liga a tela à lista do domínio', async () => {
    const { root } = fixtureProject()
    withDomain(root)
    const result = await run(['make:page', 'clientes', '--domain', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('prumo make:page: clientes (rota /clientes, domínio clientes).')
    expect(readFileSync(path.join(root, 'src/pages/clientes/model.ts'), 'utf8')).toContain(
      'useClientesList()',
    )
  })

  it('--root aponta o projeto de fora dele', async () => {
    const { root } = fixtureProject()
    const outside = makeDir()
    const result = await run(['make:page', 'clientes', '--root', root], outside)

    expect(result.code, result.stderr).toBe(0)
    expect(existsSync(path.join(root, 'src/pages/clientes/view.tsx'))).toBe(true)
    expect(result.stdout).toContain(`pnpm --dir ${root} exec vitest run src/pages/clientes`)
    expect(readdirSync(outside)).toEqual([])
  })

  it('--dry-run lista o que seria feito e não escreve nada', async () => {
    const { root } = fixtureProject()
    const before = snapshot(root)
    const result = await run(['make:page', 'clientes', '--dry-run'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('Seriam criados (6):')
    expect(result.stdout).toContain('Seriam alterados (3):\n  src/App.tsx\n')
    expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(result.stdout).not.toContain('prumo check')
    expect(snapshot(root)).toEqual(before)
  })

  it('recusa nome inválido, domínio que falta e tela que já existe, com 2 e sem escrever', async () => {
    const { root } = fixtureProject()
    const before = snapshot(root)

    const invalid = await run(['make:page', 'Meus_Clientes'], root)
    expect(invalid.code).toBe(2)
    expect(invalid.stdout).toBe('')
    expect(invalid.stderr).toContain("make:page: o nome da tela 'Meus_Clientes' é inválido")
    expect(invalid.stderr).toContain('Uso: prumo make:page <nome>')

    const noDomain = await run(['make:page', 'clientes', '--domain', 'clientes'], root)
    expect(noDomain.code).toBe(2)
    expect(noDomain.stderr).toContain("o domínio 'clientes' não existe")
    expect(snapshot(root)).toEqual(before)

    expect((await run(['make:page', 'clientes'], root)).code).toBe(0)
    const afterFirst = snapshot(root)
    const again = await run(['make:page', 'clientes'], root)
    expect(again.code).toBe(2)
    expect(again.stderr).toContain("a tela 'clientes' já existe")
    expect(snapshot(root)).toEqual(afterFirst)
  })

  it('um índice de mensagens que falta sai com 2 e não deixa o projeto pela metade', async () => {
    const { root } = fixtureProject()
    writeFileSync(path.join(root, 'src/messages/en/index.ts'), '// vazio\n')
    const before = snapshot(root)

    const result = await run(['make:page', 'clientes'], root)

    expect(result.code).toBe(2)
    expect(snapshot(root)).toEqual(before)
  })

  it('uma pasta que não é projeto sai com 2, e sem o nome também', async () => {
    const outside = await run(['make:page', 'clientes'], makeDir())
    expect(outside.code).toBe(2)
    expect(outside.stderr).toContain('não tem package.json')

    const missing = await run(['make:page'], fixtureProject().root)
    expect(missing.code).toBe(2)
    expect(missing.stderr).toContain('falta o argumento <nome>.')
  })

  it('a violação que já existia antes vira preexistente e não faz o comando falhar', async () => {
    const { root } = fixtureProject()
    mkdirSync(path.join(root, 'src/pages/solta'), { recursive: true })
    writeFileSync(path.join(root, 'src/pages/solta/index.tsx'), 'export {}\n')

    const result = await run(['make:page', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('prumo check: nenhuma violação nova.')
    expect(result.stdout).toContain('Preexistentes (')
    expect(result.stdout).toContain('src/pages/solta')
    expect(existsSync(path.join(root, 'src/pages/clientes/index.tsx'))).toBe(true)
  })

  it('aparece na lista de comandos do prumo', async () => {
    const help = await run(['--help'], fixtureProject().root)

    expect(help.stdout).toMatch(/\n {2}make:page {2,}Gera uma tela nova/)
  })
})
