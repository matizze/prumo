import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { findProject } from '../project.ts'
import { makeProject } from '../test-support.ts'
import { ChangePlan } from './plan.ts'
import { registerMessages } from './register-messages.ts'
import { fixturePlan } from './test-support.ts'

const indexOf = (plan: ChangePlan, language: string) =>
  plan.source(path.join(plan.project.messages, language, 'index.ts')).getFullText()

describe('registerMessages', () => {
  it('copia o JSON nos dois idiomas e registra import e chave na posição alfabética', () => {
    const plan = fixturePlan()

    registerMessages(plan, 'products-list', 'produtos', 'produtos')

    expect(plan.summary()).toEqual({
      created: ['src/messages/en/produtos.json', 'src/messages/pt-BR/produtos.json'],
      modified: ['src/messages/en/index.ts', 'src/messages/pt-BR/index.ts'],
    })
    for (const language of ['pt-BR', 'en']) {
      expect(indexOf(plan, language)).toBe(`// Mensagens, um arquivo por namespace.
import addProduct from './add-product.json'
import common from './common.json'
import invoiceDetail from './invoice-detail.json'
import layout from './layout.json'
import productsList from './products-list.json'
import produtos from './produtos.json'
import profile from './profile.json'
import comingSoon from './coming-soon.json'
import settingsGeneral from './settings-general.json'
import error404 from './error-404.json'
import blank from './blank.json'

export default {
  addProduct,
  common,
  invoiceDetail,
  layout,
  productsList,
  produtos,
  profile,
  comingSoon,
  settingsGeneral,
  error404,
  blank,
}
`)
    }
  })

  it('grava a cópia byte a byte e só no commit', () => {
    const plan = fixturePlan()
    registerMessages(plan, 'products-list', 'produtos', 'produtos')
    plan.commit()

    for (const language of ['pt-BR', 'en']) {
      const dir = path.join(plan.project.messages, language)
      expect(readFileSync(path.join(dir, 'produtos.json'), 'utf8')).toBe(
        readFileSync(path.join(dir, 'products-list.json'), 'utf8'),
      )
    }
  })

  it('põe no início quando vem antes de todos e no fim quando vem depois de todos', () => {
    const first = fixturePlan()
    registerMessages(first, 'products-list', 'aaa', 'aaa')
    expect(indexOf(first, 'en')).toContain(
      "// Mensagens, um arquivo por namespace.\nimport aaa from './aaa.json'\nimport addProduct",
    )
    expect(indexOf(first, 'en')).toContain('export default {\n  aaa,\n  addProduct,')

    const last = fixturePlan()
    registerMessages(last, 'products-list', 'zzz', 'zzz')
    expect(indexOf(last, 'en')).toContain(
      "import blank from './blank.json'\nimport zzz from './zzz.json'\n",
    )
    expect(indexOf(last, 'en')).toContain('  blank,\n  zzz,\n}')
  })

  it('usa o camel do namespace na chave e o kebab no arquivo', () => {
    const plan = fixturePlan()
    registerMessages(plan, 'products-list', 'pedidos-recentes', 'pedidosRecentes')
    expect(indexOf(plan, 'pt-BR')).toContain(
      "import pedidosRecentes from './pedidos-recentes.json'\nimport productsList",
    )
    expect(indexOf(plan, 'pt-BR')).toContain('  layout,\n  pedidosRecentes,\n  productsList,')
  })

  it('respeita aspas duplas, ponto e vírgula e a falta de vírgula final', () => {
    const root = makeProject({
      'src/messages/pt-BR/index.ts': `import a from "./a.json";
import c from "./c.json";

export default {
    a,
    c
};
`,
      'src/messages/pt-BR/a.json': '{}\n',
      'src/messages/pt-BR/c.json': '{}\n',
    })
    const plan = new ChangePlan(findProject(root))

    registerMessages(plan, 'a', 'd', 'd')

    expect(indexOf(plan, 'pt-BR')).toBe(`import a from "./a.json";
import c from "./c.json";
import d from "./d.json";

export default {
    a,
    c,
    d
};
`)
  })

  it('recusa sem escrever nada se falta a referência ou já existe o namespace', () => {
    const missing = fixturePlan()
    expect(() => registerMessages(missing, 'nada', 'produtos', 'produtos')).toThrow(
      /faltam as mensagens da referência: src\/messages\/en\/nada.json/,
    )

    const exists = fixturePlan()
    expect(() => registerMessages(exists, 'products-list', 'profile', 'profile')).toThrow(
      UsageError,
    )
    expect(() => registerMessages(exists, 'products-list', 'profile', 'profile')).toThrow(
      /profile.json' já existe/,
    )
  })

  it('recusa um projeto sem idiomas', () => {
    const root = makeProject({}, ['src/messages'])
    const plan = new ChangePlan(findProject(root))
    expect(() => registerMessages(plan, 'a', 'b', 'b')).toThrow(/não tem idioma em src\/messages/)
  })
})
