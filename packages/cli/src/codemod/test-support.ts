import { findProject, type Project } from '../project.ts'
import { makeProject } from '../test-support.ts'
import { ChangePlan } from './plan.ts'

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

/** O `App.tsx` do projeto de fixture: duas rotas dentro de um `<Switch>`. */
const APP = `import { Route, Switch } from 'wouter'
import BlankPage from '@/pages/blank'
import ProfilePage from '@/pages/profile'

export default function App() {
  return (
    <Switch>
      <Route path="/blank">
        <BlankPage />
      </Route>

      <Route path="/profile">
        <ProfilePage />
      </Route>
    </Switch>
  )
}
`

/**
 * Um projeto em miniatura numa pasta temporária: o `App.tsx`, as mensagens em dois idiomas e os
 * índices de schemas, repositórios e queries, que são os arquivos onde as costuras mexem. Cada
 * chamada devolve um projeto novo, que o teste pode alterar à vontade.
 */
export function fixtureProject(): Project {
  return findProject(
    makeProject({
      'src/App.tsx': APP,
      ...messagesOf('en'),
      ...messagesOf('pt-BR'),
      'src/schemas/index.ts': `export * from './entities/user'
export * from '@matizze/prumo-core/data'
export * from './entities/customer'
export * from './forms/sign-in'
export {
  profileSchema,
  type ProfileSchema,
} from './entities/account'
export * from './entities/ai'
`,
      'src/repositories/index.ts': `import {
  createRepositoryContainer,
  resolveDataSource,
  type RepositoryContainerOf,
} from '@matizze/prumo-core/repositories'
import { createAccountRepository } from './account'
import { createCustomersRepository } from './customers'
import { DATA_SOURCES, type RepositoryOptions } from './options'
import { createSupportRepository } from './support'
import { createTaskRepository } from './task'

export * from './account'
export * from './customers'
export * from './support'
export * from './task'
export { DATA_SOURCES, type DataSource, type RepositoryOptions } from './options'

/**
 * Mapa de fábricas: cada domínio exporta \`create<Dominio>Repository(options)\` e entra aqui com
 * uma linha, em ordem alfabética.
 */
const factories = {
  account: createAccountRepository,
  customers: createCustomersRepository,
  support: createSupportRepository,
  tasks: createTaskRepository,
}

export type RepositoryContainer = RepositoryContainerOf<typeof factories>

export function createRepositories(options: Partial<RepositoryOptions> = {}): RepositoryContainer {
  const dataSource = options.dataSource ?? resolveDataSource(undefined, DATA_SOURCES, 'memory', 'X')
  return createRepositoryContainer(factories, { ...options, dataSource })
}
`,
      'src/queries/index.ts': `export { accountKeys, accountQueries } from './account'
export { customerKeys, customerQueries } from './customers'
export { supportKeys, supportQueries } from './support'
export { taskKeys, taskQueries } from './tasks'
`,
    }),
  )
}

/** Um plano novo sobre um projeto de fixture novo. */
export function fixturePlan(): ChangePlan {
  return new ChangePlan(fixtureProject())
}
