import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { check } from './index.ts'
import { makeProject } from './test-support.ts'

const fixtures = path.join(import.meta.dirname, '__fixtures__')

describe('check nos projetos de fixture', () => {
  it('o projeto sem violação passa limpo', () => {
    expect(check({ root: path.join(fixtures, 'valid') })).toEqual([])
  })

  it('o projeto com uma violação plantada por verificação acusa cada uma, com arquivo e regra', () => {
    const violations = check({ root: path.join(fixtures, 'invalid') })

    expect(violations.map(({ rule, file }) => [rule, file])).toEqual([
      ['components-folders', 'src/components/widgets'],
      ['shared-usage', 'src/components/shared/lonely.tsx'],
      ['page-structure', 'src/pages/orphan/index.tsx'],
      // Mensagem vazia, chave que falta e argumento diferente: todas no arquivo do idioma
      ['messages', 'src/messages/en/common.json'],
      ['messages', 'src/messages/en/common.json'],
      ['messages', 'src/messages/en/common.json'],
    ])
    expect(violations.map((v) => v.message)).toEqual([
      "A pasta 'widgets' não é permitida em src/components: só 'layout', 'shared', 'ui'.",
      "O módulo é usado só pela tela 'home', e o que está em src/components/shared precisa de 2 ou mais telas: mova-o para a tela que o usa.",
      "A tela 'orphan' precisa do arquivo 'index.tsx' na própria pasta.",
      "A mensagem 'common.title' está vazia.",
      "A chave 'common.subtitle' existe em 'pt-BR' e falta em 'en'.",
      "A chave 'common.greeting' usa argumentos diferentes: 'pt-BR' tem [name] e 'en' tem [user].",
    ])
  })
})

describe('shared-usage com telas em subpastas', () => {
  const screen = (name: string, view: string) => ({
    [`src/pages/${name}/index.tsx`]: '',
    [`src/pages/${name}/view.tsx`]: view,
  })

  it('conta cada tela pelo caminho dela, não pela primeira pasta', () => {
    const root = makeProject({
      ...screen('auth/login', "import { t } from '@/components/shared/table'"),
      ...screen('auth/register', "import { t } from '@/components/shared/table'"),
      'src/components/shared/table.tsx': '',
    })
    expect(check({ root, requiredPageFiles: ['index.tsx'] })).toEqual([])
  })

  it('uma tela só em um grupo é uso de uma tela', () => {
    const root = makeProject({
      ...screen('auth/login', "import { t } from '@/components/shared/table'"),
      'src/components/shared/table.tsx': '',
    })
    const [violation] = check({ root, requiredPageFiles: ['index.tsx'] })
    expect(violation?.message).toContain("só pela tela 'auth/login'")
  })
})

describe('use-case-files', () => {
  const files = (names: string[]) =>
    Object.fromEntries(names.map((name) => [`src/use-cases/livros/${name}`, '']))

  it('o use case com os tipos e o teste ao lado passa limpo, com ou sem mock', () => {
    const root = makeProject(
      files([
        'get-livro.usecase.ts',
        'get-livro.types.ts',
        'get-livro.usecase.test.ts',
        'get-livro.mock.ts',
        'save-draft.usecase.ts',
        'save-draft.types.ts',
        'save-draft.usecase.test.ts',
      ]),
    )
    expect(check({ root })).toEqual([])
  })

  it('acusa o que falta ao lado de cada use case, com o arquivo e a mensagem', () => {
    const root = makeProject(
      files([
        'get-livro.usecase.ts',
        'get-livro.usecase.test.ts',
        'list-livros.usecase.ts',
        'list-livros.types.ts',
        'remove-livro.usecase.ts',
        'index.ts',
      ]),
    )
    const violations = check({ root })

    expect(violations.map(({ rule, file }) => [rule, file])).toEqual([
      ['use-case-files', 'src/use-cases/livros/get-livro.usecase.ts'],
      ['use-case-files', 'src/use-cases/livros/list-livros.usecase.ts'],
      ['use-case-files', 'src/use-cases/livros/remove-livro.usecase.ts'],
      ['use-case-files', 'src/use-cases/livros/remove-livro.usecase.ts'],
    ])
    expect(violations.map((v) => v.message)).toEqual([
      "O use case 'get-livro' precisa do arquivo 'get-livro.types.ts' na mesma pasta.",
      "O use case 'list-livros' precisa do arquivo 'list-livros.usecase.test.ts' na mesma pasta.",
      "O use case 'remove-livro' precisa do arquivo 'remove-livro.types.ts' na mesma pasta.",
      "O use case 'remove-livro' precisa do arquivo 'remove-livro.usecase.test.ts' na mesma pasta.",
    ])
  })

  it('a pasta dos use cases é uma opção, e projeto sem ela não acusa nada', () => {
    const root = makeProject({ 'app/domain/x/a.usecase.ts': '' })
    expect(check({ root })).toEqual([])
    expect(check({ root, useCasesDir: 'app/domain' }).map((v) => v.file)).toEqual([
      'app/domain/x/a.usecase.ts',
      'app/domain/x/a.usecase.ts',
    ])
  })
})

describe('components-folders', () => {
  const root = makeProject({
    'src/components/ui/a.tsx': '',
    'src/components/forms/b.tsx': '',
    'src/components/loose.tsx': '',
  })

  it('acusa só as subpastas de fora da lista, e arquivo solto não conta', () => {
    expect(check({ root }).map((v) => v.file)).toEqual(['src/components/forms'])
  })

  it('a lista de pastas permitidas e a pasta dos componentes são opções', () => {
    expect(check({ root, allowedComponentDirs: ['ui', 'forms'] })).toEqual([])
    const other = makeProject({ 'lib/ui/a.tsx': '', 'lib/extra/b.tsx': '' })
    const violations = check({ root: other, componentsDir: 'lib', allowedComponentDirs: ['ui'] })
    expect(violations.map((v) => v.file)).toEqual(['lib/extra'])
  })

  it('projeto sem pasta de componentes não acusa nada', () => {
    expect(check({ root: makeProject({ 'src/pages/.keep': '' }) })).toEqual([])
  })

  it('o que falta não acusa: um projeto pode não ter layout', () => {
    expect(check({ root: makeProject({ 'src/components/ui/a.tsx': '' }) })).toEqual([])
  })
})

describe('shared-usage', () => {
  const page = (name: string, view: string) => ({
    [`src/pages/${name}/index.tsx`]: '',
    [`src/pages/${name}/model.ts`]: '',
    [`src/pages/${name}/view.tsx`]: view,
  })
  const files = (extra: Record<string, string>) => makeProject(extra)
  const sharedFiles = (violations: ReturnType<typeof check>) =>
    violations.filter((v) => v.rule === 'shared-usage').map((v) => v.file)

  it('conta o uso pelo grafo: o módulo só usado por outro shared vale pelas telas dele', () => {
    const root = files({
      'src/components/shared/table.tsx': "import { cell } from './cell'\nexport const t = cell",
      'src/components/shared/cell.ts': 'export const cell = 1',
      ...page('a', "import { t } from '@/components/shared/table'"),
      ...page('b', "import { t } from '../../components/shared/table'"),
    })
    expect(sharedFiles(check({ root }))).toEqual([])
  })

  it('o módulo usado pelas duas vias por uma tela só continua sozinho', () => {
    const root = files({
      'src/components/shared/table.tsx': "import { cell } from './cell'\nexport const t = cell",
      'src/components/shared/cell.ts': 'export const cell = 1',
      ...page('a', "import { t } from '@/components/shared/table'"),
      ...page('b', ''),
    })
    expect(sharedFiles(check({ root }))).toEqual([
      'src/components/shared/cell.ts',
      'src/components/shared/table.tsx',
    ])
  })

  it('a casca do layout conta como duas telas', () => {
    const root = files({
      'src/components/shared/brand.tsx': 'export const brand = 1',
      'src/components/layout/shell.tsx': "import { brand } from '@/components/shared/brand'",
    })
    expect(sharedFiles(check({ root }))).toEqual([])
  })

  it('teste não conta como uso', () => {
    const root = files({
      'src/components/shared/table.tsx': 'export const t = 1',
      ...page('a', "import { t } from '@/components/shared/table'"),
      'src/pages/b/view.test.tsx': "import { t } from '@/components/shared/table'",
    })
    const violations = check({ root }).filter((v) => v.rule === 'shared-usage')
    expect(violations).toHaveLength(1)
    expect(violations[0]!.message).toContain("é usado só pela tela 'a'")
  })

  it('lê export ... from, import() e import de tipo, e resolve a pasta pelo index', () => {
    const root = files({
      'src/components/shared/table/index.ts': 'export const t = 1',
      'src/components/shared/chart.tsx': 'export const c = 1',
      'src/components/shared/form.tsx': 'export const f = 1',
      ...page('a', "export { t } from '@/components/shared/table'"),
      ...page('b', "const load = () => import('@/components/shared/table')"),
      'src/pages/a/chart.tsx': "import type { c } from '@/components/shared/chart'",
      'src/pages/b/chart.tsx': "export * from '@/components/shared/chart'",
      'src/pages/a/form.tsx': "import { f } from '@/components/shared/form'",
    })
    expect(sharedFiles(check({ root }))).toEqual(['src/components/shared/form.tsx'])
  })

  it('import de pacote npm e de caminho de fora de shared não conta', () => {
    const root = files({
      'src/components/shared/table.tsx': 'export const t = 1',
      ...page('a', "import { x } from 'table'\nimport { y } from '@/components/ui/table'"),
    })
    expect(sharedFiles(check({ root }))).toEqual(['src/components/shared/table.tsx'])
  })

  it('o alias, as pastas e a pasta do layout são opções', () => {
    const root = files({
      'app/common/table.tsx': 'export const t = 1',
      'app/screens/a/view.tsx': "import { t } from '~/common/table'",
      'app/screens/b/view.tsx': "import { t } from '~/common/table'",
      'app/screens/c/view.tsx': "import { t } from '~/common/other'",
    })
    const options = {
      root,
      alias: '~',
      aliasRoot: 'app',
      pagesDir: 'app/screens',
      sharedDir: 'app/common',
      layoutDir: 'app/shell',
      requiredPageFiles: [],
    }
    expect(check(options)).toEqual([])
  })
})

describe('page-structure', () => {
  it('acusa cada arquivo que falta, na pasta de cada tela, mesmo sem o index.tsx', () => {
    const root = makeProject({
      'src/pages/ok/index.tsx': '',
      'src/pages/ok/model.ts': '',
      'src/pages/ok/view.tsx': '',
      'src/pages/ghost/helpers.ts': '',
      'src/pages/only-view/view.tsx': '',
    })
    expect(check({ root }).map((v) => [v.rule, v.file])).toEqual([
      ['page-structure', 'src/pages/ghost/index.tsx'],
      ['page-structure', 'src/pages/ghost/model.ts'],
      ['page-structure', 'src/pages/ghost/view.tsx'],
      ['page-structure', 'src/pages/only-view/index.tsx'],
      ['page-structure', 'src/pages/only-view/model.ts'],
    ])
  })

  it('confere as telas em subpastas e deixa a pasta de grupo em paz', () => {
    const root = makeProject({
      'src/pages/auth/login/index.tsx': '',
      'src/pages/auth/login/model.ts': '',
      'src/pages/auth/login/view.tsx': '',
      'src/pages/auth/login/components/index.tsx': '',
      'src/pages/auth/shared.ts': '',
      'src/pages/auth/register/index.tsx': '',
      'src/pages/auth/register/view.tsx': '',
      'src/pages/auth/legacy/helpers.ts': '',
    })
    expect(check({ root }).map((v) => v.file)).toEqual([
      'src/pages/auth/legacy/index.tsx',
      'src/pages/auth/legacy/model.ts',
      'src/pages/auth/legacy/view.tsx',
      'src/pages/auth/register/model.ts',
    ])
  })

  it('a subpasta de uma tela incompleta não vira outra tela', () => {
    const root = makeProject({
      'src/pages/relatorio/model.ts': '',
      'src/pages/relatorio/view.tsx': '',
      'src/pages/relatorio/components/card.tsx': '',
    })
    expect(check({ root }).map((v) => v.file)).toEqual(['src/pages/relatorio/index.tsx'])
  })

  it('só os arquivos da lista são cobrados, e a lista é opção', () => {
    const root = makeProject({
      'src/pages/a/index.tsx': '',
      'src/pages/a/model.ts': '',
      'src/pages/a/view.tsx': '',
    })
    expect(check({ root })).toEqual([])
    const violations = check({ root, requiredPageFiles: ['index.tsx', 'helpers.ts'] })
    expect(violations.map((v) => v.file)).toEqual(['src/pages/a/helpers.ts'])
  })

  it('arquivo solto em pages não é uma tela', () => {
    expect(check({ root: makeProject({ 'src/pages/index.ts': '' }) })).toEqual([])
  })
})

describe('messages', () => {
  const json = (value: unknown) => JSON.stringify(value)

  it('sem a pasta de mensagens, o projeto não tem i18n e passa', () => {
    expect(check({ root: makeProject({ 'src/pages/.keep': '' }) })).toEqual([])
  })

  it('lê as mensagens aninhadas e acusa o que falta nos dois sentidos', () => {
    const root = makeProject({
      'src/messages/pt-BR/auth.json': json({ title: 'Entrar', form: { email: 'E-mail' } }),
      'src/messages/en/auth.json': json({ title: 'Sign in', form: { password: 'Password' } }),
      'src/messages/pt-BR/billing.json': json({ title: 'Cobrança' }),
    })
    expect(check({ root }).map((v) => [v.file, v.message])).toEqual([
      ['src/messages/en/auth.json', "A chave 'auth.form.email' existe em 'pt-BR' e falta em 'en'."],
      [
        'src/messages/en/billing.json',
        "A chave 'billing.title' existe em 'pt-BR' e falta em 'en'.",
      ],
      [
        'src/messages/en/auth.json',
        "A chave 'auth.form.password' existe em 'en' e falta em 'pt-BR'.",
      ],
    ])
  })

  it('compara os argumentos ICU, inclusive plural e select, e ignora a ordem', () => {
    const root = makeProject({
      'src/messages/pt-BR/a.json': json({
        ok: '{a} e {b}',
        plural: '{n, plural, one {# item} other {# itens}}',
        select: '{s, select, on {ligado} other {desligado}}',
        date: 'Em {when, date}',
      }),
      'src/messages/en/a.json': json({
        ok: '{b} and {a}',
        plural: '{n, plural, other {# items}}',
        select: '{s, select, on {on} off {off} other {other}}',
        date: 'On {when}',
      }),
    })
    expect(check({ root }).map((v) => v.message)).toEqual([
      "A chave 'a.select' usa argumentos diferentes: 'pt-BR' tem [s:select[on|other]] e 'en' tem [s:select[off|on|other]].",
      "A chave 'a.date' usa argumentos diferentes: 'pt-BR' tem [when:date] e 'en' tem [when].",
    ])
  })

  it('acusa mensagem vazia em qualquer idioma, inclusive só com espaços', () => {
    const root = makeProject({
      'src/messages/pt-BR/a.json': json({ x: '  ' }),
      'src/messages/en/a.json': json({ x: '' }),
    })
    expect(check({ root }).map((v) => [v.file, v.message])).toEqual([
      ['src/messages/pt-BR/a.json', "A mensagem 'a.x' está vazia."],
      ['src/messages/en/a.json', "A mensagem 'a.x' está vazia."],
    ])
  })

  it('acusa JSON inválido, valor que não é texto e ICU malformado, sem quebrar', () => {
    const root = makeProject({
      'src/messages/pt-BR/broken.json': '{ "x": ',
      'src/messages/en/broken.json': json({}),
      'src/messages/pt-BR/types.json': json({ n: 3, list: ['a'] }),
      'src/messages/en/types.json': json({ n: 'três', list: 'a' }),
      'src/messages/pt-BR/icu.json': json({ a: 'Olá, {name' }),
      'src/messages/en/icu.json': json({ a: 'Hello, {name' }),
    })
    const violations = check({ root })
    expect(violations.every((v) => v.rule === 'messages')).toBe(true)
    expect(violations.map((v) => v.message)).toEqual([
      'O arquivo não é um JSON válido: Unexpected end of JSON input',
      "A mensagem 'types.n' precisa ser um texto.",
      "A mensagem 'types.list' precisa ser um texto.",
      // O valor que não é texto não conta como mensagem, então o idioma que o tem em texto sobra
      "A chave 'types.n' existe em 'en' e falta em 'pt-BR'.",
      "A chave 'types.list' existe em 'en' e falta em 'pt-BR'.",
      "A mensagem 'icu.a' tem ICU malformado: Chave não fechada em: Olá, {name",
      "A mensagem 'icu.a' tem ICU malformado: Chave não fechada em: Hello, {name",
    ])
  })

  it('acusa o idioma sem pasta', () => {
    const root = makeProject({ 'src/messages/pt-BR/a.json': json({ x: 'x' }) })
    expect(check({ root }).map((v) => [v.file, v.message])).toEqual([
      ['src/messages/en', "A pasta do idioma 'en' não existe."],
    ])
  })

  it('a pasta de mensagens e os idiomas são opções, e o primeiro é a referência', () => {
    const root = makeProject({
      'i18n/en/a.json': json({ x: 'x', y: 'y' }),
      'i18n/es/a.json': json({ x: 'x' }),
      'i18n/fr/a.json': json({ x: 'x', y: 'y', z: 'z' }),
    })
    expect(
      check({ root, messagesDir: 'i18n', locales: ['en', 'es', 'fr'] }).map((v) => v.message),
    ).toEqual([
      "A chave 'a.y' existe em 'en' e falta em 'es'.",
      "A chave 'a.z' existe em 'fr' e falta em 'en'.",
    ])
  })
})

describe('messages com index.ts', () => {
  const json = (value: unknown) => JSON.stringify(value)
  const indexOf = (imports: Record<string, string>, entries: string) =>
    `${Object.entries(imports)
      .map(([ident, stem]) => `import ${ident} from './${stem}.json'`)
      .join('\n')}\n\nexport default { ${entries} }\n`
  const messages = (root: string) =>
    check({ root })
      .filter((v) => v.rule === 'messages')
      .map((v) => [v.file, v.message])

  /** Um namespace `add-product` registrado como `addProduct` nos dois idiomas. */
  const registered = (title = 'Título', extra: Record<string, string> = {}) => ({
    'src/messages/pt-BR/add-product.json': json({ title }),
    'src/messages/en/add-product.json': json({ title: 'Title', ...extra }),
    'src/messages/pt-BR/index.ts': indexOf({ addProduct: 'add-product' }, 'addProduct'),
    'src/messages/en/index.ts': indexOf({ addProduct: 'add-product' }, 'addProduct'),
  })

  it('o projeto com index.ts em dia passa limpo', () => {
    expect(messages(makeProject(registered()))).toEqual([])
  })

  it('cita a chave pelo nome registrado, como o app a usa no t()', () => {
    const root = makeProject({
      ...registered('', { extra: 'Extra' }),
      'src/messages/pt-BR/ai-chat.json': json({ nested: { a: 'A' } }),
      'src/messages/en/ai-chat.json': json({ nested: {} }),
      'src/messages/pt-BR/index.ts': indexOf(
        { addProduct: 'add-product', aiChat: 'ai-chat' },
        'addProduct, aiChat',
      ),
      'src/messages/en/index.ts': indexOf(
        { addProduct: 'add-product', aiChat: 'ai-chat' },
        'addProduct, aiChat',
      ),
    })
    expect(messages(root)).toEqual([
      ['src/messages/pt-BR/add-product.json', "A mensagem 'addProduct.title' está vazia."],
      [
        'src/messages/en/ai-chat.json',
        "A chave 'aiChat.nested.a' existe em 'pt-BR' e falta em 'en'.",
      ],
      [
        'src/messages/en/add-product.json',
        "A chave 'addProduct.extra' existe em 'en' e falta em 'pt-BR'.",
      ],
    ])
  })

  it('usa o nome da forma "chave: identificador" e da chave entre aspas', () => {
    const root = makeProject({
      'src/messages/pt-BR/add-product.json': json({ title: 'Título' }),
      'src/messages/en/add-product.json': json({ title: 'Title', extra: 'Extra' }),
      'src/messages/pt-BR/index.ts': indexOf({ product: 'add-product' }, "'add-product': product"),
      'src/messages/en/index.ts': indexOf({ product: 'add-product' }, 'newName: product'),
    })
    expect(messages(root)).toEqual([
      [
        'src/messages/en/index.ts',
        "O namespace 'add-product' está registrado em 'pt-BR' e falta em 'en'.",
      ],
      [
        'src/messages/en/index.ts',
        "O namespace 'newName' está registrado em 'en' e falta em 'pt-BR'.",
      ],
      [
        'src/messages/en/add-product.json',
        "A chave 'add-product.title' existe em 'pt-BR' e falta em 'en'.",
      ],
      [
        'src/messages/en/add-product.json',
        "A chave 'newName.title' existe em 'en' e falta em 'pt-BR'.",
      ],
      [
        'src/messages/en/add-product.json',
        "A chave 'newName.extra' existe em 'en' e falta em 'pt-BR'.",
      ],
    ])
  })

  it('acusa o JSON da pasta que o index.ts não importa', () => {
    const root = makeProject({
      ...registered(),
      'src/messages/pt-BR/forgotten-one.json': json({ x: 'x' }),
      'src/messages/en/forgotten-one.json': json({ x: 'x' }),
    })
    expect(messages(root)).toEqual([
      [
        'src/messages/pt-BR/index.ts',
        "O arquivo 'forgotten-one.json' não está importado nem exportado no index.ts.",
      ],
      [
        'src/messages/en/index.ts',
        "O arquivo 'forgotten-one.json' não está importado nem exportado no index.ts.",
      ],
    ])
  })

  it('acusa o JSON importado e fora do export default', () => {
    const root = makeProject({
      ...registered(),
      'src/messages/en/index.ts': indexOf({ addProduct: 'add-product' }, ''),
    })
    expect(messages(root)).toEqual([
      [
        'src/messages/en/index.ts',
        "O namespace de './add-product.json' está importado, mas não está no export default.",
      ],
      [
        'src/messages/en/index.ts',
        "O namespace 'addProduct' está registrado em 'pt-BR' e falta em 'en'.",
      ],
    ])
  })

  it('acusa o index.ts que importa um JSON que não existe', () => {
    const root = makeProject({
      ...registered(),
      'src/messages/en/index.ts': indexOf(
        { addProduct: 'add-product', ghost: 'ghost' },
        'addProduct, ghost',
      ),
    })
    expect(messages(root)).toEqual([
      ['src/messages/en/index.ts', "O index.ts importa './ghost.json', que não existe em 'en'."],
      [
        'src/messages/en/index.ts',
        "O namespace 'ghost' está registrado em 'en' e falta em 'pt-BR'.",
      ],
    ])
  })

  it('acusa o namespace esquecido num idioma, que o JSON solto não mostra', () => {
    const root = makeProject({
      ...registered(),
      'src/messages/pt-BR/billing.json': json({ title: 'Cobrança' }),
      'src/messages/en/billing.json': json({ title: 'Billing' }),
      'src/messages/pt-BR/index.ts': indexOf(
        { addProduct: 'add-product', billing: 'billing' },
        'addProduct, billing',
      ),
    })
    expect(messages(root)).toEqual([
      [
        'src/messages/en/index.ts',
        "O arquivo 'billing.json' não está importado nem exportado no index.ts.",
      ],
      [
        'src/messages/en/index.ts',
        "O namespace 'billing' está registrado em 'pt-BR' e falta em 'en'.",
      ],
    ])
  })

  it('ignora comentário no index.ts e aceita as chaves em várias linhas', () => {
    const source = `// import fake from './fake.json'
/* export default { fake } */
import addProduct from './add-product.json'

export default {
  // o namespace da tela
  addProduct,
}
`
    const root = makeProject({
      ...registered(),
      'src/messages/pt-BR/index.ts': source,
      'src/messages/en/index.ts': source,
    })
    expect(messages(root)).toEqual([])
  })

  it('só um idioma com index.ts: acusa a diferença antes das chaves soltas', () => {
    const files: Record<string, string> = registered()
    delete files['src/messages/en/index.ts']
    expect(messages(makeProject(files))[0]).toEqual([
      'src/messages/en',
      "O idioma 'pt-BR' registra os namespaces num index.ts e 'en' não tem index.ts.",
    ])
  })
})

describe('opções', () => {
  it('aceita a raiz relativa ao diretório de trabalho', () => {
    const relative = path.relative(process.cwd(), path.join(fixtures, 'valid'))
    expect(check({ root: relative })).toEqual([])
  })
})
