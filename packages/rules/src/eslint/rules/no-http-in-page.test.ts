import { createRuleTester, inProject } from '../rule-tester.ts'
import { noHttpInPage } from './no-http-in-page.ts'

const view = inProject('src/pages/livros/view.tsx')

const http = (specifier: string) => ({
  messageId: 'httpInPage' as const,
  data: { httpDir: 'src/http', specifier },
})

createRuleTester().run('no-http-in-page', noHttpInPage, {
  valid: [
    // A tela chama use case e usa o que é de fora
    { filename: view, code: "import { useUseCases } from '@/use-cases/provider'" },
    // Só tipo não acopla em tempo de execução: o import type do http fica de fora
    { filename: view, code: "import type { Http } from '@/http/api'" },
    { filename: inProject('src/pages/auth/login/model.ts'), code: "import type { Http } from '@/http/api'" },
    { filename: view, code: "import { x } from './model'" },
    // Parecido com src/http, mas é outra pasta
    { filename: view, code: "import { x } from '@/http-utils/x'" },
    // Fora de uma tela, o use case usa o http
    {
      filename: inProject('src/use-cases/livros/list-livros.usecase.ts'),
      code: "import { api } from '@/http/api'",
    },
    // Opções
    {
      filename: inProject('app/screens/home/view.tsx'),
      code: "import { x } from '~/screens/home/model'",
      options: [{ alias: '~/', aliasRoot: 'app', pagesDir: 'app/screens', httpDir: 'app/net' }],
    },
  ],
  invalid: [
    { filename: view, code: "import { api } from '@/http/api'", errors: [http('@/http/api')] },
    { filename: view, code: "import { api } from '@/http'", errors: [http('@/http')] },
    {
      filename: view,
      code: "import { api } from '../../http/api'",
      errors: [http('../../http/api')],
    },
    // O http do core, pelo nome do pacote, também não entra na tela
    {
      filename: view,
      code: "import { createHttp } from '@matizze/prumo-core/http'",
      errors: [http('@matizze/prumo-core/http')],
    },
    {
      filename: view,
      code: "const load = () => import('@/http/api')",
      errors: [http('@/http/api')],
    },
    {
      filename: inProject('app/screens/home/view.tsx'),
      code: "import { x } from '~/net/api'",
      options: [{ alias: '~/', aliasRoot: 'app', pagesDir: 'app/screens', httpDir: 'app/net' }],
      errors: [{ messageId: 'httpInPage', data: { httpDir: 'app/net', specifier: '~/net/api' } }],
    },
  ],
})
