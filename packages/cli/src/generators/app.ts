import path from 'node:path'
import { deriveNames, kebabToTitle } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import { projectAt } from '../lib/project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../lib/templates.ts'
import { PRUMO_VERSIONS } from '../lib/versions.ts'
import { generatePage, MESSAGE_LANGUAGES } from './page.ts'

/** Um arquivo do app: o modelo (em `templates/app/`) e onde ele cai, relativo à raiz do app. */
interface AppFile {
  template: string
  to: string
}

/** Os arquivos do app, além do `package.json` (que sai do código, com as versões) e da tela inicial. */
export const APP_FILES: readonly AppFile[] = [
  { template: 'app/AGENTS.md.tpl', to: 'AGENTS.md' },
  { template: 'app/eslint.config.js.tpl', to: 'eslint.config.js' },
  { template: 'app/gitignore.tpl', to: '.gitignore' },
  { template: 'app/index.html.tpl', to: 'index.html' },
  { template: 'app/mcp.json.tpl', to: '.mcp.json' },
  { template: 'app/README.md.tpl', to: 'README.md' },
  { template: 'app/typescript.json.tpl', to: 'tsconfig.json' },
  { template: 'app/vite.config.ts.tpl', to: 'vite.config.ts' },
  { template: 'app/src/App.tsx.tpl', to: 'src/App.tsx' },
  { template: 'app/src/errors.ts.tpl', to: 'src/errors.ts' },
  { template: 'app/src/i18n.ts.tpl', to: 'src/i18n.ts' },
  { template: 'app/src/main.tsx.tpl', to: 'src/main.tsx' },
  { template: 'app/src/messages/errors.pt-BR.json.tpl', to: 'src/messages/pt-BR/errors.json' },
  { template: 'app/src/messages/index.ts.tpl', to: 'src/messages/pt-BR/index.ts' },
  { template: 'app/src/messages/errors.en.json.tpl', to: 'src/messages/en/errors.json' },
  { template: 'app/src/messages/index.ts.tpl', to: 'src/messages/en/index.ts' },
  { template: 'app/src/providers/app.tsx.tpl', to: 'src/providers/app.tsx' },
  {
    template: 'app/src/providers/repository/index.ts.tpl',
    to: 'src/providers/repository/index.ts',
  },
  { template: 'app/src/queries-index.ts.tpl', to: 'src/queries/index.ts' },
  { template: 'app/src/repositories/index.ts.tpl', to: 'src/repositories/index.ts' },
  { template: 'app/src/repositories/options.ts.tpl', to: 'src/repositories/options.ts' },
  { template: 'app/src/schemas-index.ts.tpl', to: 'src/schemas/index.ts' },
  { template: 'app/src/vite-env.d.ts.tpl', to: 'src/vite-env.d.ts' },
  { template: 'app/src/test/render.tsx.tpl', to: 'src/test/render.tsx' },
  { template: 'app/src/test/setup.ts.tpl', to: 'src/test/setup.ts' },
]

/** O nome da tela inicial: o modelo do `make:page` gera a pasta, as mensagens e o teste dela. */
export const HOME_PAGE = 'home'

/**
 * As dependências do app: as bibliotecas que o `@matizze/prumo-core` pede por peer (React, wouter,
 * TanStack Query, zod e i18next), com as versões do app gerado. Os pacotes do Prumo entram à
 * parte, com a versão deles.
 */
const DEPENDENCIES: Readonly<Record<string, string>> = {
  '@tanstack/react-query': '^5.105.0',
  i18next: '^26.4.2',
  'i18next-browser-languagedetector': '^8.2.1',
  'i18next-icu': '^2.5.0',
  react: '^19.3.1',
  'react-dom': '^19.3.1',
  'react-i18next': '^17.0.15',
  wouter: '^3.13.0',
  zod: '^4.6.7',
}

const DEV_DEPENDENCIES: Readonly<Record<string, string>> = {
  '@eslint/js': '^10.0.1',
  '@testing-library/dom': '^10.4.2',
  '@testing-library/react': '^16.3.3',
  '@types/node': '^24.19.2',
  '@types/react': '^19.3.0',
  '@types/react-dom': '^19.3.0',
  '@vitejs/plugin-react': '^6.1.2',
  eslint: '^10.13.0',
  'eslint-plugin-react-hooks': '^7.1.1',
  globals: '^17.13.0',
  jsdom: '^31.0.1',
  typescript: '~6.0.3',
  'typescript-eslint': '^8.72.1',
  vite: '^8.3.5',
  vitest: '^5.1.0',
}

/** O pacote do Prumo que o app usa em tempo de execução; os outros são de desenvolvimento. */
const RUNTIME_PRUMO = '@matizze/prumo-core'

const sorted = (map: Record<string, string>) =>
  Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))

export interface AppRequest {
  /** A pasta do app (absoluta), que ainda não precisa existir. */
  root: string
  /** O nome do app, em kebab-case (já validado). */
  name: string
  /** Os tarballs do Prumo (nome do pacote -> `file:<caminho>`), que viram `pnpm.overrides`. */
  overrides?: Readonly<Record<string, string>> | undefined
  /** A versão do pnpm (x.y.z) que vira `packageManager`. Ausente, o campo fica de fora. */
  pnpm?: string | undefined
}

/** O `package.json` do app: os scripts, as dependências e, com tarballs, os `pnpm.overrides`. */
export function appPackageJson({ name, overrides, pnpm }: AppRequest): string {
  const prumo = Object.entries(PRUMO_VERSIONS).map(
    ([pkg, version]) => [pkg, `^${version}`] as const,
  )
  const runtime = Object.fromEntries(prumo.filter(([pkg]) => pkg === RUNTIME_PRUMO))
  const tools = Object.fromEntries(prumo.filter(([pkg]) => pkg !== RUNTIME_PRUMO))
  const data = {
    name,
    private: true,
    version: '0.0.0',
    type: 'module',
    ...(pnpm ? { packageManager: `pnpm@${pnpm}` } : {}),
    engines: { node: '>=24' },
    scripts: {
      dev: 'vite',
      build: 'tsc && vite build',
      typecheck: 'tsc',
      lint: 'eslint .',
      check: 'prumo check',
      test: 'vitest run',
      verify: 'pnpm typecheck && pnpm lint && pnpm test && pnpm check',
    },
    dependencies: sorted({ ...DEPENDENCIES, ...runtime }),
    devDependencies: sorted({ ...DEV_DEPENDENCIES, ...tools }),
    ...(overrides && Object.keys(overrides).length > 0
      ? { pnpm: { overrides: sorted({ ...overrides }) } }
      : {}),
  }
  return `${JSON.stringify(data, null, 2)}\n`
}

/**
 * O plano do app mínimo em `root`: os arquivos dos modelos, o `package.json` e a tela inicial, que
 * sai do mesmo gerador do `make:page` (e registra a rota `/` e as mensagens como qualquer tela). Nada
 * vai para o disco: quem chama mostra o `summary()` ou faz o `commit()`. O app só nasce se o plano
 * inteiro deu certo.
 */
export function generateApp(request: AppRequest): ChangePlan {
  const names = deriveNames(request.name)
  const vars = { ...nameVars('app', names), 'app.title': kebabToTitle(names.kebab) }
  const project = projectAt(request.root)
  const plan = new ChangePlan(project)

  plan.createText(path.join(project.root, 'package.json'), appPackageJson(request))
  for (const { template, to } of APP_FILES) {
    const file = path.join(project.root, renderTemplate(to, vars))
    const text = renderTemplateFile(template, vars)
    // O código entra no ts-morph do plano, o que o torna editável pelos codemods da tela inicial
    if (/\.tsx?$/.test(file)) plan.createSource(file, text)
    else plan.createText(file, text)
  }

  generatePage(project, { name: HOME_PAGE, route: '/' }, { plan, languages: MESSAGE_LANGUAGES })
  return plan
}
