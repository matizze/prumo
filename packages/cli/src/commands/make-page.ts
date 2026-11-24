import path from 'node:path'
import { UsageError } from '../errors.ts'
import { generatePage } from '../generators/page.ts'
import { testCommandFor } from '../lib/pnpm.ts'
import { findProject } from '../lib/project.ts'
import { formatSummary } from './summary.ts'
import type { RegisterCommand } from './index.ts'

type MakePageOptions = {
  query?: string
  path?: string
  root: string
  dryRun?: boolean
}

/** Recusa a opção dada sem valor (`--query ''`): o commander a aceita. */
function nonEmpty(option: string) {
  return (value: string): string => {
    if (value.trim() === '') throw new UsageError(`a opção '${option}' precisa de um valor.`)
    return value
  }
}

/**
 * `prumo make:page <nome>`: cria uma tela (`index`, `model`, `view` e o teste), as mensagens nos
 * idiomas do projeto, o namespace nos índices de mensagens e a rota no `src/App.tsx`. O gerador
 * valida tudo e monta o plano antes de escrever, então um erro de uso (saída 2) não deixa nada pela
 * metade; `--dry-run` só mostra o plano.
 */
export const registerMakePage: RegisterCommand = (program, io) => {
  program
    .command('make:page')
    .summary('Cria uma tela: index, model, view, teste, mensagens e rota.')
    .description(
      `Cria uma tela nova: index, model, view, teste, mensagens e rota.

Cria src/pages/<nome>/ com o index.tsx (liga o model à view), o model.ts (dados e textos, sem JSX), a view.tsx (só tags nativas, recebe tudo por props) e o index.test.tsx (renderiza com o renderWithProviders do projeto, de @/test/render, e confere o título). Cria as mensagens em src/messages/<idioma>/<nome>.json (title e os textos da tela), registra o namespace nos índices de mensagens de cada idioma e a rota (padrão /<nome>) no src/App.tsx.

O <nome> é o da tela, em kebab-case (clientes, pedidos-recentes). Sem --query, a tela só tem o título. Com --query <domínio>, o model lê a lista do domínio (use<Domínio>List, de @/queries, criado por make:query) e a view mostra o carregando, o erro e a lista, com o primeiro campo de texto de cada registro (lido do schema que o projeto tem hoje; sem campo de texto, ou sem conseguir ler o schema, mostra o id e avisa). A entidade sai do contrato do repositório, sem --entity.

Com --path <caminho> a rota é a do caminho (por exemplo, --path /clientes/:id), em vez de /<nome>. O caminho começa com /, tem segmentos fixos e, no máximo, um parâmetro :nome (sem ?, * nem +), e não pode repetir nem conflitar com uma rota do App.tsx. Com parâmetro, o model lê o valor com o useParams do wouter e a view o mostra, e o teste renderiza a tela dentro de <Route path="..."> com um valor de exemplo. Com --query e parâmetro, é a tela de detalhe: o model busca o registro com o use<Entidade>Detail do domínio e a view mostra o carregando, o erro e o mesmo campo.

Valida tudo antes de escrever e nunca sobrescreve. Saem com 2, sem deixar nada pela metade: nome inválido ou reservado; tela que já existe; caminho inválido, repetido ou que conflita com uma rota; query que falta (a dica é prumo make:query <domínio>); App.tsx ou índice de mensagens que falta. --dry-run lista o que seria criado e alterado, sem escrever. No fim, mostra o que fez, os avisos e o comando dos testes da tela.`,
    )
    .argument('<nome>', 'O nome da tela, em kebab-case (por exemplo, clientes).')
    .option(
      '--query <domínio>',
      'O domínio cuja query a tela usa (por exemplo, clientes): lista, ou detalhe com um caminho com parâmetro. Padrão: nenhum.',
      nonEmpty('--query'),
    )
    .option(
      '--path <caminho>',
      'O caminho da rota, com um parâmetro opcional (por exemplo, /clientes/:id). Padrão: /<nome>.',
      nonEmpty('--path'),
    )
    .option('--root <pasta>', 'A pasta do projeto, a que tem o src.', '.')
    .option('--dry-run', 'Só lista o que seria criado e alterado, sem escrever nada.')
    .action((name: string, options: MakePageOptions) => {
      if (options.root === '') throw new UsageError("a opção '--root' precisa de um valor.")
      const project = findProject(path.resolve(io.cwd, options.root))
      const { plan, names, query, route, warnings } = generatePage(project, {
        name,
        query: options.query,
        route: options.path,
      })
      const dryRun = options.dryRun === true
      const summary = dryRun ? plan.verify() : plan.commit()
      const heading = `prumo make:page: ${names.kebab} (rota ${route}${query ? `, query ${query.kebab}` : ''})${dryRun ? ' (simulação)' : ''}.`
      const warningLines = warnings.map((warning) => `Aviso: ${warning}\n`).join('')
      const warningText = warningLines === '' ? '' : `${warningLines}\n`
      const ending = dryRun
        ? 'Simulação (--dry-run): nada foi escrito.\n'
        : `Edite o model (src/pages/${names.kebab}/model.ts), a view (view.tsx) e os textos (src/messages/<idioma>/${names.kebab}.json); o teste acompanha.\n\nPara rodar os testes da tela nova:\n  ${testCommandFor(project, io.cwd, `src/pages/${names.kebab}`)}\n`
      io.out(`${heading}\n\n${formatSummary(summary, dryRun)}\n${warningText}${ending}`)
    })
}
