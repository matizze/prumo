import { rmSync } from 'node:fs'
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
  it('schema e repositório da entidade pao, e o --entity esquecido: não gera', () => {
    const project = projectWithRepository('paes', 'pao')
    expect(() => generateQuery(project, { name: 'paes' })).toThrow(UsageError)
  })

  it('o repositório é de uma entidade e o schema da outra existe: diz o --entity certo', () => {
    // schema pae e pao, repositório da pao; o make:query paes (pae) acha o schema e vê que o repositório é de outra
    const project = projectWithRepository('paes', 'pao')
    generateSchema(project, { name: 'paes' }).plan.commit()
    expect(() => generateQuery(project, { name: 'paes' })).toThrow(/não é da entidade pae.*--entity/s)
  })

  it('--entity a mais, só com o schema da entidade automática: o schema da outra falta', () => {
    const project = projectWithRepository('paes')
    expect(() => generateQuery(project, { name: 'paes', entity: 'pao' })).toThrow(/falta o schema paes/)
  })

  it('a palavra do schema tem limite: PaoSchema não vale por PaSchema', () => {
    const project = projectWithRepository('paes', 'pao')
    generateSchema(project, { name: 'pas', entity: 'pa' }).plan.commit()
    expect(() => generateQuery(project, { name: 'paes', entity: 'pa' })).toThrow(/não é da entidade pa:/)
  })

  it('só o export do índice sobrou: a mensagem diz isso, não que o arquivo existe', () => {
    const project = projectWithRepository()
    generateQuery(project, { name: 'livros' }).plan.commit()
    rmSync(`${project.root}/src/queries/livros.ts`)
    expect(() => generateQuery(project, { name: 'livros' })).toThrow(/já exporta '\.\/livros', mas src\/queries\/livros\.ts não existe/)
  })
})
