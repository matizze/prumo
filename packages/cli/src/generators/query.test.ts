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
