import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { applyEdits } from './edit.ts'
import { fixturePlan } from './test-support.ts'

const at = (root: string, relative: string) => path.join(root, relative)

describe('ChangePlan', () => {
  it('não escreve nada até o commit e lista o que criaria e alteraria', () => {
    const plan = fixturePlan()
    const { root } = plan.project

    plan.createSource(at(root, 'src/pages/novo/index.tsx'), 'export default function Novo() {}\n')
    plan.createText(at(root, 'src/messages/en/novo.json'), '{}\n')
    const app = plan.source(plan.project.app)
    applyEdits(app, [{ pos: 0, end: 0, text: '// alterado\n' }])
    plan.editText(at(root, 'src/messages/en/common.json'), '{ "close": "Close" }\n')

    expect(plan.summary()).toEqual({
      created: ['src/messages/en/novo.json', 'src/pages/novo/index.tsx'],
      modified: ['src/App.tsx', 'src/messages/en/common.json'],
    })
    expect(existsSync(at(root, 'src/pages/novo'))).toBe(false)
    expect(readFileSync(plan.project.app, 'utf8')).not.toContain('// alterado')

    plan.commit()

    expect(readFileSync(at(root, 'src/pages/novo/index.tsx'), 'utf8')).toBe(
      'export default function Novo() {}\n',
    )
    expect(readFileSync(at(root, 'src/messages/en/novo.json'), 'utf8')).toBe('{}\n')
    expect(readFileSync(plan.project.app, 'utf8').startsWith('// alterado\n')).toBe(true)
    expect(readFileSync(at(root, 'src/messages/en/common.json'), 'utf8')).toBe(
      '{ "close": "Close" }\n',
    )
  })

  it('não conta como alterado o arquivo aberto ou editado que ficou igual', () => {
    const plan = fixturePlan()
    plan.source(plan.project.app)
    const common = at(plan.project.root, 'src/messages/en/common.json')
    plan.editText(common, plan.readText(common))
    expect(plan.summary()).toEqual({ created: [], modified: [] })
  })

  it('recusa criar o que já existe, no disco ou no plano', () => {
    const plan = fixturePlan()
    const { root } = plan.project
    expect(() => plan.createText(at(root, 'src/App.tsx'), '')).toThrow(UsageError)
    plan.createText(at(root, 'src/novo.json'), '{}')
    expect(() => plan.createSource(at(root, 'src/novo.json'), '')).toThrow(/já existe/)
  })

  it('recusa abrir ou ler o que não existe', () => {
    const plan = fixturePlan()
    const missing = at(plan.project.root, 'src/nada.tsx')
    expect(() => plan.source(missing)).toThrow(/'src\/nada.tsx' não existe/)
    expect(() => plan.readText(missing)).toThrow(UsageError)
  })

  it('confere no commit se um arquivo novo apareceu no caminho e não escreve nada', () => {
    const plan = fixturePlan()
    const { root } = plan.project
    const first = at(root, 'src/messages/en/a.json')
    const second = at(root, 'src/messages/en/b.json')
    plan.createText(first, '{}\n')
    plan.createText(second, '{}\n')
    // O arquivo aparece por fora, depois de o plano ser montado
    writeFileSync(second, '{ "de": "fora" }\n')

    expect(() => plan.commit()).toThrow(/'src\/messages\/en\/b.json' já existe: nada foi escrito/)
    expect(existsSync(first)).toBe(false)
    expect(readFileSync(second, 'utf8')).toBe('{ "de": "fora" }\n')
  })

  it('o ts-morph do plano é todo em memória: o que ele cria não vai ao disco sozinho', () => {
    const plan = fixturePlan()
    const file = at(plan.project.root, 'src/pages/novo/index.tsx')
    plan.createSource(file, 'export {}\n').saveSync()
    expect(existsSync(file)).toBe(false)
  })
})
