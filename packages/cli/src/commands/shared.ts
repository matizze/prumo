import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { check, type Violation } from '@matizze/prumo-rules/check'
import type { PlanSummary } from '../codemod/index.ts'
import { ExitError } from '../errors.ts'
import type { Project } from '../project.ts'
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

/** Se o projeto tem o script do `package.json` (`test` roda o Vitest do projeto). */
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
 * para o mesmo terminal onde o `make:*` rodou: usa o script `test` do projeto, se houver, e o
 * Vitest direto, se não.
 */
export function testCommandFor(project: Project, cwd: string, target: string): string {
  const run = hasScript(project, 'test') ? `test ${target}` : `exec vitest run ${target}`
  return pnpmCommand(project, cwd, run)
}

/** Uma violação que o comando já espera do que gerou: ela é mostrada, mas não faz o comando falhar. */
export interface ExpectedViolation {
  matches: (violation: Violation) => boolean
  /** A frase que abre a lista, depois de `prumo check:` (`só a violação esperada ...:`). */
  intro: string
  /** O que a pessoa precisa saber sobre ela, depois da lista. */
  note: string
}

/**
 * O fim de um comando `make:*`: roda o `prumo check` no projeto e escreve o resultado, seguido do
 * `next` (o que fazer agora). Sem violação, sai normalmente. Com violação, escreve cada uma no
 * stderr e sai com 1, já com os arquivos gerados (`generated`: `a tela foi gerada`). As violações
 * que `expected` reconhece não contam como falha: o comando as mostra e explica.
 */
export function finishWithCheck(
  runtime: Runtime,
  project: Project,
  { generated, next, expected }: { generated: string; next: string; expected?: ExpectedViolation },
): void {
  const violations = check({ root: project.root })
  const known = expected ? violations.filter(expected.matches) : []
  const found = violations.filter((violation) => !known.includes(violation))

  if (found.length === 0) {
    if (expected && known.length > 0) {
      runtime.out(
        `prumo check: ${expected.intro}\n${known.map(formatViolation).join('\n')}\n${expected.note}\n\n${next}`,
      )
    } else runtime.out(`prumo check: nenhuma violação.\n\n${next}`)
    return
  }
  const total = found.length === 1 ? '1 violação' : `${found.length} violações`
  runtime.err(
    `prumo check: ${total} (${generated}, e os arquivos ficaram no projeto):\n${found.map(formatViolation).join('\n')}\n`,
  )
  runtime.out(`\n${next}`)
  throw new ExitError(1)
}
