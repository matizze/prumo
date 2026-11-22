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
    plan.createCopy(
      at(root, 'src/pages/products-list/README.md'),
      at(root, 'src/pages/novo/README.md'),
    )
    const app = plan.source(plan.project.app)
    applyEdits(app, [{ pos: 0, end: 0, text: '// alterado\n' }])
    plan.editText(at(root, 'src/messages/en/common.json'), '{ "close": "Close" }\n')

    expect(plan.summary()).toEqual({
      created: [
        'src/messages/en/novo.json',
        'src/pages/novo/README.md',
        'src/pages/novo/index.tsx',
      ],
      modified: ['src/App.tsx', 'src/messages/en/common.json'],
    })
    expect(existsSync(at(root, 'src/pages/novo'))).toBe(false)
    expect(readFileSync(plan.project.app, 'utf8')).not.toContain('// alterado')

    plan.commit()

    expect(readFileSync(at(root, 'src/pages/novo/index.tsx'), 'utf8')).toBe(
      'export default function Novo() {}\n',
    )
    expect(readFileSync(at(root, 'src/pages/novo/README.md'), 'utf8')).toBe(
      'Notas da tela de lista.\n',
    )
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

  it('overwriteCopy troca o arquivo existente pela cópia no commit, e o conta como alterado', () => {
    const plan = fixturePlan()
    const { root } = plan.project
    const target = at(root, 'src/pages/products-list/README.md')
    const from = at(root, 'src/pages/blank/model.ts')
    plan.overwriteCopy(from, target)

    expect(plan.summary()).toEqual({ created: [], modified: ['src/pages/products-list/README.md'] })
    expect(readFileSync(target, 'utf8')).toBe('Notas da tela de lista.\n')

    plan.commit()
    expect(readFileSync(target, 'utf8')).toBe(readFileSync(from, 'utf8'))
  })

  it('overwriteCopy recusa o arquivo que não existe e o que o plano mesmo vai criar', () => {
    const plan = fixturePlan()
    const { root } = plan.project
    const from = at(root, 'src/pages/blank/model.ts')

    expect(() => plan.overwriteCopy(from, at(root, 'src/nada.ts'))).toThrow(UsageError)
    plan.createText(at(root, 'src/novo.json'), '{}\n')
    expect(() => plan.overwriteCopy(from, at(root, 'src/novo.json'))).toThrow(
      "'src/novo.json' não existe no projeto.",
    )
  })

  it('touchedText devolve o texto que o plano deixará no arquivo, e nada se o plano não o tocou', () => {
    const plan = fixturePlan()
    const { root } = plan.project
    const untouched = at(root, 'src/pages/blank/model.ts')
    const created = at(root, 'src/pages/novo/index.tsx')
    const opened = plan.project.app
    const edited = at(root, 'src/messages/en/common.json')

    plan.createSource(created, 'export const novo = 1\n')
    applyEdits(plan.source(opened), [{ pos: 0, end: 0, text: '// alterado\n' }])
    plan.editText(edited, '{}\n')

    expect(plan.touchedText(untouched)).toBeUndefined()
    expect(plan.touchedText(created)).toBe('export const novo = 1\n')
    expect(plan.touchedText(opened)?.startsWith('// alterado\n')).toBe(true)
    expect(plan.touchedText(edited)).toBe('{}\n')
  })

  it('edits lista o antes e o depois das costuras, em ordem, sem as que ficaram iguais', () => {
    const plan = fixturePlan()
    const { root } = plan.project
    applyEdits(plan.source(plan.project.app), [{ pos: 0, end: 0, text: '// alterado\n' }])
    plan.source(at(root, 'src/queries/index.ts'))
    plan.editText(at(root, 'src/messages/en/common.json'), '{ "close": "Close" }\n')

    const edits = plan.edits()
    expect(edits.map((edit) => path.relative(root, edit.file))).toEqual([
      'src/App.tsx',
      'src/messages/en/common.json',
    ])
    expect(edits[0]?.after.startsWith('// alterado\n')).toBe(true)
    expect(edits[0]?.before.startsWith('// alterado')).toBe(false)
  })

  describe('moveFile', () => {
    it('cria o arquivo no destino com o texto editado, lista como movido e apaga a origem no commit', () => {
      const plan = fixturePlan()
      const { root } = plan.project
      const code = at(root, 'src/pages/file-manager/components/storage-card.tsx')
      const doc = at(root, 'src/pages/products-list/README.md')
      const original = readFileSync(code, 'utf8')

      const moved = plan.moveFile(code, at(root, 'src/components/shared/storage-card.tsx'))
      expect(moved?.getFullText()).toBe(original)
      expect(plan.moveFile(doc, at(root, 'src/components/shared/README.md'))).toBeUndefined()
      applyEdits(moved!, [{ pos: 0, end: 0, text: '// movido\n' }])

      expect(plan.summary()).toEqual({
        created: [],
        modified: [],
        moved: [
          {
            from: 'src/pages/file-manager/components/storage-card.tsx',
            to: 'src/components/shared/storage-card.tsx',
          },
          {
            from: 'src/pages/products-list/README.md',
            to: 'src/components/shared/README.md',
          },
        ],
      })
      expect(existsSync(code)).toBe(true)
      expect(existsSync(at(root, 'src/components/shared'))).toBe(false)

      plan.commit()
      expect(existsSync(code)).toBe(false)
      expect(existsSync(doc)).toBe(false)
      expect(readFileSync(at(root, 'src/components/shared/storage-card.tsx'), 'utf8')).toBe(
        `// movido\n${original}`,
      )
      expect(readFileSync(at(root, 'src/components/shared/README.md'), 'utf8')).toBe(
        'Notas da tela de lista.\n',
      )
    })

    it('apaga a pasta que ficou vazia e deixa a que ainda tem arquivos', () => {
      const plan = fixturePlan()
      const { root } = plan.project
      plan.moveFile(
        at(root, 'src/pages/file-manager/components/storage-card.stories.tsx'),
        at(root, 'src/components/shared/storage-card.stories.tsx'),
      )
      plan.moveFile(
        at(root, 'src/pages/file-manager/components/storage-card.tsx'),
        at(root, 'src/components/shared/storage-card.tsx'),
      )
      plan.commit()
      expect(existsSync(at(root, 'src/pages/file-manager/components'))).toBe(false)
      expect(existsSync(at(root, 'src/pages/file-manager/model.ts'))).toBe(true)
    })

    it('recusa origem que não existe, destino que existe e arquivo já movido ou alterado', () => {
      const plan = fixturePlan()
      const { root } = plan.project
      const from = at(root, 'src/pages/blank/model.ts')

      expect(() => plan.moveFile(at(root, 'src/nada.ts'), at(root, 'src/novo.ts'))).toThrow(
        "'src/nada.ts' não existe no projeto.",
      )
      expect(() => plan.moveFile(from, at(root, 'src/pages/blank/view.tsx'))).toThrow(
        "'src/pages/blank/view.tsx' já existe.",
      )
      plan.source(at(root, 'src/pages/blank/view.tsx'))
      expect(() =>
        plan.moveFile(at(root, 'src/pages/blank/view.tsx'), at(root, 'src/x.tsx')),
      ).toThrow('o plano já alterou')
      plan.moveFile(from, at(root, 'src/model.ts'))
      expect(() => plan.moveFile(from, at(root, 'src/outro.ts'))).toThrow('o plano já moveu')
    })
  })
})
