import type { PlanSummary } from '../lib/plan.ts'

/** Uma seção da saída: o título com a contagem e um arquivo por linha; vazia se não há arquivo. */
function section(title: string, files: string[]): string {
  if (files.length === 0) return ''
  return `${title} (${files.length}):\n${files.map((file) => `  ${file}`).join('\n')}\n`
}

/** Os arquivos criados e alterados de um plano, como os comandos `make:*` os mostram. */
export function formatSummary({ created, modified }: PlanSummary, dryRun: boolean): string {
  const [made, changed] = dryRun
    ? ['Seriam criados', 'Seriam alterados']
    : ['Criados', 'Alterados']
  return [section(made, created), section(changed, modified)].filter(Boolean).join('\n')
}
