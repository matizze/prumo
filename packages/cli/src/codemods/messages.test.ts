import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { findProject } from '../lib/project.ts'
import { makeProject } from '../test/fs.ts'
import { messageLanguages } from './messages.ts'

describe('messageLanguages', () => {
  it('lista os idiomas que têm index.ts, em ordem', () => {
    const root = makeProject({
      'src/messages/pt-BR/index.ts': '',
      'src/messages/en/index.ts': '',
      'src/messages/rascunho/nota.json': '{}',
    })
    expect(messageLanguages(findProject(root))).toEqual(['en', 'pt-BR'])
  })

  it('recusa o projeto sem src/messages e o sem idioma', () => {
    expect(() => messageLanguages(findProject(makeProject({}, ['src'])))).toThrow(UsageError)
    expect(() =>
      messageLanguages(findProject(makeProject({}, ['src/messages']))),
    ).toThrow('não tem idioma')
  })
})
