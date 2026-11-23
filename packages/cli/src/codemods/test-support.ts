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
    }),
  )
}

/** Um plano novo sobre um projeto de fixture novo. */
export function fixturePlan(): ChangePlan {
  return new ChangePlan(fixtureProject())
}
