import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import * as api from './api.ts'
import * as entry from './index.ts'
import { PACKAGE_NAME } from './index.ts'

describe('@matizze/prumo-cli', () => {
  it('exporta o próprio nome pelo ponto de entrada', () => {
    expect(PACKAGE_NAME).toBe(pkg.name)
  })
  it('reexporta a API em processo, a mesma do subcaminho ./api', () => {
    const names = [
      'createRoot',
      'describeCommands',
      'runCli',
      'runInProcess',
      'toArgv',
      'toolNameOf',
    ]
    for (const name of names) {
      expect(typeof (api as Record<string, unknown>)[name], name).toBe('function')
      expect((entry as Record<string, unknown>)[name], name).toBe(
        (api as Record<string, unknown>)[name],
      )
    }
    expect(pkg.exports['./api']).toBe('./src/api.ts')
  })
})
