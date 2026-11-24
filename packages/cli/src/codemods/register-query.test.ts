import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { makeProject } from '../test/fs.ts'
import { ChangePlan } from '../lib/plan.ts'
import { findProject } from '../lib/project.ts'
import { isQueriesRegistered, registerQueriesEntry } from './register-query.ts'
import { fixturePlan } from '../test/fixture-project.ts'

const text = (plan: ChangePlan) => plan.source(`${plan.project.src}/queries/index.ts`).getFullText()

describe('registerQueriesEntry', () => {
  it('põe o export em ordem alfabética pelo módulo', () => {
    const plan = fixturePlan()
    registerQueriesEntry(plan, { module: 'suppliers', exports: ['supplierKeys', 'useSuppliersList'] })
    expect(text(plan)).toBe(`// Queries, uma por domínio.
export { customerKeys, useCustomersList } from './customers'
export { supplierKeys, useSuppliersList } from './suppliers'
export { taskKeys, useTasksList } from './tasks'
`)
  })

  it('antes do primeiro e depois do último', () => {
    const plan = fixturePlan()
    registerQueriesEntry(plan, { module: 'accounts', exports: ['accountKeys'] })
    registerQueriesEntry(plan, { module: 'users', exports: ['userKeys'] })
    expect(text(plan)).toMatch(/^\/\/ Queries, uma por domínio\.\nexport \{ accountKeys \} from '\.\/accounts'\nexport \{ customerKeys.*\n.*tasks'\nexport \{ userKeys \} from '\.\/users'\n$/)
  })

  it('o primeiro export de um índice só com o comentário vai no fim', () => {
    const root = makeProject({ 'src/queries/index.ts': '// Queries.\n' })
    const plan = new ChangePlan(findProject(root))
    registerQueriesEntry(plan, { module: 'clientes', exports: ['clienteKeys'] })
    expect(text(plan)).toBe("// Queries.\nexport { clienteKeys } from './clientes'\n")
  })

  it('copia as aspas e o ponto e vírgula do arquivo', () => {
    const root = makeProject({ 'src/queries/index.ts': 'export { a } from "./a";\n' })
    const plan = new ChangePlan(findProject(root))
    registerQueriesEntry(plan, { module: 'b', exports: ['b'] })
    expect(text(plan)).toBe('export { a } from "./a";\nexport { b } from "./b";\n')
  })

  it('recusa o módulo que já está e o índice que falta', () => {
    const plan = fixturePlan()
    expect(isQueriesRegistered(plan, 'tasks')).toBe(true)
    expect(isQueriesRegistered(plan, 'accounts')).toBe(false)
    expect(() => registerQueriesEntry(plan, { module: 'tasks', exports: ['x'] })).toThrow(UsageError)
    const bare = new ChangePlan(findProject(makeProject({ 'src/App.tsx': '' })))
    expect(() => registerQueriesEntry(bare, { module: 'x', exports: ['x'] })).toThrow(/não tem src\/queries\/index\.ts/)
  })

  it('comentário no fim da linha fica com o export dele, e a linha nova vem depois', () => {
    const root = makeProject({
      'src/queries/index.ts': "export { a } from './a' // do a\nexport { c } from './c'\n",
    })
    const plan = new ChangePlan(findProject(root))
    registerQueriesEntry(plan, { module: 'b', exports: ['b'] })
    expect(text(plan)).toBe("export { a } from './a' // do a\nexport { b } from './b'\nexport { c } from './c'\n")
  })

  it('a linha nova não cai entre o comentário de cima e o export dele', () => {
    const root = makeProject({
      'src/queries/index.ts': "// Queries.\n\nexport { a } from './a'\n// as do c\nexport { c } from './c'\n",
    })
    const plan = new ChangePlan(findProject(root))
    registerQueriesEntry(plan, { module: 'b', exports: ['b'] })
    registerQueriesEntry(plan, { module: '0', exports: ['z'] })
    expect(text(plan)).toBe(
      "// Queries.\n\nexport { z } from './0'\nexport { a } from './a'\nexport { b } from './b'\n// as do c\nexport { c } from './c'\n",
    )
  })

  it('depois do último export, o comentário dele no fim da linha não é partido', () => {
    const root = makeProject({ 'src/queries/index.ts': "export { a } from './a' // do a\n" })
    const plan = new ChangePlan(findProject(root))
    registerQueriesEntry(plan, { module: 'b', exports: ['b'] })
    expect(text(plan)).toBe("export { a } from './a' // do a\nexport { b } from './b'\n")
  })
})
