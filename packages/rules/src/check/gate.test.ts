import { describe, expect, it } from 'vitest'
import { check } from './index.ts'
import { makeProject } from './project.ts'
import type { Violation } from './types.ts'

// Equivalência com os testes que o app de referência tinha antes do portão (R6). O
// `src/architecture.test.ts` e o `src/i18n/messages.test.ts` foram removidos do app: cada
// verificação deles aparece aqui, com uma violação equivalente num projeto de fixture que o
// `prumo check` precisa acusar e uma variante sem violação que ele precisa deixar passar.
// As verificações por arquivo do `architecture.test.ts` (ui sem app, telas isoladas, SVG solto)
// migraram antes para o plugin de ESLint, que roda no lint do app, e têm os testes em `eslint/`.

const json = (value: unknown) => JSON.stringify(value)

/** Uma tela completa, com o `view.tsx` dado. */
const page = (name: string, view = '') => ({
  [`src/pages/${name}/index.tsx`]: '',
  [`src/pages/${name}/model.ts`]: '',
  [`src/pages/${name}/view.tsx`]: view,
})

const useShared = (module: string) => `import { x } from '@/components/shared/${module}'`

/** Arquivo e regra de cada violação, na ordem em que saem. */
const where = (violations: Violation[]) => violations.map(({ rule, file }) => [rule, file])

describe('architecture.test.ts: "src/components só tem ui, shared e layout"', () => {
  it('acusa uma pasta de domínio em src/components', () => {
    const root = makeProject({
      'src/components/ui/a.tsx': '',
      'src/components/shared/a.tsx': '',
      'src/components/layout/a.tsx': '',
      'src/components/orders/a.tsx': '',
    })
    expect(where(check({ root }))).toContainEqual(['components-folders', 'src/components/orders'])
  })

  it('acusa cada pasta de fora, e deixa passar as três permitidas', () => {
    const root = makeProject({
      'src/components/ui/a.tsx': '',
      'src/components/layout/a.tsx': '',
      'src/components/charts/a.tsx': '',
      'src/components/forms/a.tsx': '',
    })
    expect(where(check({ root }))).toEqual([
      ['components-folders', 'src/components/charts'],
      ['components-folders', 'src/components/forms'],
    ])
  })

  it('não acusa quando só há ui, shared e layout', () => {
    const root = makeProject({
      'src/components/ui/a.tsx': '',
      'src/components/layout/shell.tsx': useShared('brand'),
      'src/components/shared/brand.tsx': '',
    })
    expect(check({ root })).toEqual([])
  })
})

describe('architecture.test.ts: "o que está em shared/ é usado por 2 ou mais telas"', () => {
  const sharedViolations = (files: Record<string, string>) =>
    check({ root: makeProject(files) }).filter((v) => v.rule === 'shared-usage')

  it('acusa o módulo que nenhuma tela usa', () => {
    const violations = sharedViolations({
      'src/components/shared/unused.tsx': '',
      ...page('a'),
      ...page('b'),
    })
    expect(where(violations)).toEqual([['shared-usage', 'src/components/shared/unused.tsx']])
    expect(violations[0]!.message).toContain('nenhuma tela')
  })

  it('acusa o módulo que só uma tela usa', () => {
    const violations = sharedViolations({
      'src/components/shared/table.tsx': '',
      ...page('a', useShared('table')),
      ...page('b'),
    })
    expect(where(violations)).toEqual([['shared-usage', 'src/components/shared/table.tsx']])
    expect(violations[0]!.message).toContain("só a tela 'a'")
  })

  it('acusa a tela que importa o módulo por dois arquivos dela (conta uma tela, não dois)', () => {
    const violations = sharedViolations({
      'src/components/shared/table.tsx': '',
      ...page('a', useShared('table')),
      'src/pages/a/components/row.tsx': useShared('table'),
    })
    expect(where(violations)).toEqual([['shared-usage', 'src/components/shared/table.tsx']])
  })

  it('conta o uso indireto: shared usado só por outro shared vale pelas telas dele', () => {
    const files = {
      'src/components/shared/table.tsx': "import { cell } from './cell'",
      'src/components/shared/cell.ts': '',
    }
    expect(sharedViolations({ ...files, ...page('a', useShared('table')) })).toHaveLength(2)
    expect(
      sharedViolations({
        ...files,
        ...page('a', useShared('table')),
        ...page('b', useShared('table')),
      }),
    ).toEqual([])
  })

  it('a casca do layout conta como todas as telas', () => {
    expect(
      sharedViolations({
        'src/components/shared/brand.tsx': '',
        'src/components/layout/shell.tsx': useShared('brand'),
      }),
    ).toEqual([])
  })

  it('acusa o ciclo entre dois shared que nenhuma tela usa, sem travar', () => {
    const violations = sharedViolations({
      'src/components/shared/a.tsx': "import './b'",
      'src/components/shared/b.tsx': "import './a'",
    })
    expect(violations.map((v) => v.file)).toEqual([
      'src/components/shared/a.tsx',
      'src/components/shared/b.tsx',
    ])
  })

  it('não conta teste nem story como uso, e nem acusa o teste ou a story que mora em shared', () => {
    const violations = sharedViolations({
      'src/components/shared/table.tsx': '',
      'src/components/shared/table.test.tsx': useShared('table'),
      'src/components/shared/table.stories.tsx': useShared('table'),
      ...page('a', useShared('table')),
      'src/pages/b/view.test.tsx': useShared('table'),
    })
    expect(violations.map((v) => v.file)).toEqual(['src/components/shared/table.tsx'])
  })

  it('lê o import relativo, o de pasta (index) e o export ... from', () => {
    expect(
      sharedViolations({
        'src/components/shared/table/index.ts': '',
        ...page('a', "import { x } from '../../components/shared/table'"),
        ...page('b', "export { x } from '@/components/shared/table'"),
      }),
    ).toEqual([])
  })
})

describe('messages.test.ts: "pt-BR e en têm exatamente o mesmo conjunto de chaves"', () => {
  it('acusa a chave que existe em pt-BR e falta em en', () => {
    const root = makeProject({
      'src/messages/pt-BR/a.json': json({ title: 'Título', extra: 'Extra' }),
      'src/messages/en/a.json': json({ title: 'Title' }),
    })
    expect(check({ root }).map((v) => [v.rule, v.file, v.message])).toEqual([
      [
        'messages',
        'src/messages/en/a.json',
        "A chave 'a.extra' existe em 'pt-BR' e falta em 'en'.",
      ],
    ])
  })

  it('acusa a chave que existe em en e falta em pt-BR', () => {
    const root = makeProject({
      'src/messages/pt-BR/a.json': json({ title: 'Título' }),
      'src/messages/en/a.json': json({ title: 'Title', extra: 'Extra' }),
    })
    expect(check({ root }).map((v) => [v.rule, v.file, v.message])).toEqual([
      [
        'messages',
        'src/messages/en/a.json',
        "A chave 'a.extra' existe em 'en' e falta em 'pt-BR'.",
      ],
    ])
  })

  it('acusa o namespace inteiro que só um idioma tem, e a chave aninhada que falta', () => {
    const root = makeProject({
      'src/messages/pt-BR/auth.json': json({ form: { email: 'E-mail', password: 'Senha' } }),
      'src/messages/en/auth.json': json({ form: { email: 'Email' } }),
      'src/messages/pt-BR/billing.json': json({ title: 'Cobrança' }),
    })
    expect(check({ root }).map((v) => v.message)).toEqual([
      "A chave 'auth.form.password' existe em 'pt-BR' e falta em 'en'.",
      "A chave 'billing.title' existe em 'pt-BR' e falta em 'en'.",
    ])
  })

  it('passa quando os dois idiomas têm as mesmas chaves', () => {
    const root = makeProject({
      'src/messages/pt-BR/a.json': json({ title: 'Título', nested: { x: 'x' } }),
      'src/messages/en/a.json': json({ title: 'Title', nested: { x: 'x' } }),
    })
    expect(check({ root })).toEqual([])
  })
})

describe('messages.test.ts: "cada chave usa os mesmos argumentos ICU nos dois idiomas"', () => {
  const diverging = (pt: string, en: string) =>
    check({
      root: makeProject({
        'src/messages/pt-BR/a.json': json({ k: pt }),
        'src/messages/en/a.json': json({ k: en }),
      }),
    })

  it('acusa o argumento com outro nome, o que falta e o que sobra', () => {
    for (const [pt, en] of [
      ['Olá, {name}', 'Hello, {user}'],
      ['Olá, {name}', 'Hello'],
      ['Olá', 'Hello, {name}'],
      ['{a} e {b}', '{a} and {c}'],
    ] as const) {
      const violations = diverging(pt, en)
      expect(where(violations), `${pt} x ${en}`).toEqual([['messages', 'src/messages/en/a.json']])
      expect(violations[0]!.message).toContain("A chave 'a.k' usa argumentos diferentes")
    }
  })

  it('acusa o select com ramos diferentes e o formato de data que só um idioma usa', () => {
    expect(
      where(
        diverging('{s, select, on {ligado} other {desligado}}', '{s, select, off {x} other {y}}'),
      ),
    ).toEqual([['messages', 'src/messages/en/a.json']])
    expect(where(diverging('Em {when, date}', 'On {when}'))).toEqual([
      ['messages', 'src/messages/en/a.json'],
    ])
  })

  it('acusa o argumento que só aparece dentro do ramo de um plural', () => {
    expect(
      where(
        diverging(
          '{n, plural, one {# item de {owner}} other {# itens}}',
          '{n, plural, one {# item} other {# items}}',
        ),
      ),
    ).toEqual([['messages', 'src/messages/en/a.json']])
  })

  it('passa com a ordem trocada, o plural que um idioma simplifica e o texto sem argumento', () => {
    for (const [pt, en] of [
      ['{a} e {b}', '{b} and {a}'],
      ['{n, plural, one {# item} other {# itens}}', '{n, plural, other {# items}}'],
      ['{n}', '{n, plural, one {#} other {#}}'],
      ['{state, select, on {ligado} other {desligado}}', '{state, select, other {off} on {on}}'],
      ['Sem argumentos', 'No arguments'],
    ] as const) {
      expect(diverging(pt, en), `${pt} x ${en}`).toEqual([])
    }
  })

  it('o ICU malformado acusa em vez de quebrar a análise (o teste antigo lançava)', () => {
    const violations = diverging('Olá, {name', 'Hello, {name}')
    expect(violations.map((v) => v.message)).toEqual([
      "A mensagem 'a.k' tem ICU malformado: Chave não fechada em: Olá, {name",
    ])
  })
})

describe('messages.test.ts: "nenhuma mensagem está vazia"', () => {
  it('acusa a mensagem vazia em pt-BR e em en, e a que só tem espaços', () => {
    const root = makeProject({
      'src/messages/pt-BR/a.json': json({ ok: 'x', blank: '', spaces: '   ' }),
      'src/messages/en/a.json': json({ ok: 'x', blank: 'Blank', spaces: '\n\t' }),
    })
    expect(check({ root }).map((v) => [v.file, v.message])).toEqual([
      ['src/messages/pt-BR/a.json', "A mensagem 'a.blank' está vazia."],
      ['src/messages/pt-BR/a.json', "A mensagem 'a.spaces' está vazia."],
      ['src/messages/en/a.json', "A mensagem 'a.spaces' está vazia."],
    ])
  })

  it('passa quando nenhuma mensagem está vazia', () => {
    const root = makeProject({
      'src/messages/pt-BR/a.json': json({ x: 'x' }),
      'src/messages/en/a.json': json({ x: 'x' }),
    })
    expect(check({ root })).toEqual([])
  })
})
