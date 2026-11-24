import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * O portão local do app novo (`pnpm verify:new`) pesa e roda fora do verify da raiz, e o próprio
 * `pnpm verify:new` executa os comandos que o script traz. Aqui fica só a ligação entre o script e
 * o resto do repositório: o script do `package.json`, o arquivo executável e o cliente MCP que ele roda.
 */
const REPO = path.resolve(import.meta.dirname, '../../..')
const SCRIPT = path.join(REPO, 'scripts', 'verify-new.sh')

describe('scripts/verify-new.sh', () => {
  it('o package.json da raiz aponta o verify:new para o script', () => {
    const manifest = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(manifest.scripts['verify:new']).toBe('scripts/verify-new.sh')
  })

  it('o script existe e é executável', () => {
    expect(statSync(SCRIPT).mode & 0o111).not.toBe(0)
  })

  it('o cliente MCP que a etapa mcp roda existe', () => {
    expect(statSync(path.join(REPO, 'packages/cli/scripts/drive-mcp.mjs')).isFile()).toBe(true)
  })
})
