import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRUMO_VERSIONS } from './versions.ts'

const PACKAGES = path.resolve(import.meta.dirname, '../../..')

describe('PRUMO_VERSIONS', () => {
  it('tem a versão de cada pacote do workspace (ao subir uma versão, atualize versions.ts)', () => {
    const actual: Record<string, string> = {}
    for (const folder of ['rules', 'core', 'testing', 'cli']) {
      const manifest = JSON.parse(
        readFileSync(path.join(PACKAGES, folder, 'package.json'), 'utf8'),
      ) as { name: string; version: string }
      actual[manifest.name] = manifest.version
    }
    expect(PRUMO_VERSIONS).toEqual(actual)
  })

  it('lista os pacotes na ordem de publicação: o rules antes do cli', () => {
    expect(Object.keys(PRUMO_VERSIONS)).toEqual([
      '@matizze/prumo-rules',
      '@matizze/prumo-core',
      '@matizze/prumo-testing',
      '@matizze/prumo-cli',
    ])
  })
})
