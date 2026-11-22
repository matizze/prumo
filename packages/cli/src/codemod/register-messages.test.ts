import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { findProject } from '../project.ts'
import { makeProject } from '../test-support.ts'
import { ChangePlan } from './plan.ts'
import { registerMessageNamespace } from './register-messages.ts'
import { fixturePlan } from './test-support.ts'

const indexOf = (plan: ChangePlan, language: string) =>
  plan.source(path.join(plan.project.messages, language, 'index.ts')).getFullText()

describe('registerMessageNamespace', () => {
  it('registra import e chave nos dois idiomas, cada um na posição alfabética', () => {
    const plan = fixturePlan()

    registerMessageNamespace(plan, 'produtos', 'produtos')

    expect(plan.summary()).toEqual({
      created: [],
      modified: ['src/messages/en/index.ts', 'src/messages/pt-BR/index.ts'],
    })
    for (const language of ['pt-BR', 'en']) {
      expect(indexOf(plan, language)).toBe(`// Mensagens, um arquivo por namespace.
import addProduct from './add-product.json'
import common from './common.json'
import layout from './layout.json'
import productsList from './products-list.json'
import produtos from './produtos.json'
import profile from './profile.json'
import error404 from './error-404.json'
import blank from './blank.json'

export default {
  addProduct,
  common,
  layout,
  productsList,
  produtos,
  profile,
  error404,
  blank,
}
`)
    }
  })

  it('grava só os índices no commit: o JSON do namespace é de quem chama', () => {
    const plan = fixturePlan()
    registerMessageNamespace(plan, 'produtos', 'produtos')
    plan.commit()

    for (const language of ['pt-BR', 'en']) {
      const dir = path.join(plan.project.messages, language)
      expect(readFileSync(path.join(dir, 'index.ts'), 'utf8')).toContain('  produtos,\n')
      expect(existsSync(path.join(dir, 'produtos.json'))).toBe(false)
    }
  })

  it('põe no início quando vem antes de todos e no fim quando vem depois de todos', () => {
    const first = fixturePlan()
    registerMessageNamespace(first, 'aaa', 'aaa')
    expect(indexOf(first, 'en')).toContain(
      "// Mensagens, um arquivo por namespace.\nimport aaa from './aaa.json'\nimport addProduct",
    )
    expect(indexOf(first, 'en')).toContain('export default {\n  aaa,\n  addProduct,')

    const last = fixturePlan()
    registerMessageNamespace(last, 'zzz', 'zzz')
    expect(indexOf(last, 'en')).toContain(
      "import blank from './blank.json'\nimport zzz from './zzz.json'\n",
    )
    expect(indexOf(last, 'en')).toContain('  blank,\n  zzz,\n}')
  })

  it('usa o camel do namespace na chave e o kebab no arquivo', () => {
    const plan = fixturePlan()
    registerMessageNamespace(plan, 'pedidos-recentes', 'pedidosRecentes')
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
    })
    const plan = new ChangePlan(findProject(root))

    registerMessageNamespace(plan, 'd', 'd')

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

  it('deixa como está o namespace que o índice já registra com o mesmo arquivo', () => {
    const plan = fixturePlan()

    registerMessageNamespace(plan, 'products-list', 'productsList')

    expect(plan.summary()).toEqual({ created: [], modified: [] })
  })

  it('recusa o namespace registrado com outro arquivo (error404 e error-404), sem escrever nada', () => {
    const plan = fixturePlan()
    // O índice já tem `import error404 from './error-404.json'` e a chave `error404`
    const message = (): string => {
      try {
        registerMessageNamespace(plan, 'error404', 'error404')
      } catch (error) {
        expect(error).toBeInstanceOf(UsageError)
        return (error as Error).message
      }
      throw new Error('devia ter falhado')
    }

    expect(message()).toBe(
      "src/messages/en/index.ts já registra o namespace 'error404' com outro arquivo (error-404): o novo é 'error404.json' (o hífen e os números não mudam o nome em camelCase).",
    )
    // O plano não ficou com o índice pela metade: o import e a chave não foram repetidos
    expect(indexOf(plan, 'en').match(/error404/g)).toHaveLength(2)
  })

  it('recusa o namespace que existe só como chave do objeto, sem import de JSON', () => {
    const root = makeProject({
      'src/messages/en/index.ts':
        "const x = {}\nimport a from './a.json'\nexport default { a, x }\n",
    })
    const plan = new ChangePlan(findProject(root))
    expect(() => registerMessageNamespace(plan, 'x', 'x')).toThrow(
      'com outro arquivo (sem import de JSON)',
    )
  })

  it('recusa um projeto sem idiomas', () => {
    const root = makeProject({}, ['src/messages'])
    const plan = new ChangePlan(findProject(root))
    expect(() => registerMessageNamespace(plan, 'b', 'b')).toThrow(
      /não tem idioma em src\/messages/,
    )
  })
})
