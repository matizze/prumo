import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { PlanSummary } from '../codemod/index.ts'
import type { Project } from '../project.ts'

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
 * O comando que roda os testes de uma pasta do projeto (`src/pages/produtos`), para o mesmo
 * terminal onde o `make:*` rodou: usa o script `test` do projeto, se houver, e o Vitest direto,
 * se não. Fora da pasta atual, o `pnpm --dir` aponta para o projeto.
 */
export function testCommandFor(project: Project, cwd: string, folder: string): string {
  const run = hasTestScript(project) ? `test ${folder}` : `exec vitest run ${folder}`
  const relative = path.relative(cwd, project.root)
  if (relative === '') return `pnpm ${run}`
  // Fora da pasta atual, o caminho absoluto é mais claro que uma subida de várias pastas
  return `pnpm --dir ${relative.startsWith('..') ? project.root : relative} ${run}`
}
