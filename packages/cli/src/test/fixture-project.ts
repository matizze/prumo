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
 * Um projeto em miniatura numa pasta temporária, com partes do app gerado (o registro de use cases, o `App.tsx`) e partes postas em estados específicos para os codemods (as mensagens fora
 * de ordem, o índice de schemas): o `App.tsx`, as mensagens em dois idiomas e o
 * índice de schemas, que são os arquivos onde as costuras mexem. Cada
 * chamada devolve um projeto novo, que o teste pode alterar à vontade.
 */
export function fixtureProject(): Project {
  return findProject(
    makeProject({
      'src/App.tsx': appWithRoutes(),
      ...messagesOf('en'),
      ...messagesOf('pt-BR'),
      'src/schemas/index.ts': SCHEMAS_INDEX,
      'src/use-cases/deps.ts': generatedApp()['src/use-cases/deps.ts']!,
      'src/use-cases/index.ts': generatedApp()['src/use-cases/index.ts']!,
    }),
  )
}

/** Um plano novo sobre um projeto de fixture novo. */
export function fixturePlan(): ChangePlan {
  return new ChangePlan(fixtureProject())
}
