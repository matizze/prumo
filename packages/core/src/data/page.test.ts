import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { pageSchema, type Page } from './index.ts'

describe('pageSchema', () => {
  const schema = pageSchema(z.object({ id: z.string() }))

  it('valida uma página com itens e total', () => {
    const page: Page<{ id: string }> = { items: [{ id: 'a' }, { id: 'b' }], total: 10 }

    expect(schema.parse(page)).toEqual(page)
  })

  it('recusa item fora do schema e total fracionado', () => {
    expect(schema.safeParse({ items: [{ id: 1 }], total: 1 }).success).toBe(false)
    expect(schema.safeParse({ items: [], total: 1.5 }).success).toBe(false)
  })
})
