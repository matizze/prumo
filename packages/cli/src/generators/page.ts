import { existsSync } from 'node:fs'
import path from 'node:path'
import { addRouteSnippet, messageLanguages, registerMessageNamespace } from '../codemods/index.ts'
import { UsageError } from '../errors.ts'
import { usableNames, type Names } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import type { Project } from '../lib/project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../lib/templates.ts'

/** Um arquivo da tela: o modelo (em `templates/`) e onde ele cai no projeto, os dois com marcadores. */
interface PageFile {
  template: string
  to: string
}

const PAGE_DIR = 'src/pages/{{page.kebab}}'

/** Os arquivos de uma tela só com o título. O passo do `make:page` acrescenta as outras variações. */
export const PAGE_FILES: readonly PageFile[] = [
  { template: 'page/index.tsx.tpl', to: `${PAGE_DIR}/index.tsx` },
  { template: 'page/model.ts.tpl', to: `${PAGE_DIR}/model.ts` },
  { template: 'page/view.tsx.tpl', to: `${PAGE_DIR}/view.tsx` },
  { template: 'page/index-test.tsx.tpl', to: `${PAGE_DIR}/index.test.tsx` },
]

/** Os messageLangs dos modelos de mensagens: o `pt-BR` e o `en`. */
export const MESSAGE_LANGUAGES = ['pt-BR', 'en'] as const

/**
 * Qual dos dois modelos de mensagens vale para um idioma do projeto: os `pt` (`pt-BR`, `pt-PT`)
 * usam o texto em português, e qualquer outro (`en`, `es`) o texto em inglês, que a pessoa traduz.
 */
export function messagesLanguageOf(language: string): (typeof MESSAGE_LANGUAGES)[number] {
  return language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

/** Um caminho de rota sem parâmetro: `/`, `/clientes`, `/clientes/novo`. */
const FIXED_ROUTE = /^\/([A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*)?$/

export interface PageRequest {
  /** O nome da tela, em kebab-case: `clientes`. */
  name: string
  /** A rota da tela. Padrão: `/<nome>`. A tela inicial de um app novo usa `/`. */
  route?: string | undefined
}

export interface PageOptions {
  /** O plano onde acrescentar a tela. Padrão: um plano novo sobre o projeto. */
  plan?: ChangePlan
  /** Os messageLangs das mensagens. Padrão: os de `src/messages` do projeto, em disco. */
  languages?: readonly string[]
}

export interface PageResult {
  plan: ChangePlan
  names: Names
  /** A rota nova no `src/App.tsx`: `/clientes`. */
  route: string
}

/** O `<Route>` da tela, como entra no `src/App.tsx`. */
function routeElement(names: Names, route: string): string {
  return `<Route path="${route}">\n  <${names.pascal}Page />\n</Route>`
}

/**
 * Monta o plano de uma tela nova: `index`, `model`, `view` e o teste a partir dos modelos, as
 * mensagens (`title`) em cada idioma, o namespace nos índices de mensagens e a rota no
 * `src/App.tsx`. Nada vai para o disco: quem chama mostra o `summary()` ou faz o `commit()`. Valida
 * os nomes e a rota antes de montar qualquer coisa; todo erro de uso é um `UsageError` (saída 2).
 */
export function generatePage(
  project: Project,
  { name, route }: PageRequest,
  { plan = new ChangePlan(project), languages }: PageOptions = {},
): PageResult {
  const names = usableNames(name, 'o nome da tela')
  if (existsSync(path.join(project.pages, names.kebab))) {
    throw new UsageError(
      `a tela '${names.kebab}' já existe: a pasta src/pages/${names.kebab} está no projeto.`,
    )
  }
  const pagePath = route ?? `/${names.kebab}`
  if (!FIXED_ROUTE.test(pagePath)) {
    throw new UsageError(
      `o caminho '${pagePath}' é inválido: comece com / e use só letras, números, -, _, . e ~ nos segmentos.`,
    )
  }
  const messageLangs = languages ?? messageLanguages(project)

  const vars = { ...nameVars('page', names), 'route.path': pagePath }
  for (const { template, to } of PAGE_FILES) {
    plan.createSource(
      path.join(project.root, renderTemplate(to, vars)),
      renderTemplateFile(template, vars),
    )
  }
  for (const language of messageLangs) {
    plan.createText(
      path.join(project.messages, language, `${names.kebab}.json`),
      renderTemplateFile(`page/messages.${messagesLanguageOf(language)}.json.tpl`, vars),
    )
  }

  registerMessageNamespace(plan, names.kebab, names.camel, messageLangs)
  addRouteSnippet(plan, {
    component: `${names.pascal}Page`,
    importPath: `@/pages/${names.kebab}`,
    path: pagePath,
    element: routeElement(names, pagePath),
  })
  return { plan, names, route: pagePath }
}
