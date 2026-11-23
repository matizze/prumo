import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

function write(root: string, file: string, content: string) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  writeFileSync(path.join(root, file), content)
}

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

/** Duas telas, um componente em `livros` (com teste) e imports de formas variadas. */
function project() {
  const { root } = fixtureProject()
  for (const page of ['livros', 'livro']) {
    for (const file of ['index.tsx', 'model.ts'])
      write(root, `src/pages/${page}/${file}`, 'export {}\n')
  }
  write(
    root,
    'src/pages/livros/components/formulario.tsx',
    `import { helper } from '@/lib/helper'\n\nexport function Formulario() {\n  return <form>{helper()}</form>\n}\n`,
  )
  write(
    root,
    'src/pages/livros/components/formulario.test.tsx',
    `import { it } from 'vitest'\nimport { Formulario } from './formulario'\n\nit('ok', () => void Formulario)\n`,
  )
  write(root, 'src/lib/helper.ts', 'export const helper = () => 1\n')
  write(root, 'src/pages/livros/util-comum.ts', 'export const util = () => 2\n')
  write(
    root,
    'src/pages/livros/view.tsx',
    `import { Formulario } from './components/formulario'\nexport const View = () => <Formulario />\n`,
  )
  write(
    root,
    'src/pages/livros/view.test.tsx',
    `import { vi } from 'vitest'\nvi.mock('./components/formulario', () => ({}))\nexport {}\n`,
  )
  write(
    root,
    'src/pages/livro/view.tsx',
    `import { Formulario } from '@/pages/livros/components/formulario'\nexport * from '../livros/components/formulario'\nexport const V = () => <Formulario />\n`,
  )
  write(
    root,
    'src/pages/livro/outro.tsx',
    `import { Outro } from './components/formulario-extra'\nexport { Outro }\n`,
  )
  return root
}

describe('prumo move:component', () => {
  it('move o componente e o teste, reescreve os imports e mostra a violação esperada', async () => {
    const root = project()
    // O componente de exemplo importa algo de fora da pasta que não é de tela
    write(
      root,
      'src/pages/livros/components/formulario.tsx',
      `import { helper } from '../../../lib/helper'\n\nexport function Formulario() {\n  return <form>{helper()}</form>\n}\n`,
    )
    const result = await run(['move:component', 'formulario', '--from', 'livros', '--shared'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(existsSync(path.join(root, 'src/pages/livros/components'))).toBe(false)
    expect(read(root, 'src/components/shared/formulario.tsx')).toContain("from '@/lib/helper'")
    expect(read(root, 'src/components/shared/formulario.test.tsx')).toContain("from './formulario'")
    expect(read(root, 'src/pages/livros/view.tsx')).toContain(
      "from '@/components/shared/formulario'",
    )
    expect(read(root, 'src/pages/livros/view.test.tsx')).toContain(
      "vi.mock('@/components/shared/formulario'",
    )
    const other = read(root, 'src/pages/livro/view.tsx')
    expect(other).toContain("import { Formulario } from '@/components/shared/formulario'")
    expect(other).toContain("export * from '@/components/shared/formulario'")
    // O nome de outro componente que só começa igual não muda
    expect(read(root, 'src/pages/livro/outro.tsx')).toContain("'./components/formulario-extra'")
    expect(result.stdout).toContain('Removidos (2):')
    expect(result.stdout).toContain('src/pages/livros/components/formulario.tsx')
    // As duas telas já usam o componente: nada a acusar
    expect(result.stdout).toContain('prumo check: nenhuma violação.')
  })

  it('o componente que ainda é de uma tela só aparece como violação esperada, sem falhar', async () => {
    const root = project()
    write(root, 'src/pages/livro/view.tsx', 'export const V = () => null\n')
    const result = await run(['move:component', 'formulario', '--from', 'livros', '--shared'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('formulario.tsx  [shared-usage]')
    expect(result.stdout).toContain('Ela some quando uma segunda tela importar o componente.')
  })

  it('--dry-run lista o que mudaria e não mexe em nada', async () => {
    const root = project()
    const view = read(root, 'src/pages/livros/view.tsx')
    const result = await run(
      ['move:component', 'formulario', '--from', 'livros', '--shared', '--dry-run'],
      root,
    )

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('Seriam criados (2):')
    expect(result.stdout).toContain('Seriam alterados')
    expect(result.stdout).toContain('Seriam removidos (2):')
    expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(existsSync(path.join(root, 'src/components'))).toBe(false)
    expect(read(root, 'src/pages/livros/view.tsx')).toBe(view)
  })

  it('move um componente sem teste e deixa a pasta se ainda tem outro componente', async () => {
    const root = project()
    write(root, 'src/pages/livros/components/outro.tsx', 'export const Outro = () => <p />\n')
    const result = await run(['move:component', 'outro', '--from', 'livros', '--shared'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(existsSync(path.join(root, 'src/components/shared/outro.tsx'))).toBe(true)
    expect(existsSync(path.join(root, 'src/components/shared/outro.test.tsx'))).toBe(false)
    expect(existsSync(path.join(root, 'src/pages/livros/components/formulario.tsx'))).toBe(true)
  })

  it('recusa o que está errado, com 2, sem mexer em nada', async () => {
    const root = project()
    const cases: [string[], string][] = [
      [['move:component', 'formulario', '--from', 'livros'], 'diga para onde mover'],
      [
        ['move:component', 'Formulario', '--from', 'livros', '--shared'],
        'Uso: prumo move:component',
      ],
      [
        ['move:component', 'formulario', '--from', 'outra', '--shared'],
        "a tela 'outra' não existe",
      ],
      [
        ['move:component', 'nada', '--from', 'livros', '--shared'],
        "o componente 'nada' não existe na tela 'livros'",
      ],
    ]
    for (const [args, message] of cases) {
      const result = await run(args, root)
      expect(result.code, args.join(' ')).toBe(2)
      expect(result.stderr).toContain(message)
    }
    expect(existsSync(path.join(root, 'src/components'))).toBe(false)
    expect(existsSync(path.join(root, 'src/pages/livros/components/formulario.tsx'))).toBe(true)
  })

  it('recusa o homônimo em shared', async () => {
    const root = project()
    write(root, 'src/components/shared/formulario.tsx', 'export const Formulario = () => null\n')
    const result = await run(['move:component', 'formulario', '--from', 'livros', '--shared'], root)

    expect(result.code).toBe(2)
    expect(result.stderr).toContain("já existe 'src/components/shared/formulario.tsx' em shared")
    expect(existsSync(path.join(root, 'src/pages/livros/components/formulario.tsx'))).toBe(true)
  })

  it('recusa o componente que importa algo de uma tela', async () => {
    const root = project()
    write(
      root,
      'src/pages/livros/components/formulario.tsx',
      `import { util } from '../util-comum'\nexport const Formulario = () => util()\n`,
    )
    const result = await run(['move:component', 'formulario', '--from', 'livros', '--shared'], root)

    expect(result.code).toBe(2)
    expect(result.stderr).toContain("importa '../util-comum', que é de uma tela")
    expect(existsSync(path.join(root, 'src/components'))).toBe(false)
  })

  it('aparece na lista de comandos do prumo', async () => {
    const help = await run(['--help'], fixtureProject().root)

    expect(help.stdout).toMatch(/\n {2}move:component {2}Promove um componente/)
  })
})
