import { spawnSync } from 'node:child_process'
import { accessSync, constants, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { Option } from 'commander'
import { ExitError, UsageError } from '../errors.ts'
import { generateApp } from '../generators/app.ts'
import type { Io } from '../io.ts'
import { appNameProblem } from '../lib/names.ts'
import { detectPnpmVersion, shellQuote } from '../lib/pnpm.ts'
import { runChild } from '../lib/process.ts'
import { readTarballs } from '../lib/tarballs.ts'
import { documentCommand } from './help-text.ts'
import type { RegisterCommand } from './index.ts'

/** O que o comando pede de fora do processo; os testes trocam por versões de mentira. */
export interface NewDeps {
  /** As variáveis de ambiente (só o `npm_config_user_agent` interessa). Padrão: as do processo. */
  env?: Readonly<Record<string, string | undefined>>
  /** Pergunta a versão ao pnpm quando o user agent não diz. Padrão: `pnpm --version`. */
  askPnpm?: () => string | undefined
  /** Roda o `pnpm install` na pasta e devolve o código de saída (e o motivo, se não chegou a rodar). Padrão: o pnpm de verdade. */
  install?: (io: Io, cwd: string) => { status: number; reason?: string }
}

type NewOptions = {
  dir?: string
  install: boolean
  packages?: string
  dryRun?: boolean
}

/**
 * Valida o destino: `<dir>/<nome>` não pode existir com conteúdo (uma pasta vazia serve), e o pai
 * não pode ser um arquivo. Devolve o caminho absoluto.
 */
function resolveDestination(io: Io, dir: string | undefined, name: string): string {
  const parent = path.resolve(io.cwd, dir ?? '.')
  // O ancestral mais próximo que existe: é nele que a pasta nova vai nascer
  let existing = parent
  while (!existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing)
  if (!statSync(existing).isDirectory()) {
    throw new UsageError(
      `'${existing}' não é uma pasta${existing === parent ? '' : `, e '${parent}' (--dir) ficaria dentro dela`} (--dir).`,
    )
  }
  try {
    accessSync(existing, constants.W_OK)
  } catch {
    throw new UsageError(`não posso escrever em '${existing}' (--dir): sem permissão.`)
  }
  const destination = path.join(parent, name)
  if (existsSync(destination)) {
    if (!statSync(destination).isDirectory()) {
      throw new UsageError(`'${destination}' já existe e não é uma pasta.`)
    }
    if (readdirSync(destination).length > 0) {
      throw new UsageError(
        `a pasta '${destination}' já existe e não está vazia: escolha outro nome ou outra pasta (--dir).`,
      )
    }
  }
  return destination
}

/** `git init`, sem commit: quem criou o app decide o primeiro commit. Falhar só avisa. */
function initGit(io: Io, destination: string): void {
  const result = spawnSync('git', ['init', '--quiet'], { cwd: destination, encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    io.err(
      `prumo new: não consegui rodar git init em '${destination}': ${result.error?.message ?? result.stderr.trim()}\n`,
    )
  }
}

function pnpmInstall(io: Io, cwd: string): { status: number; reason?: string } {
  const result = runChild(io, 'pnpm', ['install'], { cwd })
  if (result.error) return { status: 1, reason: result.error.message }
  return { status: result.status ?? 1 }
}

/** O que fazer depois: entrar na pasta, instalar se faltou, conferir, subir o app e gerar as camadas. */
function nextSteps(io: Io, destination: string, installed: boolean): string {
  const relative = path.relative(io.cwd, destination)
  const folder = shellQuote(relative.startsWith('..') ? destination : relative)
  const steps = [
    `cd ${folder}`,
    ...(installed ? [] : ['pnpm install']),
    'pnpm verify                                   # typecheck, lint, test e check',
    'pnpm dev                                      # o app em http://localhost:5173',
    'pnpm exec prumo make:page <tela>              # uma tela, com a rota e as mensagens',
  ]
  const docs = 'A documentação (tutorial, conceitos e guias): https://docs.prumo.matizze.com.br'
  return `\nPróximos passos:\n${steps.map((step) => `  ${step}`).join('\n')}\n\n${docs}\n`
}

/**
 * `prumo new <nome>`: cria um app mínimo do Prumo. O gerador monta o plano do app inteiro (os
 * modelos, o `package.json` e a tela inicial) antes de escrever qualquer coisa, e o nome, o destino
 * e os tarballs são conferidos antes dele: um erro de uso não deixa pasta pela metade. Depois roda
 * `git init` (sem commit) e `pnpm install`, a não ser com `--no-install`.
 */
export function createNewCommand(deps: NewDeps = {}): RegisterCommand {
  return (program, io) => {
    const command = program
      .command('new')
      .summary('Cria um app React mínimo do Prumo, sem CSS e sem design system.')
      .description(
        'Cria um app React mínimo do Prumo, sem CSS e sem design system.\n\nGera a estrutura em camadas e a tela inicial, roda git init e pnpm install.',
      )
      .argument('<nome>', 'O nome do app, em kebab-case (meu-app): a pasta e o nome do pacote.')
      .option('--dir <pasta>', 'A pasta onde criar <nome>.', '.')
      .addOption(
        new Option(
          '--packages <pasta>',
          'Uma pasta com os tarballs dos pacotes @matizze/prumo-* (pnpm pack:all), instalados no lugar do registry.',
        ).hideHelp(),
      )
      .option('--no-install', 'Não roda o pnpm install: só cria os arquivos.')
      .option('--dry-run', 'Só lista o que seria criado, sem escrever nada.')
      .action((name: string, options: NewOptions) => {
        const dryRun = options.dryRun === true
        const install = options.install

        // Tudo que dá para conferir, antes de escrever qualquer coisa
        const problem = appNameProblem(name)
        if (problem) throw new UsageError(problem)
        const destination = resolveDestination(io, options.dir, name)
        const packagesDir =
          options.packages === undefined ? undefined : path.resolve(io.cwd, options.packages)
        const overrides = packagesDir === undefined ? undefined : readTarballs(packagesDir)

        const plan = generateApp({
          root: destination,
          name,
          overrides,
          pnpm: detectPnpmVersion(deps.env ?? process.env, deps.askPnpm),
        })
        // O --dry-run confere o plano com as mesmas regras do commit (links para fora do destino)
        const files = (dryRun ? plan.verify() : plan.summary()).created

        // O commit desfaz o que escreveu se uma escrita falha: nada fica pela metade
        if (!dryRun) plan.commit()

        const packagesLine = packagesDir
          ? `Pacotes do Prumo: tarballs de ${packagesDir} (pnpm.overrides com file:).`
          : 'Pacotes do Prumo: do registry, pela versão (^<versão>) no package.json.'
        const heading = `prumo new: ${name}${dryRun ? ' (simulação)' : ''}.\nDestino: ${destination}\n`
        const list = `${dryRun ? 'Seriam criados' : 'Criados'} (${files.length}):\n${files.map((file) => `  ${file}`).join('\n')}\n`
        if (dryRun) {
          io.out(
            `${heading}\n${list}\n${packagesLine}\n\n${install ? 'Depois: git init e pnpm install.\n\n' : 'Depois: git init (sem pnpm install, por --no-install).\n\n'}Simulação (--dry-run): nada foi escrito.\n`,
          )
          return
        }
        io.out(`${heading}\n${list}\n${packagesLine}\n`)

        initGit(io, destination)
        if (install) {
          io.out('\nInstalando as dependências (pnpm install)...\n')
          const { status, reason } = (deps.install ?? pnpmInstall)(io, destination)
          if (status !== 0) {
            throw new ExitError(
              1,
              `o pnpm install falhou${reason ? ` (${reason})` : ''}. O app foi criado em '${destination}': corrija o que o pnpm disse e rode pnpm install ali.`,
            )
          }
        }
        io.out(nextSteps(io, destination, install))
      })
    documentCommand(command, {
      examples: ['prumo new meu-app', 'prumo new meu-app --dir ~/projetos --no-install', 'prumo new meu-app --dry-run'],
      anchor: 'prumo-new',
    })
  }
}

export const registerNew: RegisterCommand = createNewCommand()
