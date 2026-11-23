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

/** A identidade de uma violação, para compará-la antes e depois: a regra, o arquivo e o texto. */
function violationKey({ rule, file, message }: Violation): string {
  return `${rule}\u0000${file}\u0000${message}`
}

/**
 * O `prumo check` do projeto antes de o comando escrever qualquer coisa: o que já estava errado
 * não é culpa do `make:*`. Chame antes do `plan.commit()` e passe o resultado ao `finishWithCheck`.
 */
export function checkBefore(project: Project): Violation[] {
  return check({ root: project.root })
}

/**
 * O fim de um comando `make:*`: roda o `prumo check` no projeto e escreve o resultado, seguido do
 * `next` (o que fazer agora). O comando falha (saída 1, já com os arquivos gerados: `generated`,
 * `a tela foi gerada`) só pelo que **ele** causou: a violação que já existia no `before` (o check
 * de antes da geração) é mostrada como preexistente e não muda o código de saída, e a que
 * `expected` reconhece (do próprio comando) é mostrada e explicada.
 */
export function finishWithCheck(
  runtime: Runtime,
  project: Project,
  {
    generated,
    next,
    expected,
    before = [],
  }: { generated: string; next: string; expected?: ExpectedViolation; before?: Violation[] },
): void {
  const violations = check({ root: project.root })
  const existing = new Set(before.map(violationKey))
  const preexisting = violations.filter((violation) => existing.has(violationKey(violation)))
  const caused = violations.filter((violation) => !existing.has(violationKey(violation)))
  const known = expected ? caused.filter(expected.matches) : []
  const found = caused.filter((violation) => !known.includes(violation))

  const old =
    preexisting.length === 0
      ? ''
      : `\nPreexistentes (${preexisting.length}; já estavam no projeto antes deste comando e não mudam o código de saída):\n${preexisting.map((violation) => `  ${formatViolation(violation)}`).join('\n')}\n`

  if (found.length === 0) {
    if (expected && known.length > 0) {
      runtime.out(
        `prumo check: ${expected.intro}\n${known.map(formatViolation).join('\n')}\n${expected.note}\n${old}\n${next}`,
      )
    } else if (preexisting.length > 0) {
      runtime.out(`prumo check: nenhuma violação nova.\n${old}\n${next}`)
    } else runtime.out(`prumo check: nenhuma violação.\n\n${next}`)
    return
  }
  const total = found.length === 1 ? '1 violação' : `${found.length} violações`
  runtime.err(
    `prumo check: ${total} (${generated}, e os arquivos ficaram no projeto):\n${found.map(formatViolation).join('\n')}\n${old}`,
  )
  runtime.out(`\n${next}`)
  throw new ExitError(1)
}
