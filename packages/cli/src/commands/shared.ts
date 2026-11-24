import { UsageError } from '../errors.ts'
import type { ChangePlan, PlanSummary } from '../lib/plan.ts'

/** A opção `--root`, a mesma em todo comando que acha o projeto: `.option(...ROOT_OPTION)`. */
export const ROOT_OPTION: [flags: string, description: string] = [
  '--root <pasta>',
  'A pasta do projeto, a que tem o src. Padrão: a pasta atual ou a primeira acima com package.json e src.',
]

/** A opção `--dry-run` dos comandos `make:*`: `.option(...DRY_RUN_OPTION)`. */
export const DRY_RUN_OPTION: [flags: string, description: string] = [
  '--dry-run',
  'Só lista o que seria criado e alterado, sem escrever nada.',
]

/** Recusa a opção dada sem valor (`--entity ''`): o commander a aceita. */
export function nonEmpty(option: string) {
  return (value: string): string => {
    if (value.trim() === '') throw new UsageError(`a opção '${option}' precisa de um valor.`)
    return value
  }
}

/** Uma seção da saída: o título com a contagem e um arquivo por linha; vazia se não há arquivo. */
export function section(title: string, files: string[]): string {
  if (files.length === 0) return ''
  return `${title} (${files.length}):\n${files.map((file) => `  ${file}`).join('\n')}\n`
}

/** Os arquivos criados e alterados de um plano, como os comandos `make:*` os mostram. */
function formatSummary({ created, modified }: PlanSummary, dryRun: boolean): string {
  const [made, changed] = dryRun
    ? ['Seriam criados', 'Seriam alterados']
    : ['Criados', 'Alterados']
  return [section(made, created), section(changed, modified)].filter(Boolean).join('\n')
}

/** O fecho do `--dry-run`, no lugar do próximo passo. */
export const DRY_RUN_ENDING = 'Simulação (--dry-run): nada foi escrito.\n'

/** O que um comando `make:*` mostra do plano que executou. */
export interface PlanReport {
  dryRun: boolean
  /** O sufixo do título: ` (simulação)` no `--dry-run`, vazio fora dele. */
  mark: string
  /** A lista dos arquivos criados e alterados. */
  files: string
}

/** Grava o plano, ou só o confere com `--dry-run`, e devolve o que o comando mostra dele. */
export function runPlan(plan: ChangePlan, options: { dryRun?: boolean }): PlanReport {
  const dryRun = options.dryRun === true
  const summary = dryRun ? plan.verify() : plan.commit()
  return {
    dryRun,
    mark: dryRun ? ' (simulação)' : '',
    files: formatSummary(summary, dryRun),
  }
}

/** Os avisos do gerador, um `Aviso:` por linha e uma linha em branco depois; vazio se não há aviso. */
export function formatWarnings(warnings: string[]): string {
  if (warnings.length === 0) return ''
  return `${warnings.map((warning) => `Aviso: ${warning}\n`).join('')}\n`
}
