import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findProject } from '../project.ts'
import { makeProject } from '../test-support.ts'
import { mergeBarrel } from './merge-barrel.ts'
import { ChangePlan } from './plan.ts'

/** Um projeto com o barrel dado e uma origem com o barrel de origem; devolve o plano e o resultado. */
function merge(own: string, origin: string) {
  const root = makeProject({ 'src/schemas/index.ts': own })
  const originRoot = makeProject({ 'src/schemas/index.ts': origin })
  const plan = new ChangePlan(findProject(root))
  const file = path.join(root, 'src/schemas/index.ts')
  const added = mergeBarrel(plan, file, path.join(originRoot, 'src/schemas/index.ts'))
  return { plan, added, text: plan.source(file).getFullText() }
}

describe('mergeBarrel', () => {
  it('acrescenta no fim os exports da origem que o barrel do projeto não tem, na ordem da origem', () => {
    const { added, text, plan } = merge(
      "export * from './entities/user'\nexport * from './entities/own'\n",
      "export * from './entities/user'\nexport * from './entities/order'\nexport { a, type B } from './entities/other'\nexport * from './entities/own'\n",
    )

    expect(added).toEqual(['./entities/order', './entities/other'])
    expect(text).toBe(
      "export * from './entities/user'\nexport * from './entities/own'\nexport * from './entities/order'\nexport { a, type B } from './entities/other'\n",
    )
    expect(plan.summary().modified).toEqual(['src/schemas/index.ts'])
  })

  it('não muda o que o produto tem: nem remove, nem reordena, nem troca as aspas dele', () => {
    const own = 'export * from "./entities/own"\nexport const marcador = 1\n'
    const { added, text } = merge(own, "export * from './entities/own'\n")

    expect(added).toEqual([])
    expect(text).toBe(own)
  })

  it('não conta como export o que não tem módulo, e não mexe se nada falta', () => {
    const { added, plan } = merge(
      "export * from './a'\n",
      "export const x = 1\nexport * from './a'\n",
    )

    expect(added).toEqual([])
    expect(plan.summary().modified).toEqual([])
  })

  it('recusa o barrel do projeto sem nenhum export, e não escreve', () => {
    const root = makeProject({ 'src/schemas/index.ts': 'export const so = 1\n' })
    const originRoot = makeProject({ 'src/schemas/index.ts': "export * from './a'\n" })
    const plan = new ChangePlan(findProject(root))

    expect(() =>
      mergeBarrel(
        plan,
        path.join(root, 'src/schemas/index.ts'),
        path.join(originRoot, 'src/schemas/index.ts'),
      ),
    ).toThrow("o barrel 'src/schemas/index.ts' não tem nenhum export")
    expect(readFileSync(path.join(root, 'src/schemas/index.ts'), 'utf8')).toBe(
      'export const so = 1\n',
    )
  })
})
