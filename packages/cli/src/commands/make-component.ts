import { defineCommand } from 'citty'
import { check } from '@matizze/prumo-rules/check'
import path from 'node:path'
import { generateComponent, REFERENCE_COMPONENT } from '../codemod/index.ts'
import { ExitError } from '../errors.ts'
import { findProject } from '../project.ts'
import type { Runtime } from '../runtime.ts'
import { formatViolation } from './check.ts'
import { formatSummary, testCommandFor } from './shared.ts'

/**
 * `prumo make:component <nome> --page <tela>`: gera um componente e a story dele em
 * `src/pages/<tela>/components/`, a partir de um componente pequeno do próprio projeto
 * (`storage-card`), renomeado pela estrutura do código. Valida tudo antes de escrever, então um
 * erro de uso (saída 2) não deixa o projeto pela metade, e `--dry-run` só lista o que seria feito.
 * Ao terminar, roda a análise do `prumo check` e mostra o comando do teste da story; o `check`
 * com violação sai com 1, já com os arquivos gerados.
 */
export function createMakeComponentCommand(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'make:component',
      description: `Gera um componente e a story dele numa tela do projeto.

Copia o componente de referência ${REFERENCE_COMPONENT.file} (src/pages/${REFERENCE_COMPONENT.page}/components/) para
src/pages/<tela>/components/<nome>.tsx e <nome>.stories.tsx e renomeia pela estrutura do código: o
componente (<Pascal>) e o tipo das props, o import da story e o título dela, que fica
Pages/<PascalDaTela>/<Pascal>. A story tem play function e roda com o axe nos dois temas.

O componente novo não precisa ser usado pela tela. As props, o visual e os textos da story são os
da referência, e o produto os edita. Um componente usado por duas ou mais telas é do
components/shared, e quem move é o prumo promote (ainda não existe).

Valida tudo antes de escrever. Ao terminar, roda o prumo check e mostra o comando do teste da
story. Sai com código 1 se o check achar violação (os arquivos já foram gerados) e com 2 se o uso
está errado: nome inválido, reservado ou global (Date, Promise), nome que repete um identificador da
story ou do componente de referência (Video, FolderIcon), tela que não existe, componente que já
existe.`,
    },
    args: {
      nome: {
        type: 'positional',
        required: true,
        description: 'Nome do componente, em kebab-case (por exemplo, resumo-do-pedido).',
      },
      page: {
        type: 'string',
        required: true,
        valueHint: 'tela',
        description:
          'A tela que recebe o componente: uma pasta de src/pages (por exemplo, orders).',
      },
      root: {
        type: 'string',
        valueHint: 'pasta',
        description: 'Pasta do projeto, a que tem o src. Padrão: a pasta atual.',
      },
      'dry-run': {
        type: 'boolean',
        description: 'Só lista o que seria criado e alterado, sem escrever nada.',
      },
    },
    run({ args }) {
      const project = findProject(path.resolve(runtime.cwd, args.root ?? '.'))
      const dryRun = Boolean(args['dry-run'])
      const { plan, from, to, page, storyTitle, story } = generateComponent(project, {
        name: args.nome,
        page: args.page,
      })

      const heading = `prumo make:component: ${to.pascal} na tela ${page.kebab}, a partir de ${from.pascal}.`
      if (dryRun) {
        runtime.out(
          `${heading}\n\n${formatSummary(plan.summary(), true)}\nSimulação (--dry-run): nada foi escrito.\n`,
        )
        return
      }

      const summary = plan.commit()
      runtime.out(`${heading}\n\n${formatSummary(summary, false)}\n`)

      const violations = check({ root: project.root })
      const next = `A story é '${storyTitle}'. As props, o visual e os textos são os de ${from.pascal}: edite o componente e a story.\n\nPara rodar o teste da story (play function e axe):\n  ${testCommandFor(project, runtime.cwd, story, 'test:storybook')}\n`
      if (violations.length === 0) {
        runtime.out(`prumo check: nenhuma violação.\n\n${next}`)
        return
      }
      const total = violations.length === 1 ? '1 violação' : `${violations.length} violações`
      runtime.err(
        `prumo check: ${total} (o componente foi gerado, e os arquivos ficaram no projeto):\n${violations.map(formatViolation).join('\n')}\n`,
      )
      runtime.out(`\n${next}`)
      throw new ExitError(1)
    },
  })
}
