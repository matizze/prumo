import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Project, ts } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemods/test-support.ts'
import { UsageError } from '../errors.ts'
import { renderTemplateFile, nameVars } from '../lib/templates.ts'
import { domainFieldVars, parseFields } from '../lib/fields.ts'
import { domainNames } from '../lib/names.ts'
import { generateSchema, SCHEMA_FILE } from './schema.ts'

const FIELDS =
  'titulo:string,autor:string,ano:number,paginas:int,situacao:enum(lido|lendo|desejado),disponivel:boolean,publicadoEm:date,lidoEm?:datetime,apelido?:string'

describe('generateSchema', () => {
  it('planeja o schema e o export no índice, sem tocar o disco', () => {
    const project = fixtureProject()
    const { plan, names, fields } = generateSchema(project, { name: 'livros' })

    expect(names.singular.kebab).toBe('livro')
    expect(fields).toEqual([{ name: 'name', type: 'string', optional: false }])
    expect(plan.summary()).toEqual({
      created: ['src/schemas/entities/livro.ts'],
      modified: ['src/schemas/index.ts'],
    })
    const schema = plan.source(path.join(project.root, 'src/schemas/entities/livro.ts')).getFullText()
    expect(schema).toContain('export const livroSchema = z.object({')
    expect(schema).toContain('  name: z.string(),')
    expect(schema).toContain('export const livroInputSchema = livroSchema.pick({ name: true })')
    expect(plan.source(path.join(project.root, 'src/schemas/index.ts')).getFullText()).toContain(
      "export * from './entities/livro'",
    )
  })

  it('--entity dá o singular que a regra erra', () => {
    const { plan, names } = generateSchema(fixtureProject(), { name: 'paes', entity: 'pao' })
    expect(names.singular.kebab).toBe('pao')
    expect(plan.summary().created).toEqual(['src/schemas/entities/pao.ts'])
  })

  it('o schema com campos de todos os tipos é TypeScript sem erro de sintaxe', () => {
    const { plan } = generateSchema(fixtureProject(), { name: 'livros', fields: FIELDS })
    const [source] = plan.createdSources()
    const check = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, noEmit: true },
    }).createSourceFile('livro.ts', source!.getFullText())
    expect(check.getPreEmitDiagnostics().filter((d) => d.getCode() < 2000)).toEqual([])
    expect(source!.getFullText()).toContain("situacao: z.enum(['lido', 'lendo', 'desejado']),")
    expect(source!.getFullText()).toContain('  lidoEm: z.iso.datetime().optional(),')
  })

  it('o modelo renderiza sem sobrar marcador', () => {
    const names = domainNames('livros')
    const vars = {
      ...nameVars('plural', names.plural),
      ...nameVars('singular', names.singular),
      ...domainFieldVars(parseFields(FIELDS), 'livro'),
    }
    const text = renderTemplateFile(SCHEMA_FILE.template, vars)
    expect(text).not.toMatch(/\{\{|undefined/)
    expect(readFileSync(path.join(import.meta.dirname, '../../templates', SCHEMA_FILE.template), 'utf8')).toContain('{{fields.schema}}')
  })

  it.each([
    [{ name: 'Livros' }, /o nome do domínio 'Livros' é inválido/],
    [{ name: 'livros', entity: 'Livro' }, /a entidade 'Livro' é inválido/],
    [{ name: 'livro', entity: 'livro' }, /igual ao nome do domínio/],
    [{ name: 'categories' }, /--entity category/],
    [{ name: 'new', entity: 'novo' }, /palavra reservada/],
    [{ name: 'dates', entity: 'date' }, /nome global/],
    [{ name: 'livros', fields: 'a:text' }, /--fields 'a:text' é inválido/],
    [{ name: 'livros', fields: 'id:string' }, /'id' é reservado/],
    [{ name: 'customers', entity: 'customer' }, /já existe|já exporta/],
  ])('recusa %j', (request, message) => {
    const project = fixtureProject()
    expect(() => generateSchema(project, request)).toThrow(UsageError)
    expect(() => generateSchema(project, request)).toThrow(message)
  })

  it('recusa o schema que já existe no disco', () => {
    const project = fixtureProject()
    generateSchema(project, { name: 'livros' }).plan.commit()
    expect(() => generateSchema(project, { name: 'livros' })).toThrow(
      /o schema 'livro' já existe: src\/schemas\/entities\/livro\.ts/,
    )
  })
})
