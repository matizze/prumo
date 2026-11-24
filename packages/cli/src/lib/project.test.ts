import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { findProject, locateProject } from './project.ts'
import { makeDir, makeProject, PROJECT_MANIFEST } from '../test/fs.ts'

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

describe('locateProject', () => {
  it('sem --root, sobe da pasta atual até a primeira com src e dependência do Prumo', () => {
    const root = makeProject({ 'src/pages/livros/index.tsx': '' })

    expect(locateProject(root, undefined).root).toBe(root)
    expect(locateProject(path.join(root, 'src', 'pages', 'livros'), undefined).root).toBe(root)
  })

  it('aceita a dependência em dependencies e em devDependencies', () => {
    const dependencies = makeProject({ 'package.json': '{ "dependencies": { "@matizze/prumo-core": "^0.2.0" } }' }, ['src'])
    const dev = makeProject({ 'package.json': '{ "devDependencies": { "@matizze/prumo-rules": "^0.2.0" } }' }, ['src'])

    expect(locateProject(dependencies, undefined).root).toBe(dependencies)
    expect(locateProject(dev, undefined).root).toBe(dev)
  })

  it('pasta com package.json e src que não é do Prumo não serve: segue subindo', () => {
    const root = makeProject({ 'site/package.json': '{ "name": "site" }', 'site/src/main.tsx': '' }, ['src'])

    expect(locateProject(path.join(root, 'site', 'src'), undefined).root).toBe(root)
  })

  it('o projeto mais perto ganha do que está acima', () => {
    const outer = makeProject({ 'inner/package.json': PROJECT_MANIFEST, 'inner/src/main.tsx': '' }, ['src'])

    expect(locateProject(path.join(outer, 'inner', 'src'), undefined).root).toBe(path.join(outer, 'inner'))
  })

  it('com --root, é aquela pasta exata, com os erros do findProject', () => {
    const root = makeProject({}, ['src'])
    const inside = path.join(root, 'src')

    expect(locateProject(inside, '..').root).toBe(root)
    expect(() => locateProject(root, 'src')).toThrow(`a pasta '${inside}' não tem package.json`)
  })

  it('com --root, a pasta não precisa depender do Prumo', () => {
    const root = makeProject({ 'package.json': '{ "name": "site" }' }, ['src'])

    expect(locateProject(makeDir(), root).root).toBe(root)
  })

  it('--root vazio é erro de uso', () => {
    expect(() => locateProject(makeDir(), '')).toThrow("a opção '--root' precisa de um valor.")
  })

  it('sem achar até a raiz do disco, diz de onde procurou e sugere --root', () => {
    const dir = makeDir()

    expect(() => locateProject(dir, undefined)).toThrow(UsageError)
    expect(() => locateProject(dir, undefined)).toThrow(
      new RegExp(`nenhum projeto Prumo achado a partir de '${dir}'.*--root`),
    )
  })
})
