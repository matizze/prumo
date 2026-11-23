import { defineCommand } from 'citty'
import path from 'node:path'
import { generateComponent } from '../generate/component.ts'
import { findProject } from '../project.ts'
import type { Runtime } from '../runtime.ts'
import { checkBefore, finishWithCheck, formatSummary, testCommandFor } from './shared.ts'

/**
 * `prumo make:component <nome> --page <tela>` ou `--shared`: gera um componente (só HTML) e o teste
 * dele a partir dos modelos do pacote, em `src/pages/<tela>/components/` ou em
 * `src/components/shared/`. Valida tudo antes de escrever e aceita `--dry-run`. Ao terminar, roda o
 * `prumo check`; o componente `--shared` ainda sem uso em duas telas aparece como esperado, e não
 * faz o comando falhar.
 */
export function createMakeComponentCommand(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'make:component',
      description: `Gera um componente novo, só com elementos HTML, e o teste dele.

Com --page <tela>, o componente é da tela e vai para src/pages/<tela>/components/ (a tela precisa
existir, crie-a com make:page). Com --shared, vai para src/components/shared/, que é o lugar do que
duas ou mais telas usam. Use um dos dois.

O nome é o do componente, em kebab-case (resumo-do-pedido): o arquivo é <nome>.tsx e o componente
exportado, em PascalCase. O prumo check cobra que o que está em shared seja usado por 2 ou mais
telas; um componente shared recém-gerado ainda não é, e o comando avisa isso sem falhar.

Valida tudo antes de escrever e recusa sobrescrever. Sai com código 1 se o check achar outra
violação nova, causada por ele (o componente já foi gerado; a violação que já existia antes
aparece como preexistente e não conta) e com 2 se o uso está errado: nome inválido ou reservado,
nem --page nem --shared (ou os dois), tela que não existe, componente que já existe.`,
    },
    args: {
      nome: {
        type: 'positional',
        required: true,
        description: 'Nome do componente, em kebab-case (por exemplo, resumo-do-pedido).',
      },
      page: {
        type: 'string',
        valueHint: 'tela',
        description: 'A tela dona do componente (src/pages/<tela>/components/).',
      },
      shared: {
        type: 'boolean',
        description: 'O componente é de uso comum (src/components/shared/).',
      },
      root: {
        type: 'string',
        valueHint: 'pasta',
        description: 'Pasta do projeto, a que tem o src. Padrão: a pasta atual.',
      },
      'dry-run': {
        type: 'boolean',
        description: 'Só lista o que seria criado, sem escrever nada.',
      },
    },
    run({ args }) {
      const project = findProject(path.resolve(runtime.cwd, args.root ?? '.'))
      const { plan, names, folder, file, page } = generateComponent(project, {
        name: args.nome,
        page: args.page,
        shared: args.shared,
      })
      const heading = `prumo make:component: ${names.kebab} (${folder}).`

      if (args['dry-run']) {
        runtime.out(
          `${heading}\n\n${formatSummary(plan.summary(), true)}\nSimulação (--dry-run): nada foi escrito.\n`,
        )
        return
      }

      const before = checkBefore(project)
      const summary = plan.commit()
      runtime.out(`${heading}\n\n${formatSummary(summary, false)}\n`)

      const use = page
        ? `Use-o na view da tela: import { ${names.pascal} } from './components/${names.kebab}'.`
        : `Importe-o nas telas que o usam: import { ${names.pascal} } from '@/components/shared/${names.kebab}'.`
      const next = `Edite o componente (${file}); o teste acompanha. ${use}\n\nPara rodar os testes do componente novo:\n  ${testCommandFor(project, runtime.cwd, folder)}\n`
      finishWithCheck(runtime, project, {
        generated: 'o componente foi gerado',
        next,
        before,
        expected: {
          matches: (violation) => violation.rule === 'shared-usage' && violation.file === file,
          intro: 'só a violação esperada de um componente shared ainda sem uso:',
          note: 'Ela some quando duas telas importarem o componente.',
        },
      })
    },
  })
}
