import { ChangePlan } from '../lib/plan.ts'
import { findProject, type Project } from '../lib/project.ts'
import { makeProject } from '../test-support.ts'

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

/** O `src/repositories/index.ts` do projeto de fixture: o container, com quatro domínios. */
const REPOSITORIES_INDEX = `import {
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
  const dataSource = options.dataSource ?? resolveDataSource(undefined, DATA_SOURCES, 'mock')
  return createRepositoryContainer(factories, { ...options, dataSource })
}
`

/** O `src/repositories/options.ts` do projeto de fixture: só o mock. */
const REPOSITORY_OPTIONS = `import type { RepositoryOptions as CoreRepositoryOptions } from '@matizze/prumo-core/repositories'

export const DATA_SOURCES = ['mock'] as const

export type DataSource = (typeof DATA_SOURCES)[number]

export type RepositoryOptions = CoreRepositoryOptions<DataSource>
`

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
      'src/schemas/index.ts': SCHEMAS_INDEX,
      'src/repositories/index.ts': REPOSITORIES_INDEX,
      'src/repositories/options.ts': REPOSITORY_OPTIONS,
      'src/queries/index.ts': QUERIES_INDEX,
    }),
  )
}

/** Um plano novo sobre um projeto de fixture novo. */
export function fixturePlan(): ChangePlan {
  return new ChangePlan(fixtureProject())
}
