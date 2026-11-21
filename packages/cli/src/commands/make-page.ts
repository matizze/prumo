import { defineCommand } from 'citty'
import { check } from '@matizze/prumo-rules/check'
import path from 'node:path'
import { assertValidName, generatePage, pageFolder } from '../codemod/index.ts'
import { ExitError } from '../errors.ts'
import {
  MINIMAL_SCREEN,
  PATTERNS,
  patternNames,
  referenceOfChoice,
  resolveReference,
} from '../patterns.ts'
import { findProject, type Project } from '../project.ts'
import type { Choice, Runtime } from '../runtime.ts'
import { formatViolation } from './check.ts'
import { formatSummary, testCommandFor } from './shared.ts'

/**
 * A tela de referência do comando: o `--like` (nome de padrão ou de tela), ou, sem ele, a escolha
 * no terminal interativo, ou a tela mínima fora dele. Cancelar a escolha sai com 1, sem gerar nada.
 */
async function chooseReference(runtime: Runtime, like: string | undefined): Promise<string> {
  if (like !== undefined) return resolveReference(like)
  if (!runtime.interactive) return MINIMAL_SCREEN
  const choice = await runtime.choose('Qual padrão de tela?', patternChoices())
  if (choice === undefined) throw new ExitError(1, 'cancelado: nada foi gerado.')
  return referenceOfChoice(choice)
}

/**
 * O comando que roda os testes da tela nova, para o mesmo terminal onde o `make:page` rodou
 * (ver `testCommandFor`).
 */
export function testCommand(project: Project, cwd: string, name: string): string {
  return testCommandFor(project, cwd, pageFolder(name))
}

/** As opções da escolha interativa: os dez padrões e, por último, a tela mínima. */
export function patternChoices(): Choice[] {
  return [
    ...PATTERNS.map((pattern) => ({
      value: pattern.name,
      label: pattern.label,
      hint: `src/pages/${pattern.screen}`,
    })),
    { value: MINIMAL_SCREEN, label: 'Tela mínima', hint: `src/pages/${MINIMAL_SCREEN}` },
  ]
}

/**
 * `prumo make:page <nome> [--like <padrão ou tela>]`: copia a tela de referência do próprio
 * projeto para a tela nova, renomeia pela estrutura do código e faz as costuras (mensagens,
 * rota e, com `--menu`, o menu). O `--like` aceita o nome de um padrão (`lista`) ou de uma tela
 * (`products-list`). Sem ele, num terminal interativo pergunta o padrão (com a opção "tela
 * mínima"), e fora dele gera a tela mínima. Valida tudo antes de escrever, então um erro de uso
 * (saída 2) não deixa o projeto pela metade, e `--dry-run` só lista o que seria feito. Ao
 * terminar, roda a análise do `prumo check` e mostra o comando dos testes da tela nova; o
 * `check` com violação sai com 1, já com a tela gerada.
 */
export function createMakePageCommand(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'make:page',
      description: `Gera uma tela nova a partir de um padrão ou de uma tela de referência do projeto.

Copia src/pages/<tela>/ para src/pages/<nome>/, renomeia pela estrutura do código (componentes,
hook, namespace dos textos, títulos das stories, rota e testes) e faz as costuras: as mensagens
nos dois idiomas, a rota no src/App.tsx (com o mesmo layout da referência) e, com --menu, o item
do menu lateral. A rota nova é /<nome> mais os parâmetros da rota da referência (por exemplo,
/pedidos/:id); numa referência dentro de um <Route nest>, a tela entra no mesmo nest.

O --like aceita o nome de um padrão ou o de uma tela de src/pages. Os padrões são ${patternNames()}.
Sem --like, num terminal interativo o comando pergunta o padrão (com a opção "tela mínima"); fora
dele (CI, agentes), gera a tela mínima, a partir de ${MINIMAL_SCREEN}.

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
        valueHint: 'padrão|tela',
        description:
          'Padrão ou tela de referência (uma pasta de src/pages). Sem ele, pergunta o padrão no terminal ou gera a tela mínima.',
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
    async run({ args }) {
      const project = findProject(path.resolve(runtime.cwd, args.root ?? '.'))
      const dryRun = Boolean(args['dry-run'])
      // O nome é conferido antes de perguntar: não vale escolher um padrão para um nome inválido
      assertValidName(args.nome, 'o nome da tela')
      const like = await chooseReference(runtime, args.like)
      const { plan, route, from, to, ownMessages } = generatePage(project, {
        name: args.nome,
        like,
        menu: args.menu,
      })

      const heading = `prumo make:page: ${to.kebab} a partir de ${from.kebab}, na rota ${route}.${
        ownMessages
          ? ''
          : `\nA referência não tem arquivo de mensagens próprio (usa namespaces compartilhados): '${to.kebab}' não ganha um.`
      }`
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
