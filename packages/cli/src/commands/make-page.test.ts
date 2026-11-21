import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemod/test-support.ts'
import { createRoot } from '../root.ts'
import { runCli } from '../run.ts'
import { captureRuntime, type CaptureOptions } from '../test-support.ts'
import { PATTERNS } from '../patterns.ts'
import { patternChoices, testCommand } from './make-page.ts'
import { formatSummary } from './shared.ts'

/** Cópia do app em miniatura do codemod, numa pasta temporária. */
const newProject = () => fixtureProject()

async function run(args: string[], cwd: string, terminal?: CaptureOptions) {
  const runtime = captureRuntime(cwd, terminal)
  const code = await runCli(createRoot(runtime), args, runtime)
  return { code, stdout: runtime.stdout, stderr: runtime.stderr, asked: runtime.asked }
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

describe('prumo make:page', () => {
  it('gera a tela, as mensagens e a rota, e lista tudo, sem violação do check', async () => {
    const { root } = newProject()
    const result = await run(['make:page', 'produtos', '--like', 'products-list'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout)
      .toBe(`prumo make:page: produtos a partir de products-list, na rota /produtos.

Criados (10):
  src/messages/en/produtos.json
  src/messages/pt-BR/produtos.json
  src/pages/produtos/README.md
  src/pages/produtos/components/product-table.stories.tsx
  src/pages/produtos/components/product-table.tsx
  src/pages/produtos/index.test.tsx
  src/pages/produtos/index.tsx
  src/pages/produtos/model.ts
  src/pages/produtos/skeleton.tsx
  src/pages/produtos/view.tsx

Alterados (3):
  src/App.tsx
  src/messages/en/index.ts
  src/messages/pt-BR/index.ts

prumo check: nenhuma violação.

Para rodar os testes da tela nova:
  pnpm exec vitest run src/pages/produtos
`)
  })

  it('a tela gerada leva os nomes novos e nada da referência', async () => {
    const { root } = newProject()
    await run(['make:page', 'produtos', '--like', 'products-list'], root)

    expect(read(root, 'src/pages/produtos/index.tsx'))
      .toBe(`import { useProdutosModel } from './model'
import { ProdutosView } from './view'

export default function ProdutosPage() {
  const methods = useProdutosModel()
  return <ProdutosView {...methods} />
}
`)
    expect(read(root, 'src/pages/produtos/model.ts')).toBe(`import { useTranslations } from '@/i18n'
import { useLocation } from 'wouter'

export const PAGE_SIZE = 7

export function useProdutosModel() {
  const t = useTranslations('produtos')
  const tFilters = useTranslations('produtos.filters')
  const tCommon = useTranslations('common')
  const [, navigate] = useLocation()

  return {
    title: t('title'),
    clear: tFilters('clear'),
    close: tCommon('close'),
    // Chave completa, de fora do hook
    exportLabel: t('produtos.export'),
    goToAdd: () => navigate('/add-product'),
    goToDetail: (id: string) => navigate(\`/produtos/\${id}\`),
    goToFirstPage: () => navigate('/produtos?page=1'),
  }
}
`)
    expect(read(root, 'src/pages/produtos/index.test.tsx')).toContain(`describe('ProdutosPage'`)
    expect(read(root, 'src/pages/produtos/index.test.tsx')).toContain(`path: '/produtos?page=2'`)
    expect(read(root, 'src/pages/produtos/components/product-table.stories.tsx')).toContain(
      "title: 'Pages/Produtos/ProductTable'",
    )
    expect(read(root, 'src/pages/produtos/components/product-table.stories.tsx')).toContain(
      "component: 'Tabela de `/produtos`.'",
    )
    expect(read(root, 'src/pages/produtos/components/product-table.tsx')).toContain(
      "useTranslations('produtos.table')",
    )

    const generated = readdirSync(path.join(root, 'src/pages/produtos'), { recursive: true })
      .map(String)
      .filter((file) => /\.(tsx?|json)$/.test(file))
      .map((file) => read(root, `src/pages/produtos/${file}`))
      .join('\n')
    expect(generated).not.toMatch(/ProductsList|productsList|products-list/)

    for (const language of ['pt-BR', 'en']) {
      expect(read(root, `src/messages/${language}/produtos.json`)).toBe(
        read(root, `src/messages/${language}/products-list.json`),
      )
      const index = read(root, `src/messages/${language}/index.ts`)
      expect(index).toContain("import produtos from './produtos.json'")
      expect(index).toMatch(/productsList,\n {2}produtos,\n {2}profile,/)
    }
    expect(read(root, 'src/App.tsx')).toContain(`      <Route key={SHELL_KEY} path="/produtos">
        <Private>
          <ProdutosPage />
        </Private>
      </Route>`)
    expect(read(root, 'src/App.tsx')).toContain("import ProdutosPage from '@/pages/produtos'")
  })

  it('com --menu, acrescenta o item ao grupo e o rótulo nos dois idiomas', async () => {
    const { root } = newProject()
    const result = await run(
      ['make:page', 'pedidos-recentes', '--like', 'products-list', '--menu', 'ecommerce'],
      root,
    )

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('na rota /pedidos-recentes.')
    expect(result.stdout).toContain('  src/components/layout/app-layout/sidebar/data.tsx')
    expect(result.stdout).toContain('  src/messages/en/layout.json')
    expect(read(root, 'src/components/layout/app-layout/sidebar/data.tsx')).toContain(
      "{ label: 'nav.items.pedidosRecentes', path: '/pedidos-recentes' },",
    )
    for (const language of ['pt-BR', 'en']) {
      expect(
        JSON.parse(read(root, `src/messages/${language}/layout.json`)).nav.items,
      ).toMatchObject({ pedidosRecentes: 'Pedidos recentes' })
    }
    expect(read(root, 'src/pages/pedidos-recentes/model.ts')).toContain(
      "useTranslations('pedidosRecentes')",
    )
    expect(read(root, 'src/pages/pedidos-recentes/model.ts')).toContain(
      'export function usePedidosRecentesModel()',
    )
  })

  it('sem --menu, não mexe no menu', async () => {
    const { root } = newProject()
    const before = snapshot(root)
    await run(['make:page', 'produtos', '--like', 'products-list'], root)
    const after = snapshot(root)

    const sidebar = 'src/components/layout/app-layout/sidebar/data.tsx'
    expect(after[sidebar]).toBe(before[sidebar])
    expect(after['src/messages/en/layout.json']).toBe(before['src/messages/en/layout.json'])
  })

  it('numa tela com parâmetro na rota, a rota nova leva o parâmetro e a lista continua sendo a lista', async () => {
    const { root } = newProject()
    const result = await run(['make:page', 'pedidos', '--like', 'invoice-detail'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain(
      'prumo make:page: pedidos a partir de invoice-detail, na rota /pedidos/:id.',
    )
    expect(read(root, 'src/App.tsx')).toContain(`      <Route key={SHELL_KEY} path="/pedidos/:id">
        <Private>
          <PedidosPage />
        </Private>
      </Route>

      <Route key={SHELL_KEY} path="/single-invoice">`)
    expect(read(root, 'src/pages/pedidos/model.ts')).toContain(
      'navigate(`/pedidos/${next}`, { replace: true })',
    )
    // O link de voltar aponta para a lista de faturas, que é outra tela
    expect(read(root, 'src/pages/pedidos/model.ts')).toContain("backHref: '/invoices'")
    expect(read(root, 'src/pages/pedidos/index.test.tsx'))
      .toBe(`import { screen } from '@testing-library/react'
import { Route } from 'wouter'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import PedidosPage from '.'

describe('PedidosPage', () => {
  it('shows the invoice of the id in the route', async () => {
    renderWithProviders(<Route path="/pedidos/:id" component={PedidosPage} />, {
      path: '/pedidos/inv_1',
    })
    expect(await screen.findByText('inv_1')).toBeInTheDocument()
  })

  it('links back to the list of invoices', async () => {
    renderWithProviders(<Route path="/pedidos/:id" component={PedidosPage} />, {
      path: '/pedidos/inv_2',
    })
    expect(await screen.findByRole('link')).toHaveAttribute('href', '/invoices')
  })
})
`)
  })

  it('--dry-run lista o que seria criado e alterado e não escreve nada', async () => {
    const { root } = newProject()
    const before = snapshot(root)
    const result = await run(
      ['make:page', 'produtos', '--like', 'products-list', '--menu', 'ecommerce', '--dry-run'],
      root,
    )

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout)
      .toBe(`prumo make:page: produtos a partir de products-list, na rota /produtos.

Seriam criados (10):
  src/messages/en/produtos.json
  src/messages/pt-BR/produtos.json
  src/pages/produtos/README.md
  src/pages/produtos/components/product-table.stories.tsx
  src/pages/produtos/components/product-table.tsx
  src/pages/produtos/index.test.tsx
  src/pages/produtos/index.tsx
  src/pages/produtos/model.ts
  src/pages/produtos/skeleton.tsx
  src/pages/produtos/view.tsx

Seriam alterados (6):
  src/App.tsx
  src/components/layout/app-layout/sidebar/data.tsx
  src/messages/en/index.ts
  src/messages/en/layout.json
  src/messages/pt-BR/index.ts
  src/messages/pt-BR/layout.json

Simulação (--dry-run): nada foi escrito.
`)
    expect(snapshot(root)).toEqual(before)
  })

  it('o --dry-run também valida: erro de uso sai com 2', async () => {
    const { root } = newProject()
    const result = await run(
      ['make:page', 'Produtos', '--like', 'products-list', '--dry-run'],
      root,
    )
    expect(result.code).toBe(2)
  })

  it('aceita --root, relativo à pasta atual, e mostra o comando dos testes com o script do projeto', async () => {
    const { root } = newProject()
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'app', scripts: { test: 'vitest run --project unit' } }),
    )
    const result = await run(
      ['make:page', 'produtos', '--like', 'products-list', '--root', path.basename(root)],
      path.dirname(root),
    )

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain(
      `Para rodar os testes da tela nova:\n  pnpm --dir ${path.basename(root)} test src/pages/produtos\n`,
    )

    const inside = newProject()
    writeFileSync(
      path.join(inside.root, 'package.json'),
      JSON.stringify({ name: 'app', scripts: { test: 'vitest run' } }),
    )
    const here = await run(['make:page', 'produtos', '--like', 'products-list'], inside.root)
    expect(here.stdout).toContain('  pnpm test src/pages/produtos\n')
  })

  describe('erros de uso, que saem com 2 antes de escrever qualquer coisa', () => {
    const cases: { title: string; args: string[]; reason: string }[] = [
      {
        title: 'nome que não é kebab-case',
        args: ['Pedidos_Novos', '--like', 'products-list'],
        reason: "o nome da tela 'Pedidos_Novos' é inválido",
      },
      {
        title: 'nome que começa por número',
        args: ['2pedidos', '--like', 'products-list'],
        reason: "o nome da tela '2pedidos' é inválido",
      },
      {
        title: 'referência com nome inválido',
        args: ['produtos', '--like', '../products-list'],
        reason: "a tela de referência '../products-list' é inválido",
      },
      {
        title: 'tela de destino que já existe',
        args: ['invoice-detail', '--like', 'products-list'],
        reason: "a tela 'invoice-detail' já existe em src/pages",
      },
      {
        title: 'nome igual ao da referência',
        args: ['products-list', '--like', 'products-list'],
        reason: "o nome da tela é o da referência ('products-list')",
      },
      {
        title: 'tela de referência que não existe',
        args: ['produtos', '--like', 'nao-existe'],
        reason: "a tela de referência 'nao-existe' não existe em src/pages",
      },
      {
        title: 'referência sem rota no App.tsx',
        args: ['produtos', '--like', 'sem-rota'],
        reason: "src/App.tsx não tem uma rota com path para 'SemRotaPage'",
      },
      {
        title: 'grupo de menu que não existe',
        args: ['produtos', '--like', 'products-list', '--menu', 'nao-existe'],
        reason: "o menu lateral não tem o grupo 'nao-existe' com subitens",
      },
      {
        title: '--menu numa tela com parâmetro na rota',
        args: ['pedidos', '--like', 'invoice-detail', '--menu', 'ecommerce'],
        reason: "--menu não serve a uma tela com parâmetro na rota ('/pedidos/:id')",
      },
      {
        title: 'mensagens com o nome da tela que já existem',
        args: ['add-product', '--like', 'products-list'],
        reason: "'src/messages/en/add-product.json' já existe.",
      },
      {
        title: 'palavra reservada: new vira import new from ./new.json',
        args: ['new', '--like', 'lista'],
        reason: "o nome da tela 'new' vira o identificador 'new', que é palavra reservada",
      },
      {
        title: 'palavra reservada: default',
        args: ['default', '--like', 'products-list'],
        reason: "o nome da tela 'default' vira o identificador 'default'",
      },
      {
        title: 'palavra reservada: class, com a tela mínima',
        args: ['class'],
        reason: "o nome da tela 'class' vira o identificador 'class'",
      },
      {
        title: 'namespace que as mensagens já registram: error404 e a tela error-404',
        args: ['error404', '--like', 'blank'],
        reason: "src/messages/en/index.ts já registra o namespace 'error404' (error-404.json)",
      },
      {
        title: 'rota coberta por uma curinga das irmãs: /settings e /settings/*?',
        args: ['settings', '--like', 'blank'],
        reason: "a rota '/settings' conflita com a rota '/settings/*?' que src/App.tsx já tem",
      },
    ]

    // O --dry-run valida do mesmo jeito: não pode aceitar o que o comando de verdade recusa
    for (const { title, args, reason } of cases.flatMap((entry) => [
      entry,
      { ...entry, title: `${entry.title} (--dry-run)`, args: [...entry.args, '--dry-run'] },
    ])) {
      it(title, async () => {
        const { root } = newProject()
        // A tela sem rota e a rota repetida que alguns casos pedem
        mkdirSync(path.join(root, 'src/pages/sem-rota'), { recursive: true })
        writeFileSync(
          path.join(root, 'src/pages/sem-rota/index.tsx'),
          'export default function SemRotaPage() {\n  return null\n}\n',
        )
        const before = snapshot(root)

        const result = await run(['make:page', ...args], root)

        expect(result.code).toBe(2)
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain(`prumo make:page: ${reason}`)
        expect(result.stderr).toContain('Uso: prumo make:page <nome> [--like <padrão|tela>]')
        expect(snapshot(root)).toEqual(before)
      })
    }

    it('rota nova que já existe no App.tsx', async () => {
      const { root } = newProject()
      const app = path.join(root, 'src/App.tsx')
      writeFileSync(
        app,
        readFileSync(app, 'utf8').replace('path="/single-invoice"', 'path="/produtos"'),
      )
      const before = snapshot(root)

      const result = await run(['make:page', 'produtos', '--like', 'products-list'], root)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain("src/App.tsx já tem uma rota '/produtos'")
      expect(snapshot(root)).toEqual(before)
    })

    it('falta de mensagens da referência', async () => {
      const { root } = newProject()
      // A tela existe e tem rota, mas não tem o JSON de textos em pt-BR
      const messages = path.join(root, 'src/messages/pt-BR/invoice-detail.json')
      writeFileSync(messages, '{}')
      const before = snapshot(root)
      const { rmSync } = await import('node:fs')
      rmSync(messages)
      const without = snapshot(root)

      const result = await run(['make:page', 'pedidos', '--like', 'invoice-detail'], root)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain(
        'faltam as mensagens da referência: src/messages/pt-BR/invoice-detail.json',
      )
      expect(snapshot(root)).toEqual(without)
      expect(Object.keys(before)).toContain('src/messages/pt-BR/invoice-detail.json')
    })

    it('referência dentro de um <Route> que não é nest', async () => {
      const { root } = newProject()
      const app = path.join(root, 'src/App.tsx')
      writeFileSync(
        app,
        readFileSync(app, 'utf8').replace(
          '<Route path="/settings" nest>',
          '<Route path="/settings">',
        ),
      )
      const before = snapshot(root)

      const result = await run(['make:page', 'geral', '--like', 'settings-general'], root)

      expect(result.code).toBe(2)
      expect(result.stderr).toContain(
        "a rota da tela 'settings-general' está dentro de outro <Route> que não é 'nest'",
      )
      expect(snapshot(root)).toEqual(before)
    })

    it('falta o nome ou sobra argumento', async () => {
      const { root } = newProject()
      const before = snapshot(root)
      const cases: [string[], string][] = [
        [['--like', 'products-list'], 'falta o argumento <nome>.'],
        [['produtos', '--like'], 'a opção --like precisa de um valor.'],
        [['produtos', 'outro', '--like', 'products-list'], "argumento inesperado: 'outro'."],
        [['produtos', '--like', 'products-list', '--nope'], "opção desconhecida: '--nope'."],
      ]
      for (const [args, reason] of cases) {
        const result = await run(['make:page', ...args], root)
        expect(result.code, args.join(' ')).toBe(2)
        expect(result.stderr, args.join(' ')).toContain(`prumo make:page: ${reason}`)
      }
      expect(snapshot(root)).toEqual(before)
    })

    it('raiz que não é projeto', async () => {
      const { root } = newProject()
      const result = await run(
        ['make:page', 'produtos', '--like', 'products-list', '--root', path.join(root, 'src')],
        root,
      )
      expect(result.code).toBe(2)
      expect(result.stderr).toContain('não tem package.json')
    })

    it('projeto sem src/pages ou sem App.tsx', async () => {
      const { rmSync } = await import('node:fs')
      const noApp = newProject().root
      rmSync(path.join(noApp, 'src/App.tsx'))
      const noPages = newProject().root
      rmSync(path.join(noPages, 'src/pages'), { recursive: true })

      const first = await run(['make:page', 'produtos', '--like', 'products-list'], noApp)
      expect(first.code).toBe(2)
      expect(first.stderr).toContain('o projeto não tem src/App.tsx')
      const second = await run(['make:page', 'produtos', '--like', 'products-list'], noPages)
      expect(second.code).toBe(2)
      expect(second.stderr).toContain('o projeto não tem src/pages')
    })
  })

  it('com violação do check no projeto, gera a tela, mostra a violação e sai com 1', async () => {
    const { root } = newProject()
    mkdirSync(path.join(root, 'src/components/widgets'), { recursive: true })

    const result = await run(['make:page', 'produtos', '--like', 'products-list'], root)

    expect(result.code).toBe(1)
    expect(result.stdout).toContain('Criados (10):')
    expect(result.stdout).toContain('Para rodar os testes da tela nova:')
    expect(result.stderr).toContain('prumo check: 1 violação (a tela foi gerada')
    expect(result.stderr).toContain(
      "src/components/widgets  [components-folders]  A pasta 'widgets'",
    )
    expect(read(root, 'src/pages/produtos/index.tsx')).toContain('ProdutosPage')
  })

  it('a ajuda mostra a sintaxe e as opções, em português', async () => {
    const { root } = newProject()
    for (const flag of ['--help', '-h']) {
      const result = await run(['make:page', flag], root)
      expect(result.code).toBe(0)
      expect(result.stdout).toContain(
        'Uso: prumo make:page <nome> [--like <padrão|tela>] [--root <pasta>] [--menu <grupo>] [--dry-run]',
      )
      expect(result.stdout).toContain('--dry-run')
      expect(result.stdout).toContain('Só lista o que seria criado e alterado')
    }
    const list = await run([], root)
    expect(list.stdout).toMatch(
      /make:page\s+Gera uma tela nova a partir de um padrão ou de uma tela de referência/,
    )
  })
})

describe('prumo make:page: os padrões e a tela mínima', () => {
  it('--like aceita o nome do padrão e gera o mesmo que o nome da tela', async () => {
    const byPattern = newProject()
    const byScreen = newProject()
    const first = await run(['make:page', 'produtos', '--like', 'lista'], byPattern.root)
    const second = await run(['make:page', 'produtos', '--like', 'products-list'], byScreen.root)

    expect(first.code, first.stderr).toBe(0)
    expect(first.stdout).toContain('produtos a partir de products-list, na rota /produtos.')
    expect(first.stdout).toBe(second.stdout)
    expect(snapshot(byPattern.root)).toEqual(snapshot(byScreen.root))
  })

  it('o erro de uma referência ausente cita a tela que o padrão escolhe', async () => {
    const { root } = newProject()
    const before = snapshot(root)
    // O projeto de fixture não tem a tela de configurações do app de referência
    const result = await run(['make:page', 'minhas-opcoes', '--like', 'configuracoes'], root)

    expect(result.code).toBe(2)
    expect(result.stderr).toContain("a tela de referência 'ai-settings-general' não existe")
    expect(snapshot(root)).toEqual(before)
  })

  it('uma referência dentro de um <Route nest> gera a tela no mesmo nest', async () => {
    const { root } = newProject()
    const result = await run(['make:page', 'geral', '--like', 'settings-general'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('geral a partir de settings-general, na rota /settings/geral.')
    expect(read(root, 'src/App.tsx')).toContain(
      `                <Route path="/general" component={SettingsGeneralPage} />
                <Route path="/geral" component={GeralPage} />`,
    )
    expect(read(root, 'src/App.tsx')).toContain("import GeralPage from '@/pages/geral'")
    expect(read(root, 'src/pages/geral/index.test.tsx')).toContain("{ path: '/geral' }")
    expect(read(root, 'src/pages/geral/model.ts')).toContain("useTranslations('geral')")
    expect(read(root, 'src/messages/en/geral.json')).toBe(
      read(root, 'src/messages/en/settings-general.json'),
    )
  })

  it('a tela de entrada não ganha arquivo de mensagens e avisa', async () => {
    const { root } = newProject()
    const before = snapshot(root)
    const result = await run(['make:page', 'entrar', '--like', 'autenticacao'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain(
      "A referência não tem arquivo de mensagens próprio (usa namespaces compartilhados): 'entrar' não ganha um.",
    )
    const after = snapshot(root)
    expect(Object.keys(after).filter((file) => !(file in before))).toEqual([
      'src/pages/entrar/index.test.tsx',
      'src/pages/entrar/index.tsx',
      'src/pages/entrar/model.ts',
      'src/pages/entrar/view.tsx',
    ])
    expect(after['src/messages/en/index.ts']).toBe(before['src/messages/en/index.ts'])
    expect(read(root, 'src/App.tsx')).toContain('<AuthLayout>\n          <EntrarPage />')
  })

  it('a tela de status entra no BareLayout, sem casca', async () => {
    const { root } = newProject()
    const result = await run(['make:page', 'aviso', '--like', 'status'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(read(root, 'src/App.tsx')).toContain(`      <Route path="/aviso">
        <BareLayout>
          <AvisoPage />
        </BareLayout>
      </Route>`)
    expect(read(root, 'src/pages/aviso/model.ts')).toContain("useTranslations('aviso')")
  })

  describe('sem --like', () => {
    it('fora de um terminal interativo, gera a tela mínima a partir de blank, sem perguntar', async () => {
      const { root } = newProject()
      const result = await run(['make:page', 'relatorio'], root)

      expect(result.code, result.stderr).toBe(0)
      expect(result.asked).toEqual([])
      expect(result.stdout).toContain('relatorio a partir de blank, na rota /relatorio.')
      expect(read(root, 'src/pages/relatorio/model.ts')).toContain("useTranslations('relatorio')")
      expect(read(root, 'src/App.tsx')).toContain('<RelatorioPage />')
    })

    it('num terminal interativo, pergunta o padrão: os dez e a tela mínima', async () => {
      const { root } = newProject()
      const result = await run(['make:page', 'produtos'], root, {
        interactive: true,
        answer: 'lista',
      })

      expect(result.code, result.stderr).toBe(0)
      expect(result.asked).toHaveLength(1)
      expect(result.asked[0]!.message).toBe('Qual padrão de tela?')
      expect(result.asked[0]!.options.map((option) => option.value)).toEqual([
        ...PATTERNS.map((pattern) => pattern.name),
        'blank',
      ])
      expect(result.asked[0]!.options.at(-1)).toMatchObject({ label: 'Tela mínima' })
      expect(result.stdout).toContain('produtos a partir de products-list, na rota /produtos.')
    })

    it('a escolha "tela mínima" gera a partir de blank', async () => {
      const { root } = newProject()
      const result = await run(['make:page', 'relatorio'], root, {
        interactive: true,
        answer: 'blank',
      })

      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain('relatorio a partir de blank')
    })

    it('cancelar a pergunta sai com 1 e não gera nada', async () => {
      const { root } = newProject()
      const before = snapshot(root)
      const result = await run(['make:page', 'produtos'], root, { interactive: true })

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('prumo make:page: cancelado: nada foi gerado.')
      expect(snapshot(root)).toEqual(before)
    })

    it('com --like, não pergunta, mesmo no terminal', async () => {
      const { root } = newProject()
      const result = await run(['make:page', 'produtos', '--like', 'lista'], root, {
        interactive: true,
        answer: 'blank',
      })

      expect(result.code, result.stderr).toBe(0)
      expect(result.asked).toEqual([])
      expect(result.stdout).toContain('a partir de products-list')
    })

    it('nome inválido sai com 2 antes de perguntar', async () => {
      const { root } = newProject()
      const result = await run(['make:page', 'Produtos'], root, {
        interactive: true,
        answer: 'lista',
      })

      expect(result.code).toBe(2)
      expect(result.asked).toEqual([])
    })

    it('--dry-run também pergunta e não escreve nada', async () => {
      const { root } = newProject()
      const before = snapshot(root)
      const result = await run(['make:page', 'produtos', '--dry-run'], root, {
        interactive: true,
        answer: 'lista',
      })

      expect(result.code, result.stderr).toBe(0)
      expect(result.asked).toHaveLength(1)
      expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
      expect(snapshot(root)).toEqual(before)
    })
  })

  it('as opções da escolha trazem a tela de cada padrão como dica', () => {
    const choices = patternChoices()
    expect(choices).toHaveLength(11)
    expect(choices[1]).toEqual({
      value: 'lista',
      label: 'Lista com CRUD, filtros e CSV',
      hint: 'src/pages/products-list',
    })
    expect(choices[10]).toEqual({
      value: 'blank',
      label: 'Tela mínima',
      hint: 'src/pages/blank',
    })
  })
})

describe('formatSummary e testCommand', () => {
  it('lista criados e alterados, e omite o grupo vazio', () => {
    expect(formatSummary({ created: ['a.ts'], modified: [] }, false)).toBe('Criados (1):\n  a.ts\n')
    expect(formatSummary({ created: [], modified: ['b.ts', 'c.ts'] }, true)).toBe(
      'Seriam alterados (2):\n  b.ts\n  c.ts\n',
    )
  })

  it('escolhe o script test ou o vitest direto, e aponta a pasta quando é outra', () => {
    const { root } = newProject()
    const project = fixtureProject()
    expect(testCommand({ ...project, root }, root, 'produtos')).toBe(
      'pnpm exec vitest run src/pages/produtos',
    )
    writeFileSync(path.join(root, 'package.json'), '{ quebrado')
    expect(testCommand({ ...project, root }, root, 'produtos')).toBe(
      'pnpm exec vitest run src/pages/produtos',
    )
    writeFileSync(path.join(root, 'package.json'), '{ "scripts": { "test": "vitest run" } }')
    expect(testCommand({ ...project, root }, root, 'produtos')).toBe('pnpm test src/pages/produtos')
    expect(testCommand({ ...project, root }, path.dirname(root), 'produtos')).toBe(
      `pnpm --dir ${path.basename(root)} test src/pages/produtos`,
    )
    expect(testCommand({ ...project, root }, path.join(root, 'src'), 'produtos')).toBe(
      `pnpm --dir ${root} test src/pages/produtos`,
    )
  })
})

describe('bin prumo make:page', () => {
  const bin = path.join(import.meta.dirname, '..', 'bin.ts')

  it('roda de verdade: gera a tela no projeto e sai com 0', () => {
    const { root } = newProject()
    const result = spawnSync(
      process.execPath,
      [bin, 'make:page', 'produtos', '--like', 'products-list'],
      { encoding: 'utf8', cwd: root },
    )

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Criados (10):')
    expect(read(root, 'src/pages/produtos/index.tsx')).toContain('ProdutosPage')
  })

  it('sai com 2 no bin quando a tela já existe', () => {
    const { root } = newProject()
    const result = spawnSync(
      process.execPath,
      [bin, 'make:page', 'invoice-detail', '--like', 'products-list'],
      { encoding: 'utf8', cwd: root },
    )
    expect(result.status).toBe(2)
    expect(result.stderr).toContain("a tela 'invoice-detail' já existe em src/pages")
  })
})
