import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
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

describe('prumo make:component', () => {
  it('gera o componente e a story na tela e lista tudo, sem violação do check', async () => {
    const { root } = fixtureProject()
    const result = await run(['make:component', 'resumo-pedido', '--page', 'products-list'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout)
      .toBe(`prumo make:component: ResumoPedido na tela products-list, a partir de StorageCard.

Criados (2):
  src/pages/products-list/components/resumo-pedido.stories.tsx
  src/pages/products-list/components/resumo-pedido.tsx

prumo check: nenhuma violação.

A story é 'Pages/ProductsList/ResumoPedido'. As props, o visual e os textos são os de StorageCard: edite o componente e a story.

Para rodar o teste da story (play function e axe):
  pnpm exec vitest run src/pages/products-list/components/resumo-pedido.stories.tsx
`)
    expect(read(root, 'src/pages/products-list/components/resumo-pedido.tsx')).toContain(
      'export function ResumoPedido({',
    )
    expect(read(root, 'src/pages/products-list/components/resumo-pedido.stories.tsx')).toContain(
      "title: 'Pages/ProductsList/ResumoPedido',",
    )
  })

  it('mostra o script test:storybook do projeto, e o --dry-run não escreve nada', async () => {
    const { root } = fixtureProject()
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'app',
        scripts: { 'test:storybook': 'vitest run --project storybook' },
      }),
    )
    const before = snapshot(root)
    const dry = await run(
      ['make:component', 'resumo', '--page', 'products-list', '--dry-run'],
      root,
    )

    expect(dry.code, dry.stderr).toBe(0)
    expect(dry.stdout)
      .toBe(`prumo make:component: Resumo na tela products-list, a partir de StorageCard.

Seriam criados (2):
  src/pages/products-list/components/resumo.stories.tsx
  src/pages/products-list/components/resumo.tsx

Simulação (--dry-run): nada foi escrito.
`)
    expect(snapshot(root)).toEqual(before)

    const real = await run(['make:component', 'resumo', '--page', 'products-list'], root)
    expect(real.stdout).toContain(
      '  pnpm test:storybook src/pages/products-list/components/resumo.stories.tsx\n',
    )
  })

  it('aceita --root, relativo à pasta atual', async () => {
    const { root } = fixtureProject()
    const result = await run(
      ['make:component', 'resumo', '--page', 'blank', '--root', path.basename(root)],
      path.dirname(root),
    )

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain(
      `  pnpm --dir ${path.basename(root)} exec vitest run src/pages/blank/components/resumo.stories.tsx\n`,
    )
  })

  describe('erros de uso, que saem com 2 antes de escrever qualquer coisa', () => {
    const cases: { title: string; args: string[]; reason: string }[] = [
      {
        title: 'nome que não é kebab-case',
        args: ['ResumoPedido', '--page', 'products-list'],
        reason: "o nome do componente 'ResumoPedido' é inválido",
      },
      {
        title: 'tela que não existe',
        args: ['resumo', '--page', 'nao-existe'],
        reason: "a tela 'nao-existe' não existe em src/pages",
      },
      {
        title: 'o nome do componente de referência',
        args: ['storage-card', '--page', 'products-list'],
        reason: "o nome do componente é o da referência ('storage-card')",
      },
      {
        title: 'componente que já existe na tela',
        args: ['product-table', '--page', 'products-list'],
        reason: "'src/pages/products-list/components/product-table.tsx' já existe.",
      },
    ]

    it.each(cases)('$title', async ({ args, reason }) => {
      const { root } = fixtureProject()
      const before = snapshot(root)
      const result = await run(['make:component', ...args], root)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain(reason)
      expect(result.stdout).toBe('')
      expect(snapshot(root)).toEqual(before)
    })

    it('sem a opção --page, mostra a ajuda do comando', async () => {
      const { root } = fixtureProject()
      const result = await run(['make:component', 'resumo'], root)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain('a opção --page é obrigatória.')
      expect(result.stderr).toContain('prumo make:component')
    })

    it('sem o nome do componente', async () => {
      const { root } = fixtureProject()
      const result = await run(['make:component', '--page', 'products-list'], root)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain('falta o argumento <nome>.')
    })
  })

  it('a ajuda do comando mostra a sintaxe e as opções, e o prumo --help lista o comando', async () => {
    const help = await run(['make:component', '--help'], process.cwd())
    expect(help.code).toBe(0)
    for (const text of ['make:component', '--page', '--dry-run', '--root']) {
      expect(help.stdout).toContain(text)
    }
    expect((await run(['--help'], process.cwd())).stdout).toContain('make:component')
  })
})
