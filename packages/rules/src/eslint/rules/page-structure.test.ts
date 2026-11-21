import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { createRuleTester } from '../rule-tester.ts'
import { pageStructure } from './page-structure.ts'

// Projeto de verdade em disco, porque a regra olha os arquivos vizinhos
const root = mkdtempSync(path.join(tmpdir(), 'prumo-page-structure-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

function page(name: string, files: string[], pagesDir = 'src/pages'): string {
  const dir = path.join(root, pagesDir, name)
  mkdirSync(dir, { recursive: true })
  for (const file of files) writeFileSync(path.join(dir, file), '')
  return path.join(dir, 'index.tsx')
}

const missing = (page: string, file: string, pagesDir = 'src/pages') => ({
  messageId: 'missingFile' as const,
  data: { page, file, pagesDir },
})

const complete = page('complete', ['index.tsx', 'model.ts', 'view.tsx'])
// O skeleton não é cobrado, mesmo nas telas que o têm
const withSkeleton = page('with-skeleton', ['index.tsx', 'model.ts', 'view.tsx', 'skeleton.tsx'])
const noModel = page('no-model', ['index.tsx', 'view.tsx'])
const noView = page('no-view', ['index.tsx', 'model.ts'])
const onlyIndex = page('only-index', ['index.tsx'])
const custom = page('custom', ['index.tsx', 'model.ts', 'view.tsx'], 'app/screens')
const customMissing = page('custom-missing', ['index.tsx', 'model.ts'], 'app/screens')

createRuleTester().run('page-structure', pageStructure, {
  valid: [
    { filename: complete, code: 'export default 1' },
    { filename: withSkeleton, code: 'export default 1' },
    // Só o index.tsx da tela é verificado: os outros arquivos da pasta não repetem o aviso
    { filename: path.join(path.dirname(noModel), 'view.tsx'), code: 'export default 1' },
    { filename: path.join(path.dirname(noModel), 'index.test.tsx'), code: 'export default 1' },
    // Subpasta da tela e arquivo solto em pages/ não são uma tela
    { filename: path.join(path.dirname(noModel), 'components', 'index.tsx'), code: '' },
    { filename: path.join(root, 'src/pages/index.tsx'), code: 'export default 1' },
    // Fora da pasta das telas
    { filename: path.join(root, 'src/components/shared/index.tsx'), code: 'export default 1' },
    // Opções: outra pasta de telas e outra lista de arquivos
    { filename: custom, code: '', options: [{ pagesDir: 'app/screens' }] },
    { filename: noModel, code: '', options: [{ requiredFiles: ['view.tsx'] }] },
    { filename: onlyIndex, code: '', options: [{ requiredFiles: [] }] },
    // Com a pasta padrão, a de outro nome não vale
    { filename: customMissing, code: '' },
  ],
  invalid: [
    { filename: noModel, code: 'export default 1', errors: [missing('no-model', 'model.ts')] },
    { filename: noView, code: 'export default 1', errors: [missing('no-view', 'view.tsx')] },
    {
      filename: onlyIndex,
      code: 'export default 1',
      errors: [missing('only-index', 'model.ts'), missing('only-index', 'view.tsx')],
    },
    {
      filename: customMissing,
      code: '',
      options: [{ pagesDir: 'app/screens' }],
      errors: [missing('custom-missing', 'view.tsx', 'app/screens')],
    },
    {
      filename: noView,
      code: '',
      options: [{ requiredFiles: ['model.ts', 'view.tsx', 'skeleton.tsx'] }],
      errors: [missing('no-view', 'view.tsx'), missing('no-view', 'skeleton.tsx')],
    },
  ],
})
