import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import { PACKAGE_NAME } from './index.ts'

describe('@matizze/prumo-cli', () => {
  it('exporta o próprio nome pelo ponto de entrada', () => {
    expect(PACKAGE_NAME).toBe(pkg.name)
  })
})
