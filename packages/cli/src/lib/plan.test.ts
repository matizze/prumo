import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ExitError, UsageError } from '../errors.ts'
import { applyEdits } from '../codemods/edit.ts'
import { fixturePlan } from '../codemods/test-support.ts'
import { ChangePlan } from './plan.ts'
import { findProject, projectAt } from './project.ts'
import { makeDir } from '../test-support.ts'

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

describe('ChangePlan: link simbólico para fora do projeto', () => {
  /** Um projeto de fixture e uma pasta de fora, que começa vazia. As duas somem no fim dos testes. */
  function setup() {
    const plan = fixturePlan()
    return { plan, root: plan.project.root, outside: makeDir() }
  }

  it('recusa escrever por uma pasta do projeto que é link para fora, diz qual é o link e não escreve nada', () => {
    const { plan, root, outside } = setup()
    symlinkSync(outside, at(root, 'src/pages'))
    plan.createSource(at(root, 'src/pages/sobre/index.tsx'), 'export {}\n')
    plan.createText(at(root, 'src/messages/en/sobre.json'), '{}\n')
    expect(() => plan.commit()).toThrow(ExitError)
    expect(() => plan.commit()).toThrow(
      /'src\/pages\/sobre\/index.tsx' levaria a escrita para fora do projeto: 'src\/pages' é um link simbólico para '.+'\. Troque o link/,
    )
    expect(readdirSync(outside)).toEqual([])
    expect(existsSync(at(root, 'src/messages/en/sobre.json'))).toBe(false)
  })

  it('o verify (o --dry-run) recusa o mesmo que o commit, sem escrever', () => {
    const { plan, root, outside } = setup()
    symlinkSync(outside, at(root, 'src/pages'))
    plan.createSource(at(root, 'src/pages/sobre/index.tsx'), 'export {}\n')
    expect(() => plan.verify()).toThrow(/levaria a escrita para fora do projeto/)
    expect(readdirSync(outside)).toEqual([])
  })

  it('recusa o .. depois de um link, como o sistema o resolve (não pelo texto)', () => {
    // box/victim/app/src/up -> ../.. (box/victim) e src/pages -> up/..: pelo texto, src/pages é
    // app/src; o sistema segue up até box/victim e sobe para box
    const box = makeDir()
    const victim = path.join(box, 'victim')
    mkdirSync(victim)
    const { plan } = setup()
    const app = path.join(victim, 'app')
    renameSync(plan.project.root, app)
    const moved = new ChangePlan(findProject(app))
    symlinkSync('../..', path.join(app, 'src/up'))
    symlinkSync('up/..', path.join(app, 'src/pages'))
    moved.createSource(path.join(app, 'src/pages/sobre/index.tsx'), 'export {}\n')
    expect(() => moved.commit()).toThrow(/levaria a escrita para fora do projeto/)
    expect(existsSync(path.join(box, 'sobre'))).toBe(false)
  })

  it('recusa quando o próprio src é link para fora', () => {
    const { plan, root, outside } = setup()
    const real = makeDir()
    renameSync(at(root, 'src'), path.join(real, 'src'))
    symlinkSync(path.join(real, 'src'), at(root, 'src'))
    plan.createText(at(root, 'src/messages/en/novo.json'), '{}\n')
    expect(() => plan.commit()).toThrow(/'src' é um link simbólico para/)
    expect(existsSync(path.join(real, 'src/messages/en/novo.json'))).toBe(false)
    expect(readdirSync(outside)).toEqual([])
  })

  it('recusa alterar um arquivo do projeto que é link para um arquivo de fora', () => {
    const { plan, outside } = setup()
    const target = path.join(outside, 'App.tsx')
    writeFileSync(target, readFileSync(plan.project.app, 'utf8'))
    rmSync(plan.project.app)
    symlinkSync(target, plan.project.app)
    applyEdits(plan.source(plan.project.app), [{ pos: 0, end: 0, text: '// alterado\n' }])
    expect(() => plan.commit()).toThrow(/'src\/App.tsx' levaria a escrita para fora do projeto/)
    expect(readFileSync(target, 'utf8')).not.toContain('// alterado')
  })

  it('recusa um caminho que passa por um link quebrado', () => {
    const { plan, root, outside } = setup()
    symlinkSync(path.join(outside, 'nao-existe'), at(root, 'src/pages'))
    plan.createSource(at(root, 'src/pages/sobre/index.tsx'), 'export {}\n')
    expect(() => plan.commit()).toThrow(/passa por um link simbólico quebrado: 'src\/pages' é um link/)
    expect(readdirSync(outside)).toEqual([])
  })

  it('recusa, com saída 2 e sem pilha, uma raiz que passa por um link quebrado', () => {
    const base = makeDir()
    symlinkSync(path.join(base, 'nao-existe'), path.join(base, 'quebrado'))
    const plan = new ChangePlan(projectAt(path.join(base, 'quebrado', 'app')))
    plan.createText(path.join(base, 'quebrado', 'app', 'package.json'), '{}\n')
    expect(() => plan.commit()).toThrow(ExitError)
    expect(() => plan.commit()).toThrow(/a pasta do projeto .+ passa por um link simbólico quebrado/)
  })

  it('aceita link dentro do projeto que aponta para dentro dele', () => {
    const { plan, root } = setup()
    mkdirSync(at(root, 'src/telas'), { recursive: true })
    symlinkSync(at(root, 'src/telas'), at(root, 'src/pages'))
    plan.createSource(at(root, 'src/pages/sobre/index.tsx'), 'export {}\n')
    plan.commit()
    expect(existsSync(at(root, 'src/telas/sobre/index.tsx'))).toBe(true)
  })

  it('aceita a raiz do projeto aberta por um caminho que é link', () => {
    const { root } = setup()
    const alias = path.join(makeDir(), 'app')
    symlinkSync(root, alias)
    const plan = new ChangePlan(findProject(alias))
    plan.createText(path.join(alias, 'src/messages/en/novo.json'), '{}\n')
    plan.commit()
    expect(existsSync(at(root, 'src/messages/en/novo.json'))).toBe(true)
  })
})
