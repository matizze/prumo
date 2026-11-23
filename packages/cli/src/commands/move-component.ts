import { defineCommand } from 'citty'
import path from 'node:path'
import { moveComponent } from '../generate/move-component.ts'
import { findProject } from '../project.ts'
import type { Runtime } from '../runtime.ts'
import { checkBefore, finishWithCheck, formatSummary, testCommandFor } from './shared.ts'

/**
 * `prumo move:component <nome> --from <tela> --shared`: promove um componente de tela a
 * compartilhado. Move o componente e o teste dele para `src/components/shared/` e reescreve os
 * imports que apontam para ele. Valida tudo antes de mexer e aceita `--dry-run`. Ao terminar, roda
 * o `prumo check`; o componente usado por uma tela só aparece como esperado (`shared-usage`).
 */
export function createMoveComponentCommand(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'move:component',
      description: `Promove um componente de uma tela a compartilhado (src/components/shared/).

Move <nome>.tsx e o teste dele de src/pages/<tela>/components/ para src/components/shared/, e
reescreve para @/components/shared/<nome> todo import que apontava para o componente (na tela de
origem e em qualquer outro arquivo de src, inclusive vi.mock). Use quando uma segunda tela passa a
precisar de um componente que nasceu numa tela, em vez de gerar um segundo com make:component
--shared. O destino é sempre --shared; o caminho inverso (de shared para uma tela) não existe.

O prumo check cobra que o que está em shared seja usado por 2 ou mais telas: logo depois da
mudança, o componente ainda é de uma tela só, e o comando avisa isso sem falhar até a segunda
tela importá-lo.

Valida tudo antes de mexer e recusa quando algo estaria no caminho. Sai com código 1 se o check
achar outra violação nova, causada por ele (a mudança já foi feita; a violação que já existia
antes aparece como preexistente e não conta) e com 2 se o uso está errado: nome inválido ou
reservado, sem --shared, tela ou componente que não existe, componente que já existe em shared,
componente que importa algo de uma tela.`,
    },
    args: {
      nome: {
        type: 'positional',
        required: true,
        description: 'Nome do componente, em kebab-case (por exemplo, formulario-de-livro).',
      },
      from: {
        type: 'string',
        required: true,
        valueHint: 'tela',
        description: 'A tela de onde o componente sai (src/pages/<tela>/components/).',
      },
      shared: {
        type: 'boolean',
        description: 'O destino: o componente passa a ser de uso comum (src/components/shared/).',
      },
      root: {
        type: 'string',
        valueHint: 'pasta',
        description: 'Pasta do projeto, a que tem o src. Padrão: a pasta atual.',
      },
      'dry-run': {
        type: 'boolean',
        description: 'Só lista o que seria movido e alterado, sem escrever nada.',
      },
    },
    run({ args }) {
      const project = findProject(path.resolve(runtime.cwd, args.root ?? '.'))
      const { plan, names, page, from, file } = moveComponent(project, {
        name: args.nome,
        from: args.from,
        shared: args.shared,
      })
      const heading = `prumo move:component: ${names.kebab} (de src/pages/${page.kebab}/components para src/components/shared).`

      if (args['dry-run']) {
        runtime.out(
          `${heading}\n\n${formatSummary(plan.summary(), true)}\nSimulação (--dry-run): nada foi escrito.\n`,
        )
        return
      }

      const before = checkBefore(project)
      const summary = plan.commit()
      runtime.out(`${heading}\n\n${formatSummary(summary, false)}\n`)

      const next = `O componente saiu de ${from} e agora é ${file}; os imports foram reescritos para '@/components/shared/${names.kebab}'.\n\nPara rodar os testes do projeto:\n  ${testCommandFor(project, runtime.cwd, 'src')}\n`
      finishWithCheck(runtime, project, {
        generated: 'o componente foi movido',
        next,
        before,
        expected: {
          matches: (violation) => violation.rule === 'shared-usage' && violation.file === file,
          intro: 'só a violação esperada de um componente shared ainda usado por uma tela:',
          note: 'Ela some quando uma segunda tela importar o componente.',
        },
      })
    },
  })
}
