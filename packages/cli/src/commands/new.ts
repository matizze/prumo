import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { defineCommand } from 'citty'
import { clientDesignSystem, clientProblem, MADS, type DesignSystem } from '../ds.ts'
import { ExitError, UsageError } from '../errors.ts'
import { copyFiles, listStarterFiles } from '../new/copy.ts'
import {
  APP_CONFIG_FILE,
  customizeAgents,
  customizeAgentsDs,
  customizeAppConfig,
  customizeComponentsJson,
  customizeEnv,
  customizeIndexHtml,
  customizeNodeTsconfig,
  customizePackageJson,
  customizeReadme,
  customizeReadmeDs,
  MCP_JSON,
  NPMRC,
  type ProductContext,
} from '../new/customize.ts'
import { productNameProblem, titleOf } from '../new/name.ts'
import { assertTarballsCover, readOriginVersions, readTarballs } from '../new/packages.ts'
import { gitStarterFiles, obtainSource, STARTER_DIR } from '../new/source.ts'
import type { Runtime } from '../runtime.ts'
import { childEnv, runChild } from '../process.ts'
import { section, shellQuote } from './shared.ts'

/** O registry dos pacotes `@matizze/prumo-*` (o `.npmrc` do produto aponta para ele). */
const REGISTRY = 'https://npm.pkg.github.com'

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

/**
 * `prumo new <nome>`: cria um produto novo a partir do starter. Baixa o starter do repositório do
 * Prumo (`git clone --depth 1`, com as credenciais do git de quem roda) ou usa um checkout local
 * (`--from`), copia `starter/` para `<dir>/<nome>` sem `node_modules`, `dist` e `scripts/`, troca o
 * nome do app (`package.json`, `index.html`, `src/config/app.ts`, `AGENTS.md`, `README.md`), troca o `workspace:*` dos pacotes do Prumo pela versão deles (ou, com `--packages`,
 * por `pnpm.overrides` com `file:` para tarballs locais), cria o `.npmrc`, o `.env.local` e o
 * `.mcp.json`, roda `git init` (sem commit) e `pnpm install`. Valida tudo antes de escrever.
 */
export function createNewCommand(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'new',
      description: `Cria um produto novo a partir do starter do Prumo.

Baixa o starter (git clone --depth 1 de PRUMO_REPOSITORY, que por padrão é
https://github.com/matizze/prumo, com as credenciais do git de quem roda) ou usa um checkout do
prumo (--from), copia a pasta starter/ para <dir>/<nome> sem node_modules, dist e scripts/, e
ajusta o produto.

O clone lê a ref que --ref ou PRUMO_REF dizem (uma branch ou uma tag) e, sem elas, a main, onde
entram as versões publicadas (a develop está à frente delas). Com --from, vão só os arquivos que o
git do checkout conhece (rastreados, ou novos e não ignorados): o .env com token, o public/r e o
dist-ds de quem roda ficam para trás; fora de um repositório git, um filtro equivalente faz o mesmo.

O ajuste do produto:
  - troca o nome do app no package.json, no título do index.html, em src/config/app.ts (o título
    das páginas, o logo e o rodapé), no AGENTS.md e no README.md;
  - troca o workspace:* dos pacotes @matizze/prumo-* pela faixa da versão que a origem tem (com
    --packages, grava pnpm.overrides com file: para os tarballs da pasta e não cria registry);
  - cria o .npmrc com o registry do escopo @matizze (GitHub Packages), sem o token: o pnpm install
    lê NODE_AUTH_TOKEN, que precisa estar definida (um token com read:packages);
  - cria o .env.local, a partir do .env.example (sem token), e o .mcp.json (o do starter, ou o
    padrão, com o servidor prumo, que dá a um agente os comandos da CLI, e o do shadcn);
  - com --ds <cliente>, troca o registry de UI do components.json (@mads por @<cliente>-ds), as
    variáveis do .env.local (MADS_REGISTRY_* por <CLIENTE>_DS_REGISTRY_*, a URL em branco) e o que o
    AGENTS.md e o README.md dizem sobre de onde vem a UI;
  - roda git init (sem commit) e pnpm install, a não ser com --no-install.

Valida antes de escrever: o nome (kebab-case), a pasta de destino (não pode existir com conteúdo),
a origem e os tarballs saem com código 2, sem deixar nada pela metade. --dry-run mostra o que seria
feito e não escreve nada. Os tarballs de --packages saem do pnpm pack:all, no monorepo do Prumo.`,
    },
    args: {
      nome: {
        type: 'positional',
        required: true,
        description: 'O nome do produto, em kebab-case (meu-produto): a pasta e o nome do pacote.',
      },
      dir: {
        type: 'string',
        valueHint: 'pasta',
        description: 'A pasta onde criar <nome>. Padrão: a pasta atual.',
      },
      from: {
        type: 'string',
        valueHint: 'pasta',
        description:
          'Um checkout do matizze/prumo, de onde sai o starter. Padrão: o clone raso do repositório.',
      },
      ref: {
        type: 'string',
        valueHint: 'ref',
        description:
          'A branch ou a tag do repositório que o clone lê (padrão: PRUMO_REF, ou main). Não vale com --from.',
      },
      packages: {
        type: 'string',
        valueHint: 'pasta',
        description:
          'Uma pasta com os tarballs dos pacotes @matizze/prumo-* (pnpm pack:all), instalados em vez do registry.',
      },
      ds: {
        type: 'string',
        valueHint: 'cliente',
        description:
          'O design system do cliente (gekom): troca o registry de UI @mads por @<cliente>-ds no components.json.',
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

      // Tudo que dá para conferir sem a origem, antes de baixar ou escrever qualquer coisa
      const problem = productNameProblem(name)
      if (problem) throw new UsageError(problem)
      if (args.ds !== undefined) {
        const clientError = clientProblem(String(args.ds))
        if (clientError) throw new UsageError(clientError)
      }
      const ds = args.ds === undefined ? MADS : clientDesignSystem(String(args.ds))
      const destination = resolveDestination(runtime, args.dir, name)
      const packagesDir =
        args.packages === undefined ? undefined : path.resolve(runtime.cwd, args.packages)
      const tarballs = packagesDir === undefined ? undefined : readTarballs(packagesDir)
      if (tarballs === undefined && install && !runtime.env.NODE_AUTH_TOKEN) {
        throw new UsageError(
          `falta a variável NODE_AUTH_TOKEN: o pnpm install baixa os pacotes @matizze/prumo-* do GitHub Packages (${REGISTRY}), que é privado.\nDefina um token com read:packages, ou use --packages <pasta> (tarballs do pnpm pack:all), ou --no-install para só criar os arquivos.`,
        )
      }

      const source = obtainSource(runtime, args.from, args.ref)
      try {
        const starterDir = path.join(source.root, STARTER_DIR)
        const files = listStarterFiles(starterDir, gitStarterFiles(runtime, source.root))
        const read = (file: string) => readFileSync(path.join(starterDir, file), 'utf8')
        const product: ProductContext = { name, title: titleOf(name) }

        const packageJson = read('package.json')
        if (tarballs) assertTarballsCover(packageJson, tarballs)

        // O conteúdo que muda ou nasce, calculado antes de escrever: um erro aqui não deixa rastro
        const contents = new Map<string, string>()
        contents.set(
          'package.json',
          customizePackageJson(packageJson, product, {
            versions: readOriginVersions(source.root),
            overrides: tarballs,
          }),
        )
        // Cada troca parte do que as anteriores deixaram no mesmo arquivo
        const modify = (file: string, change: (text: string) => string) => {
          if (files.includes(file)) contents.set(file, change(contents.get(file) ?? read(file)))
        }
        modify('index.html', (text) => customizeIndexHtml(text, product))
        modify(APP_CONFIG_FILE, (text) => customizeAppConfig(text, product))
        modify('AGENTS.md', (text) => customizeAgents(text, product))
        modify('README.md', (text) => customizeReadme(text, product))
        modify('tsconfig.node.json', customizeNodeTsconfig)
        if (args.ds !== undefined) {
          modify('components.json', (text) => customizeComponentsJson(text, ds))
          modify('.env.example', (text) => customizeEnv(text, ds, String(args.ds)))
          modify('AGENTS.md', (text) => customizeAgentsDs(text, ds))
          modify('README.md', (text) => customizeReadmeDs(text, ds))
        }
        if (files.includes('.env.example')) {
          contents.set('.env.local', contents.get('.env.example') ?? read('.env.example'))
        }
        if (!files.includes('.mcp.json')) contents.set('.mcp.json', MCP_JSON)
        if (!tarballs) contents.set('.npmrc', NPMRC)

        const changed = [...contents.keys()].filter((file) => files.includes(file)).sort()
        const added = [...contents.keys()].filter((file) => !files.includes(file)).sort()
        const copied = files.length - changed.length
        const uiLine = `Registry de UI: ${ds.namespace} (variáveis ${ds.urlVariable} e ${ds.tokenVariable}).`
        const packagesLine = packagesDir
          ? `Pacotes do Prumo: tarballs de ${packagesDir} (pnpm.overrides com file:), sem registry.`
          : `Pacotes do Prumo: do GitHub Packages (${REGISTRY}), com o token em NODE_AUTH_TOKEN.`
        const heading = `prumo new: ${name}${dryRun ? ' (simulação)' : ''}.\nOrigem: ${source.label}\nDestino: ${destination}\n`
        const summary = [
          `${dryRun ? 'Seriam copiados' : 'Copiados'} ${copied} ${copied === 1 ? 'arquivo' : 'arquivos'} de ${STARTER_DIR}/ (sem node_modules, dist nem scripts/).\n`,
          section(dryRun ? 'Seriam alterados' : 'Alterados', changed),
          section(dryRun ? 'Seriam criados' : 'Criados', added),
          `${packagesLine}\n${uiLine}\n`,
        ]
          .filter(Boolean)
          .join('\n')

        if (dryRun) {
          runtime.out(
            `${heading}\n${summary}\n${install ? 'Depois: git init e pnpm install.\n\n' : 'Depois: git init (sem pnpm install, por --no-install).\n\n'}Simulação (--dry-run): nada foi escrito.\n`,
          )
          return
        }

        const createdFolder = !existsSync(destination)
        mkdirSync(destination, { recursive: true })
        try {
          copyFiles(
            starterDir,
            destination,
            files.filter((file) => !contents.has(file)),
          )
          for (const [file, text] of contents) {
            const target = path.join(destination, file)
            mkdirSync(path.dirname(target), { recursive: true })
            writeFileSync(target, text)
          }
        } catch (error) {
          rollback(destination, createdFolder)
          throw error
        }
        runtime.out(`${heading}\n${summary}`)
      } finally {
        source.cleanup()
      }

      initGit(runtime, destination)
      if (install) installPackages(runtime, destination)
      runtime.out(nextSteps(runtime, destination, install, ds))
    },
  })
}

/** `git init`, sem commit: o produto decide o primeiro commit. Falhar só avisa. */
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

/** `pnpm install` no produto, com a saída no terminal (ou em `runtime.out` e `runtime.err`, fora dele). Falhar deixa o produto criado e diz como seguir. */
function installPackages(runtime: Runtime, destination: string): void {
  runtime.out('\nInstalando as dependências (pnpm install)...\n')
  const result = runChild(runtime, 'pnpm', ['install'], { cwd: destination })
  if (result.error || result.status !== 0) {
    throw new ExitError(
      1,
      `o pnpm install falhou${result.error ? ` (${result.error.message})` : ''}. O produto foi criado em '${destination}': corrija o que o pnpm disse e rode pnpm install ali.`,
    )
  }
}

/** O que fazer depois: entrar na pasta, instalar se faltou, subir o app e gerar a primeira tela. */
function nextSteps(
  runtime: Runtime,
  destination: string,
  installed: boolean,
  ds: DesignSystem,
): string {
  const relative = path.relative(runtime.cwd, destination)
  const folder = shellQuote(relative.startsWith('..') ? destination : relative)
  const steps = [
    `cd ${folder}`,
    ...(installed ? [] : ['pnpm install']),
    'pnpm dev                                          # login de exemplo: admin@app.com / password',
    'pnpm exec prumo make:page <nome> --like <padrão>  # a primeira tela, a partir de um dos dez padrões',
  ]
  const agent =
    'Um agente de IA (o Claude Code, por exemplo) lê o .mcp.json deste produto e ganha o servidor prumo: cada comando da CLI vira uma ferramenta (mcp__prumo__make_page, mcp__prumo__check...).'
  return `\nPróximos passos:\n${steps.map((step) => `  ${step}`).join('\n')}\n\n${agent}\n\nPara instalar a UI do design system (prumo add ${ds.namespace}/<item>), preencha ${ds.tokenVariable}${ds.urlVariable === MADS.urlVariable ? '' : ` e ${ds.urlVariable}`} no .env.local.\n`
}
