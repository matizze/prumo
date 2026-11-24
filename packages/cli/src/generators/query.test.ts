import { appendFileSync, rmSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemods/test-support.ts'
import { UsageError } from '../errors.ts'
import { generateQuery, queriesExports } from './query.ts'
import { generateRepository } from './repository.ts'
import { generateSchema } from './schema.ts'
import { domainNames } from '../lib/names.ts'

function projectWithRepository(name = 'livros', entity?: string) {
  const project = fixtureProject()
  generateSchema(project, { name, entity }).plan.commit()
  generateRepository(project, { name, entity }).plan.commit()
  return project
}

describe('generateQuery', () => {
  it('planeja o arquivo e o índice, sem tocar o disco', () => {
    const project = projectWithRepository()
    const { plan, exports } = generateQuery(project, { name: 'livros' })

    expect(plan.summary()).toEqual({ created: ['src/queries/livros.ts'], modified: ['src/queries/index.ts'] })
    expect(exports).toEqual(queriesExports(domainNames('livros')))
    expect(exports).toContain('useLivrosList')
    expect(exports).toContain('useRemoveLivro')
  })

  it('o arquivo gerado não deixa marcador nem a palavra undefined', () => {
    const project = projectWithRepository('paes', 'pao')
    const { plan } = generateQuery(project, { name: 'paes', entity: 'pao' })
    plan.commit()
    const text = plan.readText(`${project.root}/src/queries/paes.ts`)
    expect(text).not.toMatch(/\{\{/)
    expect(text).not.toMatch(/undefined/)
    expect(text).toContain("createQueryKeys('paes'")
    expect(text).toContain('export const paoKeys')
    expect(text).toContain('IPaesRepository')
    expect(text).toContain('useRepositories().paes')
  })

  it('sem o repositório: UsageError com a dica, com a entidade quando ela não é a automática', () => {
    const project = fixtureProject()
    expect(() => generateQuery(project, { name: 'paes', entity: 'pao' })).toThrow(
      /rode prumo make:repository paes --entity pao\./,
    )
    expect(() => generateQuery(project, { name: 'livros' })).toThrow(/rode prumo make:repository livros\.$/)
  })

  it('query que já existe (arquivo ou export no índice): UsageError', () => {
    const project = projectWithRepository()
    generateQuery(project, { name: 'livros' }).plan.commit()
    expect(() => generateQuery(project, { name: 'livros' })).toThrow(UsageError)
  })
})

describe('generateQuery com a entidade errada', () => {
  it('--entity esquecido: diz o --entity do repositório', () => {
    const project = projectWithRepository('paes', 'pao')
    expect(() => generateQuery(project, { name: 'paes' })).toThrow(
      /o repositório paes é da entidade pao; rode prumo make:query paes --entity pao\./,
    )
  })

  it('--entity a mais: manda tirar o --entity', () => {
    const project = projectWithRepository('paes')
    expect(() => generateQuery(project, { name: 'paes', entity: 'pao' })).toThrow(
      /é da entidade pae; rode prumo make:query paes\.$/,
    )
  })

  it('a palavra do schema tem limite: PaoSchema não vale por PaSchema', () => {
    const project = projectWithRepository('paes', 'pao')
    expect(() => generateQuery(project, { name: 'paes', entity: 'pa' })).toThrow(/é da entidade pao;/)
  })

  it('contrato que não dá para ler: segue, e o schema que falta dá a dica do make:schema', () => {
    const project = projectWithRepository()
    writeFileSync(`${project.root}/src/repositories/livros/repository.contract.ts`, 'export {}\n')
    rmSync(`${project.root}/src/schemas/entities/livro.ts`)
    expect(() => generateQuery(project, { name: 'livros' })).toThrow(/falta o schema livros \(src\/schemas\/entities\/livro\.ts\); rode prumo make:schema livros\./)
  })

  it('schema com tipos fora do --fields não impede: as queries não leem os campos', () => {
    const project = projectWithRepository()
    appendFileSync(`${project.root}/src/schemas/entities/livro.ts`, '\nexport const extra = z.array(z.string()).nullable()\n')
    expect(() => generateQuery(project, { name: 'livros' })).not.toThrow()
  })

  it('só o export do índice sobrou: a mensagem diz isso, não que o arquivo existe', () => {
    const project = projectWithRepository()
    generateQuery(project, { name: 'livros' }).plan.commit()
    rmSync(`${project.root}/src/queries/livros.ts`)
    expect(() => generateQuery(project, { name: 'livros' })).toThrow(/já exporta '\.\/livros', mas src\/queries\/livros\.ts não existe/)
  })
})
