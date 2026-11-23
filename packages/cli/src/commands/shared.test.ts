import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemod/test-support.ts'
import { ExitError } from '../errors.ts'
import { captureRuntime } from '../test-support.ts'
import { checkBefore, finishWithCheck } from './shared.ts'

describe('finishWithCheck', () => {
  it('falha pela violação que o comando causou, sem baseline', () => {
    const project = fixtureProject()
    mkdirSync(path.join(project.root, 'src/components/estranha'), { recursive: true })
    const runtime = captureRuntime(project.root)

    expect(() =>
      finishWithCheck(runtime, project, { generated: 'a tela foi gerada', next: 'proximo' }),
    ).toThrow(ExitError)
    expect(runtime.stderr).toContain('1 violação (a tela foi gerada')
    expect(runtime.stderr).toContain('[components-folders]')
  })

  it('não falha pela violação que já estava no baseline, e a rotula', () => {
    const project = fixtureProject()
    mkdirSync(path.join(project.root, 'src/components/estranha'), { recursive: true })
    const before = checkBefore(project)
    const runtime = captureRuntime(project.root)

    finishWithCheck(runtime, project, { generated: 'a tela foi gerada', next: 'proximo', before })

    expect(runtime.stderr).toBe('')
    expect(runtime.stdout).toContain('prumo check: nenhuma violação nova.')
    expect(runtime.stdout).toContain('Preexistentes (1;')
    expect(runtime.stdout).toContain('proximo')
  })

  it('falha pela violação nova mesmo com uma preexistente, e mostra as duas', () => {
    const project = fixtureProject()
    mkdirSync(path.join(project.root, 'src/components/estranha'), { recursive: true })
    const before = checkBefore(project)
    mkdirSync(path.join(project.root, 'src/components/outra'), { recursive: true })
    const runtime = captureRuntime(project.root)

    expect(() =>
      finishWithCheck(runtime, project, { generated: 'a tela foi gerada', next: 'x', before }),
    ).toThrow(ExitError)
    expect(runtime.stderr).toContain('1 violação (a tela foi gerada')
    expect(runtime.stderr).toContain('outra')
    expect(runtime.stderr).toContain('Preexistentes (1;')
  })
})
