import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
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

function withPage(root: string) {
  mkdirSync(path.join(root, 'src/pages/clientes'), { recursive: true })
  for (const file of ['index.tsx', 'model.ts', 'view.tsx'])
    writeFileSync(path.join(root, 'src/pages/clientes', file), 'export {}\n')
}

describe('prumo make:component', () => {
  it('--page: gera o componente e o teste na tela, roda o check e mostra como testar', async () => {
    const { root } = fixtureProject()
    withPage(root)
    const result = await run(['make:component', 'resumo', '--page', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe(`prumo make:component: resumo (src/pages/clientes/components).

Criados (2):
  src/pages/clientes/components/resumo.test.tsx
  src/pages/clientes/components/resumo.tsx

prumo check: nenhuma violação.

Edite o componente (src/pages/clientes/components/resumo.tsx); o teste acompanha. Use-o na view da tela: import { Resumo } from './components/resumo'.

Para rodar os testes do componente novo:
  pnpm exec vitest run src/pages/clientes/components
`)
  })

  it('--shared: gera em src/components/shared e mostra a violação esperada sem falhar', async () => {
    const { root } = fixtureProject()
    const result = await run(['make:component', 'cartao', '--shared'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(existsSync(path.join(root, 'src/components/shared/cartao.tsx'))).toBe(true)
    expect(result.stdout).toContain(
      'prumo check: só a violação esperada de um componente shared ainda sem uso:\nsrc/components/shared/cartao.tsx  [shared-usage]',
    )
    expect(result.stdout).toContain('Ela some quando duas telas importarem o componente.')
    expect(result.stdout).toContain("import { Cartao } from '@/components/shared/cartao'")
  })

  it('--dry-run lista o que seria criado e não escreve nada', async () => {
    const { root } = fixtureProject()
    const result = await run(['make:component', 'cartao', '--shared', '--dry-run'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('Seriam criados (2):')
    expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(existsSync(path.join(root, 'src/components'))).toBe(false)
  })

  it('--root aponta o projeto de fora dele', async () => {
    const { root } = fixtureProject()
    const outside = makeDir()
    const result = await run(['make:component', 'cartao', '--shared', '--root', root], outside)

    expect(result.code, result.stderr).toBe(0)
    expect(readdirSync(outside)).toEqual([])
  })

  it('exige --page ou --shared, recusa os dois e a tela que falta, com 2', async () => {
    const { root } = fixtureProject()
    withPage(root)

    const none = await run(['make:component', 'cartao'], root)
    expect(none.code).toBe(2)
    expect(none.stderr).toContain('diga onde o componente mora')

    const both = await run(['make:component', 'cartao', '--shared', '--page', 'clientes'], root)
    expect(both.code).toBe(2)
    expect(both.stderr).toContain('use --page <tela> ou --shared, não os dois.')

    const missing = await run(['make:component', 'cartao', '--page', 'outra'], root)
    expect(missing.code).toBe(2)
    expect(missing.stderr).toContain("a tela 'outra' não existe")
    expect(existsSync(path.join(root, 'src/components'))).toBe(false)
  })

  it('recusa o nome inválido e sobrescrever, com 2', async () => {
    const { root } = fixtureProject()

    const invalid = await run(['make:component', 'Cartao', '--shared'], root)
    expect(invalid.code).toBe(2)
    expect(invalid.stderr).toContain('Uso: prumo make:component <nome>')

    expect((await run(['make:component', 'cartao', '--shared'], root)).code).toBe(0)
    const again = await run(['make:component', 'cartao', '--shared'], root)
    expect(again.code).toBe(2)
    expect(again.stderr).toContain('já existe')
  })

  it('uma violação que já existia antes é preexistente, e a esperada do componente não falha', async () => {
    const { root } = fixtureProject()
    mkdirSync(path.join(root, 'src/components/estranha'), { recursive: true })
    const result = await run(['make:component', 'cartao', '--shared'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('cartao.tsx  [shared-usage]')
    expect(result.stdout).toContain('Preexistentes (1;')
    expect(result.stdout).toContain('[components-folders]')
  })

  it('o comando seguinte não sai com 1 pela shared-usage do componente anterior', async () => {
    const { root } = fixtureProject()
    expect((await run(['make:component', 'cartao', '--shared'], root)).code).toBe(0)

    const next = await run(['make:component', 'resumo', '--shared'], root)

    expect(next.code, next.stderr).toBe(0)
    expect(next.stdout).toContain('resumo.tsx  [shared-usage]')
    expect(next.stdout).toContain('Preexistentes (1;')
    expect(next.stdout).toContain('cartao.tsx  [shared-usage]')
  })

  it('aparece na lista de comandos do prumo', async () => {
    const help = await run(['--help'], fixtureProject().root)

    expect(help.stdout).toMatch(/\n {2}make:component {2}Gera um componente novo/)
  })
})
