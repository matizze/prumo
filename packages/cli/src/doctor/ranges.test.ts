import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { realSystem } from '../commands/doctor.ts'
import { CLI_PACKAGE_NAME, PRUMO_PACKAGES, PRUMO_PACKAGE_RANGES } from './ranges.ts'
import { formatRange, parseRange, parseVersion, positionIn } from './versions.ts'

/** A pasta `packages` do monorepo: cada pacote do workspace tem o `package.json` lá. */
const PACKAGES = path.resolve(import.meta.dirname, '../../..')

function workspaceManifest(name: string): { name: string; version: string } {
  const folder = name.replace('@matizze/prumo-', '')
  return JSON.parse(readFileSync(path.join(PACKAGES, folder, 'package.json'), 'utf8')) as {
    name: string
    version: string
  }
}

describe('tabela de faixas do doctor', () => {
  it('confere todos os pacotes do Prumo, o cli por último', () => {
    expect(PRUMO_PACKAGES.at(-1)).toBe(CLI_PACKAGE_NAME)
    for (const name of PRUMO_PACKAGES) expect(workspaceManifest(name).name).toBe(name)
  })

  it('tem uma faixa legível para cada pacote, menos o cli (a faixa dele é a da versão que roda)', () => {
    const withRange = PRUMO_PACKAGES.filter((name) => name !== CLI_PACKAGE_NAME)
    expect(Object.keys(PRUMO_PACKAGE_RANGES).sort()).toEqual([...withRange].sort())
    for (const [name, text] of Object.entries(PRUMO_PACKAGE_RANGES)) {
      expect(parseRange(text), `${name}: ${text}`).toBeDefined()
    }
  })

  // Quando um pacote sobe para fora da faixa, o teste falha e a faixa em src/doctor/ranges.ts é revista
  it.each(Object.entries(PRUMO_PACKAGE_RANGES))(
    'a versão do %s no workspace está dentro da faixa %s',
    (name, text) => {
      const version = parseVersion(workspaceManifest(name).version)
      const range = parseRange(text)
      expect(version && range && positionIn(version, range), `${name} em ${text}`).toBe('inside')
      expect(range && formatRange(range)).toBe(text)
    },
  )

  it('a versão que a CLI diz ter é a do package.json dela', () => {
    expect(realSystem().cliVersion).toBe(workspaceManifest(CLI_PACKAGE_NAME).version)
  })
})
