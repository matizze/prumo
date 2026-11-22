import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { PlanSummary } from '../codemod/index.ts'
import type { Project } from '../project.ts'
import type { Runtime } from '../runtime.ts'

/** A lista de arquivos de um grupo, um por linha, com o título e a contagem. */
export function section(title: string, files: string[]): string {
  if (files.length === 0) return ''
  return `${title} (${files.length}):\n${files.map((file) => `  ${file}`).join('\n')}\n`
}

/** O que o plano criou e alterou, em texto. `dryRun` troca os verbos para o futuro do pretérito. */
export function formatSummary(
  { created, modified, moved = [] }: PlanSummary,
  dryRun: boolean,
): string {
  const [made, changed, moves] = dryRun
    ? ['Seriam criados', 'Seriam alterados', 'Seriam movidos']
    : ['Criados', 'Alterados', 'Movidos']
  return [
    section(
      moves,
      moved.map(({ from, to }) => `${from} -> ${to}`),
    ),
    section(made, created),
    section(changed, modified),
  ]
    .filter(Boolean)
    .join('\n')
}

/** Se o projeto tem o script do `package.json` (`test` roda o Vitest do projeto; no app de referência, o projeto `unit`). */
function hasScript(project: Project, script: string): boolean {
  const file = path.join(project.root, 'package.json')
  if (!existsSync(file)) return false
  try {
    const scripts = (JSON.parse(readFileSync(file, 'utf8')) as { scripts?: Record<string, string> })
      .scripts
    return typeof scripts?.[script] === 'string'
  } catch {
    return false
  }
}

/**
 * O caminho como o shell o lê: sem mudança se só tem caracteres seguros, e entre aspas simples
 * (com `'` escrito como `'\''`) se tem espaço ou outro caractere especial. Sem isso, o comando
 * impresso, copiado para o terminal, quebraria num projeto com espaço no caminho.
 */
export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/**
 * O comando do `pnpm` para o projeto, no mesmo terminal onde o comando do `prumo` rodou: `pnpm
 * <comando>` na pasta do projeto e, fora dela, `pnpm --dir <pasta> <comando>`. Fora da pasta atual,
 * o caminho absoluto é mais claro que uma subida de várias pastas.
 */
export function pnpmCommand(project: Project, cwd: string, command: string): string {
  const relative = path.relative(cwd, project.root)
  if (relative === '') return `pnpm ${command}`
  return `pnpm --dir ${shellQuote(relative.startsWith('..') ? project.root : relative)} ${command}`
}

/**
 * O comando que roda os testes de uma pasta ou de um arquivo do projeto (`src/pages/produtos`),
 * para o mesmo terminal onde o `make:*` rodou: usa o script do projeto (`test`, por padrão; o das
 * stories é `test:storybook`), se houver, e o Vitest direto, se não.
 */
export function testCommandFor(
  project: Project,
  cwd: string,
  target: string,
  script = 'test',
): string {
  const run = hasScript(project, script) ? `${script} ${target}` : `exec vitest run ${target}`
  return pnpmCommand(project, cwd, run)
}

/** O ambiente dos subprocessos: o do processo, com o do runtime por cima. */
export function childEnv(runtime: Runtime): NodeJS.ProcessEnv {
  return { ...process.env, ...runtime.env }
}
