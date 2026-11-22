import { defineCommand } from 'citty'
import path from 'node:path'
import { generatePage } from '../generate/page.ts'
import { findProject } from '../project.ts'
import type { Runtime } from '../runtime.ts'
import { finishWithCheck, formatSummary, testCommandFor } from './shared.ts'

/**
 * `prumo make:page <nome> [--domain <domínio>]`: gera uma tela a partir dos modelos do pacote
 * (nunca copiando outra tela do projeto): `index`, `model`, `view` e o teste, as mensagens nos
 * idiomas do projeto, o namespace nos índices de mensagens e a rota no `src/App.tsx`. Valida tudo
 * antes de escrever, então um erro de uso (saída 2) não deixa o projeto pela metade, e `--dry-run`
 * só lista o que seria feito. Ao terminar, roda o `prumo check`; com violação sai com 1, já com a
 * tela gerada.
 */
export function createMakePageCommand(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'make:page',
      description: `Gera uma tela nova: index, model, view, teste, mensagens e rota.

Cria src/pages/<nome>/ com o index.tsx (liga o model à view), o model.ts (dados e textos, sem JSX),
a view.tsx (só elementos HTML semânticos, recebe tudo por props) e o index.test.tsx (renderiza com o
renderWithProviders do projeto, de @/test/render, e confere o título). Cria as mensagens em
src/messages/<idioma>/<nome>.json (title e os textos da tela), registra o namespace nos índices de
mensagens de cada idioma e a rota /<nome> no src/App.tsx.

O nome é o da tela, em kebab-case (clientes, pedidos-recentes). Com --domain <domínio>, o model lê
a lista do domínio (use<Domínio>List, de @/queries, criado por make:domain) e a view mostra o
carregando, o erro e a lista; sem ele, a tela só tem o título.

Valida tudo antes de escrever e recusa sobrescrever. Ao terminar, roda o prumo check e mostra o
comando dos testes da tela nova. Sai com código 1 se o check achar violação (a tela já foi gerada)
e com 2 se o uso está errado: nome inválido ou reservado, tela que já existe, domínio que falta,
App.tsx ou índice de mensagens que falta.`,
    },
    args: {
      nome: {
        type: 'positional',
        required: true,
        description: 'Nome da tela, em kebab-case (por exemplo, clientes).',
      },
      domain: {
        type: 'string',
        valueHint: 'domínio',
        description: 'Domínio cuja lista a tela mostra (por exemplo, clientes). Padrão: nenhum.',
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
      const { plan, names, domain, route } = generatePage(project, {
        name: args.nome,
        domain: args.domain,
      })
      const heading = `prumo make:page: ${names.kebab} (rota ${route}${domain ? `, domínio ${domain.kebab}` : ''}).`

      if (args['dry-run']) {
        runtime.out(
          `${heading}\n\n${formatSummary(plan.summary(), true)}\nSimulação (--dry-run): nada foi escrito.\n`,
        )
        return
      }

      const summary = plan.commit()
      runtime.out(`${heading}\n\n${formatSummary(summary, false)}\n`)

      const next = `Edite o model (src/pages/${names.kebab}/model.ts), a view (view.tsx) e os textos (src/messages/<idioma>/${names.kebab}.json); o teste acompanha.\n\nPara rodar os testes da tela nova:\n  ${testCommandFor(project, runtime.cwd, `src/pages/${names.kebab}`)}\n`
      finishWithCheck(runtime, project, { generated: 'a tela foi gerada', next })
    },
  })
}
