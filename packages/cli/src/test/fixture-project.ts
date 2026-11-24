import { ChangePlan } from '../lib/plan.ts'
import { findProject, type Project } from '../lib/project.ts'
import { generatedApp, patchText } from './app.ts'
import { makeProject } from './fs.ts'

/** O `index.ts` de mensagens de um idioma: os dois últimos namespaces fora da ordem alfabética. */
const MESSAGES_INDEX = `// Mensagens, um arquivo por namespace.
import addProduct from './add-product.json'
import common from './common.json'
import layout from './layout.json'
import productsList from './products-list.json'
import profile from './profile.json'
import error404 from './error-404.json'
import blank from './blank.json'

export default {
  addProduct,
  common,
  layout,
  productsList,
  profile,
  error404,
  blank,
}
`

const NAMESPACES = [
  'add-product',
  'common',
  'layout',
  'products-list',
  'profile',
  'error-404',
  'blank',
]

/** O `src/schemas/index.ts` do projeto de fixture: exports de estilos variados, em ordem de chegada. */
const SCHEMAS_INDEX = `export * from './entities/user'
export * from '@matizze/prumo-core/data'
export * from './entities/customer'
export * from './forms/sign-in'
export {
  profileSchema,
  type ProfileSchema,
} from './entities/account'
export * from './entities/ai'
`

/** O `src/queries/index.ts` do projeto de fixture: já com dois domínios, fora de ordem de chegada. */
const QUERIES_INDEX = `// Queries, uma por domínio.
export { customerKeys, useCustomersList } from './customers'
export { taskKeys, useTasksList } from './tasks'
`

/**
 * O `src/repositories/index.ts` do projeto de fixture: o container que o `prumo new` gera (o
 * modelo, pelo `generatedApp`), já com quatro domínios registrados.
 */
const DOMAINS = ['account', 'customers', 'support', 'task'] as const
/** A chave de cada domínio no mapa de fábricas. */
const KEYS = { account: 'account', customers: 'customers', support: 'support', task: 'tasks' } as const

function repositoriesIndex(): string {
  const generated = generatedApp()['src/repositories/index.ts']!
  const factory = (domain: string) => `create${domain[0]!.toUpperCase()}${domain.slice(1)}Repository`
  const importOf = (domain: string) => `import { ${factory(domain)} } from './${domain}'`
  const options = "import { DATA_SOURCES, type RepositoryOptions } from './options'"
  const withImports = patchText(
    generated,
    options,
    [importOf('account'), importOf('customers'), options, importOf('support'), importOf('task')].join('\n'),
  )
  const withExports = patchText(
    withImports,
    'export { DATA_SOURCES',
    `${DOMAINS.map((d) => `export * from './${d}'`).join('\n')}\nexport { DATA_SOURCES`,
  )
  return patchText(
    withExports,
    'const factories = {}',
    `const factories = {\n${DOMAINS.map((d) => `  ${KEYS[d]}: ${factory(d)},`).join('\n')}\n}`,
  )
}

/** Os arquivos de um idioma do projeto de fixture: o índice e um JSON por namespace. */
function messagesOf(language: string): Record<string, string> {
  return {
    [`src/messages/${language}/index.ts`]: MESSAGES_INDEX,
    ...Object.fromEntries(
      NAMESPACES.map((file) => [
        `src/messages/${language}/${file}.json`,
        '{ "close": "Fechar" }\n',
      ]),
    ),
  }
}

/** O `App.tsx` do projeto de fixture: o do app gerado, com mais duas rotas dentro do `<Switch>`. */
function appWithRoutes(): string {
  const generated = generatedApp()['src/App.tsx']!
  const withImports = patchText(
    generated,
    "import HomePage from '@/pages/home'\n",
    "import BlankPage from '@/pages/blank'\nimport HomePage from '@/pages/home'\nimport ProfilePage from '@/pages/profile'\n",
  )
  return patchText(
    withImports,
    '    </Switch>',
    `      <Route path="/blank">
        <BlankPage />
      </Route>

      <Route path="/profile">
        <ProfilePage />
      </Route>
    </Switch>`,
  )
}

/**
 * Um projeto em miniatura numa pasta temporária, com partes do app gerado (as opções e o container de
 * repositórios, o `App.tsx`) e partes postas em estados específicos para os codemods (as mensagens fora
 * de ordem, os índices de schemas e queries): o `App.tsx`, as mensagens em dois idiomas e os
 * índices de schemas, repositórios e queries, que são os arquivos onde as costuras mexem. Cada
 * chamada devolve um projeto novo, que o teste pode alterar à vontade.
 */
export function fixtureProject(): Project {
  return findProject(
    makeProject({
      'src/App.tsx': appWithRoutes(),
      ...messagesOf('en'),
      ...messagesOf('pt-BR'),
      'src/schemas/index.ts': SCHEMAS_INDEX,
      'src/repositories/index.ts': repositoriesIndex(),
      'src/repositories/options.ts': generatedApp()['src/repositories/options.ts']!,
      'src/queries/index.ts': QUERIES_INDEX,
    }),
  )
}

/** Um plano novo sobre um projeto de fixture novo. */
export function fixturePlan(): ChangePlan {
  return new ChangePlan(fixtureProject())
}
