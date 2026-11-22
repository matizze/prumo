import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { defineCommand } from 'citty'
import { ExitError, UsageError } from '../errors.ts'
import { generateApp } from '../generate/app.ts'
import { appNameProblem } from '../new/name.ts'
import { readTarballs } from '../new/packages.ts'
import { childEnv, runChild } from '../process.ts'
import type { Runtime } from '../runtime.ts'
import { shellQuote } from './shared.ts'

/**
 * Valida o destino: `<dir>/<nome>` não pode existir com conteúdo (uma pasta vazia serve), e o pai
 * não pode ser um arquivo. Devolve o caminho absoluto.
 */
function resolveDestination(runtime: Runtime, dir: string | undefined, name: string): string {
  const parent = path.resolve(runtime.cwd, dir ?? '.')
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

/**
 * `prumo new <nome>`: cria um app mínimo do Prumo. Monta o app numa pasta de rascunho (os modelos, o
 * `package.json` e a tela inicial, que sai do mesmo modelo do `make:page`), e só se tudo deu certo o
 * leva para `<dir>/<nome>`: um erro não deixa pasta pela metade. Depois roda `git init` (sem commit)
 * e `pnpm install`, a não ser com `--no-install`.
 */
export function createNewCommand(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'new',
      description: `Cria um app React mínimo do Prumo, sem CSS e sem design system.

Cria <dir>/<nome> com Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next (o que o
@matizze/prumo-core usa), os pacotes do Prumo (core, rules, testing, cli e mcp), a estrutura de pastas
(src/pages, src/components/shared, src/schemas, src/repositories, src/queries e src/messages), os
provedores (query, i18n e repositórios), uma tela inicial (a mesma que o prumo make:page gera, na
rota /), o eslint com o plugin do Prumo, o vitest com jsdom, o AGENTS.md e o .mcp.json com o servidor
prumo, que dá a um agente os comandos da CLI.

Os scripts do app são dev, build, typecheck, lint, check, test e verify (typecheck, lint, check e
test, sem navegador). Os pacotes do Prumo entram como ^<versão>; com --packages, o app instala os
tarballs da pasta (pnpm.overrides com file:), o que serve a quem ainda não tem os pacotes num
registry. Roda git init (sem commit) e pnpm install, a não ser com --no-install.

Valida antes de escrever: o nome (kebab-case), a pasta de destino (não pode existir com conteúdo) e
os tarballs saem com código 2, sem deixar nada pela metade. --dry-run lista o que seria criado e não
escreve nada. Os tarballs de --packages saem do pnpm pack:all, no monorepo do Prumo.`,
    },
    args: {
      nome: {
        type: 'positional',
        required: true,
        description: 'O nome do app, em kebab-case (meu-app): a pasta e o nome do pacote.',
      },
      dir: {
        type: 'string',
        valueHint: 'pasta',
        description: 'A pasta onde criar <nome>. Padrão: a pasta atual.',
      },
      packages: {
        type: 'string',
        valueHint: 'pasta',
        description:
          'Uma pasta com os tarballs dos pacotes @matizze/prumo-* (pnpm pack:all), instalados no lugar do registry.',
      },
      install: {
        type: 'boolean',
        default: true,
        description:
          'Com --no-install, não roda o pnpm install: só cria os arquivos. Sem a opção, instala.',
      },
      'dry-run': {
        type: 'boolean',
        description: 'Só lista o que seria criado, sem escrever nada.',
      },
    },
    run({ args }) {
      const name = String(args.nome)
      const dryRun = Boolean(args['dry-run'])
      const install = args.install !== false

      // Tudo que dá para conferir, antes de escrever qualquer coisa
      const problem = appNameProblem(name)
      if (problem) throw new UsageError(problem)
      const destination = resolveDestination(runtime, args.dir, name)
      const overrides =
        args.packages === undefined
          ? undefined
          : readTarballs(path.resolve(runtime.cwd, args.packages))

      // O app inteiro é montado numa pasta de rascunho e só vai ao destino se nada falhou
      const scratch = mkdtempSync(path.join(tmpdir(), 'prumo-new-'))
      let files: string[]
      try {
        const root = path.join(scratch, name)
        files = generateApp(root, { name, overrides })
        if (!dryRun) {
          mkdirSync(path.dirname(destination), { recursive: true })
          const createdFolder = !existsSync(destination)
          try {
            cpSync(root, destination, { recursive: true })
          } catch (error) {
            rollback(destination, createdFolder)
            throw error
          }
        }
      } finally {
        rmSync(scratch, { recursive: true, force: true })
      }

      const packagesLine = overrides
        ? `Pacotes do Prumo: tarballs de ${path.resolve(runtime.cwd, String(args.packages))} (pnpm.overrides com file:).`
        : 'Pacotes do Prumo: do registry, pela versão (^<versão>) no package.json.'
      const heading = `prumo new: ${name}${dryRun ? ' (simulação)' : ''}.\nDestino: ${destination}\n`
      const list = `${dryRun ? 'Seriam criados' : 'Criados'} (${files.length}):\n${files.map((file) => `  ${file}`).join('\n')}\n`
      if (dryRun) {
        runtime.out(
          `${heading}\n${list}\n${packagesLine}\n\n${install ? 'Depois: git init e pnpm install.\n\n' : 'Depois: git init (sem pnpm install, por --no-install).\n\n'}Simulação (--dry-run): nada foi escrito.\n`,
        )
        return
      }
      runtime.out(`${heading}\n${list}\n${packagesLine}\n`)

      initGit(runtime, destination)
      if (install) installPackages(runtime, destination)
      runtime.out(nextSteps(runtime, destination, install))
    },
  })
}

/** Desfaz a escrita que falhou: apaga a pasta se o comando a criou, ou o que pôs numa pasta vazia. */
function rollback(destination: string, createdFolder: boolean): void {
  if (createdFolder) {
    rmSync(destination, { recursive: true, force: true })
    return
  }
  for (const entry of readdirSync(destination)) {
    rmSync(path.join(destination, entry), { recursive: true, force: true })
  }
}

/** `git init`, sem commit: quem criou o app decide o primeiro commit. Falhar só avisa. */
function initGit(runtime: Runtime, destination: string): void {
  const result = spawnSync('git', ['init', '--quiet'], {
    cwd: destination,
    encoding: 'utf8',
    env: childEnv(runtime),
  })
  if (result.error || result.status !== 0) {
    runtime.err(
      `prumo new: não consegui rodar git init em '${destination}': ${result.error?.message ?? result.stderr.trim()}\n`,
    )
  }
}

/** `pnpm install` no app, com a saída no terminal (ou em `runtime.out` e `runtime.err`, fora dele). Falhar deixa o app criado e diz como seguir. */
function installPackages(runtime: Runtime, destination: string): void {
  runtime.out('\nInstalando as dependências (pnpm install)...\n')
  const result = runChild(runtime, 'pnpm', ['install'], { cwd: destination })
  if (result.error || result.status !== 0) {
    throw new ExitError(
      1,
      `o pnpm install falhou${result.error ? ` (${result.error.message})` : ''}. O app foi criado em '${destination}': corrija o que o pnpm disse e rode pnpm install ali.`,
    )
  }
}

/** O que fazer depois: entrar na pasta, instalar se faltou, conferir, subir o app e gerar o primeiro domínio. */
function nextSteps(runtime: Runtime, destination: string, installed: boolean): string {
  const relative = path.relative(runtime.cwd, destination)
  const folder = shellQuote(relative.startsWith('..') ? destination : relative)
  const steps = [
    `cd ${folder}`,
    ...(installed ? [] : ['pnpm install']),
    'pnpm verify                                   # typecheck, lint, check e test',
    'pnpm dev                                      # o app em http://localhost:5173',
    'pnpm exec prumo make:domain clientes          # um domínio de dados (schema, repositório e queries)',
    'pnpm exec prumo make:page clientes --domain clientes  # uma tela que lista o domínio',
  ]
  const agent =
    'Um agente de IA (o Claude Code, por exemplo) lê o .mcp.json deste app e ganha o servidor prumo: cada comando da CLI vira uma ferramenta (mcp__prumo__make_page, mcp__prumo__check...).'
  return `\nPróximos passos:\n${steps.map((step) => `  ${step}`).join('\n')}\n\n${agent}\n`
}
