import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  addRouteSnippet,
  assertValidName,
  ChangePlan,
  deriveNames,
  registerMessageNamespace,
  usableNames,
  type Names,
} from '../codemod/index.ts'
import { messageLanguages } from '../codemod/messages.ts'
import { UsageError } from '../errors.ts'
import type { Project } from '../project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../templates.ts'

/** Um arquivo da tela: o modelo e onde ele cai no projeto, os dois com marcadores. */
interface PageFile {
  /** O modelo, em `templates/`. */
  template: string
  /** O caminho no projeto, relativo à raiz. */
  to: string
}

const PAGE_DIR = 'src/pages/{{page.kebab}}'

/** Os arquivos de uma tela sem domínio: só o título. */
export const PAGE_FILES: readonly PageFile[] = [
  { template: 'page/index.tsx.tpl', to: `${PAGE_DIR}/index.tsx` },
  { template: 'page/model.ts.tpl', to: `${PAGE_DIR}/model.ts` },
  { template: 'page/view.tsx.tpl', to: `${PAGE_DIR}/view.tsx` },
  { template: 'page/index-test.tsx.tpl', to: `${PAGE_DIR}/index.test.tsx` },
]

/** Os arquivos de uma tela com `--domain`: o model lê a lista, e a view a mostra. */
export const PAGE_DOMAIN_FILES: readonly PageFile[] = [
  { template: 'page/index.tsx.tpl', to: `${PAGE_DIR}/index.tsx` },
  { template: 'page/model-domain.ts.tpl', to: `${PAGE_DIR}/model.ts` },
  { template: 'page/view-domain.tsx.tpl', to: `${PAGE_DIR}/view.tsx` },
  { template: 'page/index-domain-test.tsx.tpl', to: `${PAGE_DIR}/index.test.tsx` },
]

/** Os idiomas dos modelos de mensagens: o `pt-BR` e o `en`. */
export const MESSAGE_LANGUAGES = ['pt-BR', 'en'] as const

/** O modelo do JSON de mensagens de um idioma, com ou sem domínio. */
export function messagesTemplate(language: (typeof MESSAGE_LANGUAGES)[number], domain: boolean) {
  return `page/messages${domain ? '-domain' : ''}.${language}.json.tpl`
}

/**
 * Qual dos dois modelos de mensagens vale para um idioma do projeto: os `pt` (`pt-BR`, `pt-PT`)
 * usam o texto em português, e qualquer outro (`en`, `es`) o texto em inglês, que a pessoa traduz.
 */
function messagesLanguageOf(language: string): (typeof MESSAGE_LANGUAGES)[number] {
  return language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

/** Onde mora o módulo `src/<módulo>`: `<módulo>.ts`, `<módulo>.tsx` ou a pasta com `index`. */
export function moduleFile(project: Project, module: string): string | undefined {
  return [`${module}.ts`, `${module}.tsx`, `${module}/index.ts`, `${module}/index.tsx`]
    .map((file) => path.join(project.src, file))
    .find((file) => existsSync(file))
}

export interface PageRequest {
  /** O nome da tela, em kebab-case: `clientes`. */
  name: string
  /** O domínio cuja lista a tela mostra (o nome dele, no plural), criado por `make:domain`. */
  domain?: string | undefined
}

export interface PageResult {
  plan: ChangePlan
  names: Names
  /** O domínio, se a tela tem um. */
  domain?: Names
  /** A rota nova no `src/App.tsx`: `/clientes`. */
  route: string
}

/** O `<Route>` da tela, como entra no `src/App.tsx`. */
function routeElement(names: Names, route: string): string {
  return `<Route path="${route}">\n  <${names.pascal}Page />\n</Route>`
}

/**
 * Confere que o domínio existe e traz o hook de lista que o model usa: `src/queries/<domínio>.ts`
 * com `use<Domínio>List`, o que o `make:domain` gera. Sem isso, a tela nasceria sem compilar.
 */
function assertDomain(project: Project, domain: Names): void {
  const hook = `use${domain.pascal}List`
  const file = moduleFile(project, `queries/${domain.kebab}`)
  if (!file) {
    throw new UsageError(
      `o domínio '${domain.kebab}' não existe: falta src/queries/${domain.kebab}.ts (crie-o com prumo make:domain ${domain.kebab}).`,
    )
  }
  if (!new RegExp(`\\b${hook}\\b`).test(readFileSync(file, 'utf8'))) {
    throw new UsageError(
      `o domínio '${domain.kebab}' não tem o hook ${hook} em ${path.relative(project.root, file)}: o model da tela lê a lista por ele.`,
    )
  }
}

/**
 * Monta o plano de uma tela nova: `index`, `model`, `view` e o teste a partir dos modelos, as
 * mensagens (`title` e, com domínio, os textos de carregando e de erro) em cada idioma do projeto,
 * o namespace nos índices de mensagens e a rota `/<nome>` no `src/App.tsx`. Com `domain`, o model lê
 * a lista do domínio e a view mostra o carregando, o erro e a lista. Nada vai para o disco: o
 * chamador mostra o `summary()` ou faz o `commit()`. Valida os nomes e confere o projeto antes de
 * montar qualquer coisa, e todo erro de uso é um `UsageError` (saída 2).
 */
export function generatePage(project: Project, { name, domain }: PageRequest): PageResult {
  const names = usableNames(name, 'o nome da tela')
  let domainNames: Names | undefined
  if (domain !== undefined) {
    assertValidName(domain, 'o nome do domínio')
    domainNames = deriveNames(domain)
  }
  if (existsSync(path.join(project.pages, names.kebab))) {
    throw new UsageError(
      `a tela '${names.kebab}' já existe: a pasta src/pages/${names.kebab} está no projeto.`,
    )
  }
  if (domainNames) assertDomain(project, domainNames)

  const vars = {
    ...nameVars('page', names),
    ...(domainNames ? nameVars('domain', domainNames) : {}),
  }
  const plan = new ChangePlan(project)
  for (const { template, to } of domainNames ? PAGE_DOMAIN_FILES : PAGE_FILES) {
    plan.createSource(
      path.join(project.root, renderTemplate(to, vars)),
      renderTemplateFile(template, vars),
    )
  }
  for (const language of messageLanguages(project)) {
    const template = messagesTemplate(messagesLanguageOf(language), domainNames !== undefined)
    plan.createText(
      path.join(project.messages, language, `${names.kebab}.json`),
      renderTemplateFile(template, vars),
    )
  }

  const route = `/${names.kebab}`
  registerMessageNamespace(plan, names.kebab, names.camel)
  addRouteSnippet(plan, {
    component: `${names.pascal}Page`,
    importPath: `@/pages/${names.kebab}`,
    path: route,
    element: routeElement(names, route),
  })
  return { plan, names, route, ...(domainNames ? { domain: domainNames } : {}) }
}
