import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { ExitError, UsageError } from '../errors.ts'
import { generateApp } from '../generators/app.ts'
import type { Io } from '../io.ts'
import { appNameProblem } from '../lib/names.ts'
import { detectPnpmVersion } from '../lib/pnpm.ts'
import { runChild } from '../lib/process.ts'
import { readTarballs } from '../lib/tarballs.ts'
import type { RegisterCommand } from './index.ts'

/** O que o comando pede de fora do processo; os testes trocam por versões de mentira. */
export interface NewDeps {
  /** As variáveis de ambiente (só o `npm_config_user_agent` interessa). Padrão: as do processo. */
  env?: Readonly<Record<string, string | undefined>>
  /** Pergunta a versão ao pnpm quando o user agent não diz. Padrão: `pnpm --version`. */
  askPnpm?: () => string | undefined
  /** Roda o `pnpm install` na pasta e devolve o código de saída. Padrão: o pnpm de verdade. */
  install?: (io: Io, cwd: string) => number
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
  if (existsSync(parent) && !statSync(parent).isDirectory()) {
    throw new UsageError(`'${parent}' não é uma pasta (--dir).`)
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

/** Desfaz a escrita que falhou: apaga a pasta se o comando a criou, ou o que pôs numa pasta vazia. */
function rollback(destination: string, createdFolder: boolean): void {
  if (!existsSync(destination)) return
  if (createdFolder) {
    rmSync(destination, { recursive: true, force: true })
    return
  }
  for (const entry of readdirSync(destination)) {
    rmSync(path.join(destination, entry), { recursive: true, force: true })
  }
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

function pnpmInstall(io: Io, cwd: string): number {
  const result = runChild(io, 'pnpm', ['install'], { cwd })
  return result.error ? 1 : (result.status ?? 1)
}

/** O caminho como o shell o lê: entre aspas simples se tem espaço ou outro caractere especial. */
function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value
  return `'${value.replaceAll("'", `'\\''`)}'`
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
    program
      .command('new')
      .summary('Cria um app React mínimo do Prumo, sem CSS e sem design system.')
      .description(
      `Cria um app React mínimo do Prumo, sem CSS e sem design system.

Cria <dir>/<nome> com Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next (o que o @matizze/prumo-core usa), os pacotes do Prumo (core, rules, testing e cli), a estrutura de pastas (src/pages, src/components/shared, src/schemas, src/repositories, src/queries e src/messages), os provedores (query, i18n e repositórios), uma tela inicial (a mesma que o prumo make:page gera, na rota /), o eslint com o plugin do Prumo, o vitest com jsdom e o AGENTS.md. A fonte de dados padrão é o mock.

O package.json do app fixa o pnpm em packageManager (pnpm@<versão>): a versão vem do pnpm que rodou o comando (npm_config_user_agent) ou, na falta dela, de pnpm --version; sem nenhuma das duas, o campo fica de fora.

Os scripts do app são dev, build, typecheck, lint, check, test e verify (typecheck, lint, test e check, sem navegador). Os pacotes do Prumo entram como ^<versão>; com --packages, o app instala os tarballs da pasta (pnpm.overrides com file:), o que serve a quem ainda não tem os pacotes num registry. Roda git init (sem commit) e pnpm install, a não ser com --no-install.

Valida antes de escrever: o nome (kebab-case), a pasta de destino (não pode existir com conteúdo) e os tarballs saem com código 2, sem deixar nada pela metade. --dry-run lista o que seria criado e não escreve nada. Os tarballs de --packages saem do pnpm pack:all, no monorepo do Prumo.`,
    )
      .argument('<nome>', 'O nome do app, em kebab-case (meu-app): a pasta e o nome do pacote.')
      .option('--dir <pasta>', 'A pasta onde criar <nome>.', '.')
      .option(
        '--packages <pasta>',
        'Uma pasta com os tarballs dos pacotes @matizze/prumo-* (pnpm pack:all), instalados no lugar do registry.',
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
        const files = plan.summary().created

        if (!dryRun) {
          const createdFolder = !existsSync(destination)
          try {
            plan.commit()
          } catch (error) {
            rollback(destination, createdFolder)
            throw error
          }
        }

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
          const code = (deps.install ?? pnpmInstall)(io, destination)
          if (code !== 0) {
            throw new ExitError(
              1,
              `o pnpm install falhou. O app foi criado em '${destination}': corrija o que o pnpm disse e rode pnpm install ali.`,
            )
          }
        }
        io.out(nextSteps(io, destination, install))
      })
  }
}

export const registerNew: RegisterCommand = createNewCommand()
