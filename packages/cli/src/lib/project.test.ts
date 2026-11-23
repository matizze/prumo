import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { findProject } from './project.ts'
import { makeDir, makeProject } from '../test-support.ts'

describe('findProject', () => {
  it('devolve os caminhos do projeto, todos absolutos', () => {
    const root = makeProject({}, ['src'])
    const project = findProject(root)

    expect(project).toEqual({
      root,
      src: path.join(root, 'src'),
      pages: path.join(root, 'src', 'pages'),
      messages: path.join(root, 'src', 'messages'),
      app: path.join(root, 'src', 'App.tsx'),
    })
  })

  it('resolve a raiz relativa pela pasta atual e tira o que sobra do caminho', () => {
    const root = makeProject({}, ['src'])
    const relative = path.relative(process.cwd(), path.join(root, 'src', '..'))

    expect(findProject(relative).root).toBe(root)
  })

  it('não exige que as telas, as mensagens e as rotas já existam', () => {
    const project = findProject(makeProject({ 'src/main.tsx': '' }))

    expect(project.pages).toBe(path.join(project.src, 'pages'))
  })

  describe('lança UsageError (saída 2) com o motivo', () => {
    function problem(root: string): string {
      try {
        findProject(root)
      } catch (error) {
        expect(error).toBeInstanceOf(UsageError)
        return (error as UsageError).message
      }
      throw new Error(`esperava erro para ${root}`)
    }

    it('quando a pasta não existe', () => {
      const root = path.join(makeDir(), 'nao-existe')
      expect(problem(root)).toBe(`a pasta '${root}' não existe.`)
    })

    it('quando o caminho é um arquivo', () => {
      const file = path.join(makeDir(), 'arquivo.txt')
      writeFileSync(file, '')
      expect(problem(file)).toBe(`'${file}' não é uma pasta.`)
    })

    it('quando falta o package.json, mesmo com src', () => {
      const root = makeDir()
      mkdirSync(path.join(root, 'src'))
      expect(problem(root)).toBe(
        `a pasta '${root}' não tem package.json: aponte --root para a raiz do projeto.`,
      )
    })

    it('quando package.json é uma pasta', () => {
      const root = makeDir()
      mkdirSync(path.join(root, 'package.json'))
      mkdirSync(path.join(root, 'src'))
      expect(problem(root)).toContain('não tem package.json')
    })

    it('quando falta o src', () => {
      const root = makeProject({})
      expect(problem(root)).toBe(
        `a pasta '${root}' não tem src: aponte --root para a raiz do projeto.`,
      )
    })

    it('quando src é um arquivo', () => {
      expect(problem(makeProject({ src: '' }))).toContain('não tem src')
    })
  })
})
