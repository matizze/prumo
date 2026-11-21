import { defineCommand } from 'citty'
import { check } from '@matizze/prumo-rules/check'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { generatePage, pageFolder, type PlanSummary } from '../codemod/index.ts'
import { ExitError, UsageError } from '../errors.ts'
import { findProject, type Project } from '../project.ts'
import type { Runtime } from '../runtime.ts'
import { formatViolation } from './check.ts'

/** A lista de arquivos de um grupo, um por linha, com o título e a contagem. */
function section(title: string, files: string[]): string {
  if (files.length === 0) return ''
  return `${title} (${files.length}):\n${files.map((file) => `  ${file}`).join('\n')}\n`
}

/** O que o plano criou e alterou, em texto. `dryRun` troca os verbos para o futuro do pretérito. */
export function formatSummary({ created, modified }: PlanSummary, dryRun: boolean): string {
  const [made, changed] = dryRun ? ['Seriam criados', 'Seriam alterados'] : ['Criados', 'Alterados']
  return [section(made, created), section(changed, modified)].filter(Boolean).join('\n')
}

/** Se o projeto tem o script `test`, que roda o Vitest do projeto (no app de referência, o projeto `unit`). */
function hasTestScript(project: Project): boolean {
  const file = path.join(project.root, 'package.json')
  if (!existsSync(file)) return false
  try {
    const scripts = (JSON.parse(readFileSync(file, 'utf8')) as { scripts?: Record<string, string> })
      .scripts
    return typeof scripts?.test === 'string'
  } catch {
    return false
  }
}

/**
 * O comando que roda os testes da tela nova, para o mesmo terminal onde o `make:page` rodou: usa o
 * script `test` do projeto, se houver, e o Vitest direto, se não. Fora da pasta atual, o `pnpm
 * --dir` aponta para o projeto.
 */
export function testCommand(project: Project, cwd: string, name: string): string {
  const folder = pageFolder(name)
  const run = hasTestScript(project) ? `test ${folder}` : `exec vitest run ${folder}`
  const relative = path.relative(cwd, project.root)
  if (relative === '') return `pnpm ${run}`
  // Fora da pasta atual, o caminho absoluto é mais claro que uma subida de várias pastas
  return `pnpm --dir ${relative.startsWith('..') ? project.root : relative} ${run}`
}

/**
 * `prumo make:page <nome> --like <tela>`: copia a tela de referência do próprio projeto para a
 * tela nova, renomeia pela estrutura do código e faz as costuras (mensagens, rota e, com
 * `--menu`, o menu). Valida tudo antes de escrever, então um erro de uso (saída 2) não deixa o
 * projeto pela metade, e `--dry-run` só lista o que seria feito. Ao terminar, roda a análise do
 * `prumo check` e mostra o comando dos testes da tela nova; o `check` com violação sai com 1,
 * já com a tela gerada.
 */
export function createMakePageCommand(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'make:page',
      description: `Gera uma tela nova a partir de uma tela de referência do projeto.

Copia src/pages/<tela>/ para src/pages/<nome>/, renomeia pela estrutura do código (componentes,
hook, namespace dos textos, títulos das stories, rota e testes) e faz as costuras: as mensagens
nos dois idiomas, a rota no src/App.tsx e, com --menu, o item do menu lateral. A rota nova é
/<nome> mais os parâmetros da rota da referência (por exemplo, /pedidos/:id).

Valida tudo antes de escrever. Ao terminar, roda o prumo check e mostra o comando dos testes da
tela nova. Sai com código 1 se o check achar violação (a tela já foi gerada) e com 2 se o uso
está errado: nome inválido, tela que já existe, referência ou rota da referência que não existem.`,
    },
    args: {
      // O nome do argumento aparece na ajuda e nas mensagens de erro: `<nome>`
      nome: {
        type: 'positional',
        required: true,
        description: 'Nome da tela nova, em kebab-case (por exemplo, pedidos-recentes).',
      },
      like: {
        type: 'string',
        required: true,
        valueHint: 'tela',
        description: 'Tela de referência, a pasta de src/pages que será copiada.',
      },
      root: {
        type: 'string',
        valueHint: 'pasta',
        description: 'Pasta do projeto, a que tem o src. Padrão: a pasta atual.',
      },
      menu: {
        type: 'string',
        valueHint: 'grupo',
        description: 'Grupo do menu lateral que ganha o item da tela (por exemplo, ecommerce).',
      },
      'dry-run': {
        type: 'boolean',
        description: 'Só lista o que seria criado e alterado, sem escrever nada.',
      },
    },
    run({ args }) {
      const project = findProject(path.resolve(runtime.cwd, args.root ?? '.'))
      const dryRun = Boolean(args['dry-run'])
      // O validateArgs já recusou a falta de --like; a conferência é para o tipo
      if (args.like === undefined) throw new UsageError('a opção --like é obrigatória.')
      const { plan, route, from, to } = generatePage(project, {
        name: args.nome,
        like: args.like,
        menu: args.menu,
      })

      const heading = `prumo make:page: ${to.kebab} a partir de ${from.kebab}, na rota ${route}.`
      if (dryRun) {
        runtime.out(
          `${heading}\n\n${formatSummary(plan.summary(), true)}\nSimulação (--dry-run): nada foi escrito.\n`,
        )
        return
      }

      const summary = plan.commit()
      runtime.out(`${heading}\n\n${formatSummary(summary, false)}\n`)

      const violations = check({ root: project.root })
      const tests = `Para rodar os testes da tela nova:\n  ${testCommand(project, runtime.cwd, to.kebab)}\n`
      if (violations.length === 0) {
        runtime.out(`prumo check: nenhuma violação.\n\n${tests}`)
        return
      }
      const total = violations.length === 1 ? '1 violação' : `${violations.length} violações`
      runtime.err(
        `prumo check: ${total} (a tela foi gerada, e os arquivos ficaram no projeto):\n${violations.map(formatViolation).join('\n')}\n`,
      )
      runtime.out(`\n${tests}`)
      throw new ExitError(1)
    },
  })
}
