import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Project, ts } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemods/test-support.ts'
import { UsageError } from '../errors.ts'
import { generateRepository, REPOSITORY_FILES } from './repository.ts'
import { generateSchema } from './schema.ts'

const FIELDS =
  'titulo:string,autor:string,ano:number,paginas:int,situacao:enum(lido|lendo|desejado),disponivel:boolean,publicadoEm:date,lidoEm?:datetime,apelido?:string'

/** Um projeto de fixture com o schema `livros` já no disco (o que o `make:schema` deixa). */
function projectWithSchema(name = 'livros', fields: string | undefined = FIELDS, entity?: string) {
  const project = fixtureProject()
  generateSchema(project, { name, fields, entity }).plan.commit()
  return project
}

describe('generateRepository', () => {
  it('planeja os cinco arquivos e o container, sem tocar o disco', () => {
    const project = projectWithSchema()
    const { plan, names, fields } = generateRepository(project, { name: 'livros' })

    expect(names.singular.kebab).toBe('livro')
    expect(fields).toHaveLength(9)
    expect(plan.summary()).toEqual({
      created: [
        'src/repositories/livros/fixtures.ts',
        'src/repositories/livros/index.ts',
        'src/repositories/livros/repository.contract.test.ts',
        'src/repositories/livros/repository.contract.ts',
        'src/repositories/livros/repository.mock.ts',
      ],
      modified: ['src/repositories/index.ts'],
    })
    expect(REPOSITORY_FILES).toHaveLength(5)
    const index = plan.source(path.join(project.src, 'repositories/index.ts')).getFullText()
    expect(index).toContain("import { createLivrosRepository } from './livros'")
    expect(index).toContain("export * from './livros'")
    expect(index).toContain('  livros: createLivrosRepository,')
  })

  it('os arquivos saem dos campos do schema, e o TypeScript não tem erro de sintaxe', () => {
    const { plan } = generateRepository(projectWithSchema(), { name: 'livros' })
    const check = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve, noEmit: true },
    })
    for (const source of plan.createdSources()) {
      const file = check.createSourceFile(path.basename(source.getFilePath()), source.getFullText())
      expect(file.getPreEmitDiagnostics().filter((d) => d.getCode() < 2000)).toEqual([])
      expect(source.getFullText()).not.toMatch(/\{\{|(?<!(?:: |!== ))undefined/)
    }
    const text = (name: string) =>
      plan.createdSources().find((s) => s.getFilePath().endsWith(name))!.getFullText()
    expect(text('fixtures.ts')).toContain("situacao: 'lido'")
    expect(text('repository.mock.ts')).toContain('item.titulo')
    expect(text('repository.mock.ts')).toContain('createdAt: new Date().toISOString()')
    expect(text('repository.contract.test.ts')).toContain('LIVRO_NOT_FOUND')
  })

  it('--entity: a entidade e o id dos registros seguem o schema', () => {
    const project = projectWithSchema('paes', 'nome:string', 'pao')
    const { plan, names } = generateRepository(project, { name: 'paes', entity: 'pao' })
    expect(names.singular.kebab).toBe('pao')
    const mock = plan
      .createdSources()
      .find((s) => s.getFilePath().endsWith('repository.mock.ts'))!
      .getFullText()
    expect(mock).toContain('class MockPaesRepository')
    expect(mock).toContain('`pao-${this.sequence}`')
  })

  it('um campo novo de tipo reconhecido, posto à mão no schema, entra nos arquivos', () => {
    const project = projectWithSchema('clientes', 'name:string')
    const file = path.join(project.root, 'src/schemas/entities/cliente.ts')
    const text = readFileSync(file, 'utf8')
    writeFileSync(file, text
        .replace('  name: z.string(),', '  name: z.string(),\n  idade: z.number().int(),')
        .replace('.pick({ ', '.pick({ idade: true, ')
        .replace(/(export type ClienteSortKey =[^\n]*)/, "$1 | 'idade'"),
    )
    const { plan, fields } = generateRepository(project, { name: 'clientes' })
    expect(fields.map((f) => f.name)).toEqual(['name', 'idade'])
    const fixtures = plan
      .createdSources()
      .find((s) => s.getFilePath().endsWith('fixtures.ts'))!
      .getFullText()
    expect(fixtures).toContain('idade:')
  })

  it('sem o schema, recusa com a dica do make:schema (e o --entity)', () => {
    const project = fixtureProject()
    expect(() => generateRepository(project, { name: 'clientes' })).toThrow(UsageError)
    expect(() => generateRepository(project, { name: 'clientes' })).toThrow(
      'falta o schema clientes (src/schemas/entities/cliente.ts); rode prumo make:schema clientes.',
    )
    expect(() => generateRepository(project, { name: 'paes', entity: 'pao' })).toThrow(
      'rode prumo make:schema paes --entity pao.',
    )
  })

  it('sem o schema, mas com outro sem repositório, a dica manda repetir o --entity', () => {
    const project = projectWithSchema('paes', 'nome:string', 'pao')
    expect(() => generateRepository(project, { name: 'paes' })).toThrow(
      /repita a opção; schemas sem repositório: pao\./
    )
  })

  it('recusa o repositório que já existe', () => {
    const project = projectWithSchema()
    mkdirSync(path.join(project.src, 'repositories/livros'), { recursive: true })
    expect(() => generateRepository(project, { name: 'livros' })).toThrow(
      /o repositório 'livros' já existe/,
    )
  })

  it('recusa um campo do schema que o Prumo não reconhece, com a linha', () => {
    const project = projectWithSchema('clientes', 'name:string')
    const file = path.join(project.root, 'src/schemas/entities/cliente.ts')
    const { plan } = generateSchema(fixtureProject(), { name: 'clientes' })
    const text = plan.createdSources()[0]!.getFullText().replace('z.string(),', 'z.string().min(3),')
    writeFileSync(file, text)
    expect(() => generateRepository(project, { name: 'clientes' })).toThrow(/cliente\.ts:\d+: /)
  })

  describe('o texto de <ENTIDADE>_NOT_FOUND', () => {
    it('vai ao errors.json de cada idioma, sem trocar o que já existe, e avisa onde falta o arquivo', () => {
      const project = projectWithSchema()
      const pt = path.join(project.messages, 'pt-BR/errors.json')
      writeFileSync(pt, '{ "generic": "Deu errado." }\n')
      writeFileSync(path.join(project.messages, 'en/errors.json'), '{ "LIVRO_NOT_FOUND": "Gone." }\n')
      const { plan, warnings } = generateRepository(project, { name: 'livros' })

      expect(JSON.parse(plan.readText(pt))).toEqual({
        generic: 'Deu errado.',
        LIVRO_NOT_FOUND: 'Registro não encontrado.',
      })
      expect(plan.summary().modified).toEqual([
        'src/messages/pt-BR/errors.json',
        'src/repositories/index.ts',
      ])
      expect(warnings).toEqual([])
    })

    it('num app sem errors.json, avisa e segue', () => {
      const { warnings, plan } = generateRepository(projectWithSchema(), { name: 'livros' })
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('LIVRO_NOT_FOUND')
      expect(warnings[0]).toContain('src/messages/en/errors.json, src/messages/pt-BR/errors.json')
      expect(plan.summary().created).toHaveLength(5)
    })

    it('o idioma que não é português recebe o texto em inglês', () => {
      const project = projectWithSchema()
      const en = path.join(project.messages, 'en/errors.json')
      writeFileSync(en, '{}\n')
      const { plan } = generateRepository(project, { name: 'livros' })
      expect(JSON.parse(plan.readText(en))).toEqual({ LIVRO_NOT_FOUND: 'Record not found.' })
    })
  })

  describe('as fontes http e storage', () => {
    const text = (plan: ReturnType<typeof generateRepository>['plan'], name: string) =>
      plan.createdSources().find((s) => s.getFilePath().endsWith(name))!.getFullText()

    it('http num repositório novo: os cinco arquivos, a fonte, o cliente e a instância; nada é gravado', () => {
      const project = projectWithSchema()
      const { plan, dataSource, created } = generateRepository(project, { name: 'livros', dataSource: 'http' })

      expect(dataSource).toBe('http')
      expect(created).toBe(true)
      expect(plan.summary()).toEqual({
        created: [
          'src/repositories/api.ts',
          'src/repositories/http.ts',
          'src/repositories/livros/fixtures.ts',
          'src/repositories/livros/index.ts',
          'src/repositories/livros/repository.contract.test.ts',
          'src/repositories/livros/repository.contract.ts',
          'src/repositories/livros/repository.http.ts',
          'src/repositories/livros/repository.mock.ts',
          'src/vite-env.d.ts',
        ],
        modified: ['src/repositories/index.ts', 'src/repositories/options.ts'],
      })
      const http = text(plan, 'repository.http.ts')
      expect(http).toContain('class HttpLivrosRepository implements ILivrosRepository')
      expect(http).toContain('pageSchema(livroSchema)')
      expect(http).toContain("method: 'PATCH'")
      expect(http).toContain("'LIVRO_NOT_FOUND'")
      expect(http).toContain('encodeURIComponent(id)')
      expect(http).toContain("`${query.sort.key}:${query.sort.direction}`")
      expect(text(plan, 'src/repositories/api.ts')).toContain("import.meta.env.VITE_API_URL || '/api'")
      expect(text(plan, 'src/repositories/api.ts')).toContain('// auth: {')
    })

    it('http reaproveita o cliente e a instância que o app já tem', () => {
      const project = projectWithSchema()
      writeFileSync(path.join(project.src, 'repositories/http.ts'), 'export {}\n')
      writeFileSync(path.join(project.src, 'repositories/api.ts'), 'export {}\n')
      writeFileSync(path.join(project.src, 'vite-env.d.ts'), '/// <reference types="vite/client" />\n')
      const { plan } = generateRepository(project, { name: 'livros', dataSource: 'http' })
      expect(plan.summary().created).not.toContain('src/repositories/http.ts')
      expect(plan.summary().created).not.toContain('src/repositories/api.ts')
      expect(plan.summary().created).not.toContain('src/vite-env.d.ts')
      expect(plan.summary().created).toContain('src/repositories/livros/repository.http.ts')
    })

    it('storage: a chave é <nome do app>:<domínio>, e o nome sai do package.json', () => {
      const project = projectWithSchema()
      const { plan } = generateRepository(project, { name: 'livros', dataSource: 'storage' })
      expect(text(plan, 'repository.storage.ts')).toContain("STORAGE_KEY = 'app:livros'")
      expect(plan.summary().created).not.toContain('src/repositories/http.ts')

      writeFileSync(path.join(project.root, 'package.json'), '{ "name": "@loja/it\'s" }\n')
      const scoped = generateRepository(project, { name: 'livros', dataSource: 'storage' })
      expect(text(scoped.plan, 'repository.storage.ts')).toContain("STORAGE_KEY = '@loja/it\\'s:livros'")
    })

    it('storage mantém os campos do schema (busca, ordem e criação) como o mock', () => {
      const { plan } = generateRepository(projectWithSchema(), { name: 'livros', dataSource: 'storage' })
      const storage = text(plan, 'repository.storage.ts')
      expect(storage).toContain('item.titulo')
      expect(storage).toContain('situacao: (item) => item.situacao')
      expect(storage).toContain('situacao: input.situacao,')
    })

    it('a fonte que já existe e o repositório que já existe (sem fonte) saem com 2', () => {
      const project = projectWithSchema()
      generateRepository(project, { name: 'livros' }).plan.commit()
      expect(() => generateRepository(project, { name: 'livros' })).toThrow(UsageError)
      generateRepository(project, { name: 'livros', dataSource: 'storage' }).plan.commit()
      expect(() => generateRepository(project, { name: 'livros', dataSource: 'storage' })).toThrow(
        "já tem a fonte storage",
      )
      // O mock criou o repositório antes: a fonte nova entrou, e o http ainda pode entrar
      expect(generateRepository(project, { name: 'livros', dataSource: 'http' }).created).toBe(false)
    })
  })
})
