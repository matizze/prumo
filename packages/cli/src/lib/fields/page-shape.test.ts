import { describe, expect, it } from 'vitest'
import { domainShapeOf } from './page-shape.ts'

describe('domainShapeOf', () => {
  const schema = (fields: string) => ({
    file: 'src/schemas/entities/livro.ts',
    camel: 'livro',
    source: `export const livroSchema = z.object({\n  id: z.string(),\n${fields}  createdAt: z.string(),\n})\n`,
  })

  it('pega o primeiro campo de texto obrigatório e o valor dele na primeira fixture', () => {
    const shape = domainShapeOf(
      schema('  ano: z.number(),\n  apelido: z.string().optional(),\n  titulo: z.string(),\n'),
      "[{ id: 'livro-1', ano: 1, apelido: 'a', titulo: 'Dom Casmurro' }]",
    )

    expect(shape).toEqual({ field: 'titulo', sample: 'Dom Casmurro' })
  })

  it('só com campo de texto opcional, usa o primeiro deles', () => {
    expect(domainShapeOf(schema('  apelido: z.string().optional(),\n'), undefined).field).toBe('apelido')
  })

  it('datas (z.iso.date) não são campo de texto', () => {
    const shape = domainShapeOf(schema('  publicadoEm: z.iso.date(),\n'), "{ id: 'livro-1' }")

    expect(shape.field).toBe('id')
    expect(shape.sample).toBe('livro-1')
    expect(shape.warning).toContain('não tem campo de texto')
  })

  it('sem schema legível, usa o id e diz por quê', () => {
    const shape = domainShapeOf({ file: 'src/schemas/entities/livro.ts', source: undefined, camel: 'livro' }, undefined)

    expect(shape.field).toBe('id')
    expect(shape.warning).toContain('não consegui ler o schema')
  })
})
