import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * O portão local do app novo (`pnpm verify:new`) pesa e roda fora do verify da raiz (que roda os
 * testes dos pacotes), então o teste confere só a estrutura do script: as etapas, o trap que apaga a
 * pasta temporária e a regra de que o script não escreve no app, só a CLI.
 */
const REPO = path.resolve(import.meta.dirname, '../../..')
const script = readFileSync(path.join(REPO, 'scripts', 'verify-new.sh'), 'utf8')

/** O script sem as linhas de comentário, para os testes olharem só o que roda. */
const code = script
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n')

describe('scripts/verify-new.sh', () => {
  it('é executável e está ligado ao pnpm verify:new', () => {
    expect(statSync(path.join(REPO, 'scripts', 'verify-new.sh')).mode & 0o111).not.toBe(0)
    const manifest = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(manifest.scripts['verify:new']).toBe('scripts/verify-new.sh')
  })

  it('para no primeiro erro', () => {
    expect(code).toContain('set -euo pipefail')
  })

  it('roda as etapas na ordem: pack, new, cli, mcp e verify', () => {
    const order = ['pack', 'new', 'cli', 'mcp', 'verify'].map((name) =>
      code.indexOf(`step ${name} stage_${name}`),
    )
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('empacota, cria o app fora do monorepo com os tarballs e roda o verify dele', () => {
    expect(code).toContain('pack:all "$WORK/packs"')
    expect(code).toMatch(/mktemp -d "\$\{TMPDIR:-\/tmp\}\//)
    expect(code).toContain('new portao --dir "$WORK" --packages "$WORK/packs"')
    expect(code).toContain('pnpm verify')
  })

  it('tem a etapa cli com o lugar onde os passos seguintes acrescentam os comandos', () => {
    expect(script).toContain('stage_cli() {')
    for (const command of ['make:schema', 'make:repository', 'make:query', 'make:page']) {
      expect(script).toContain(command)
    }
  })

  it('a etapa mcp roda o cliente roteirizado contra o app, que usa o .mcp.json do new', () => {
    expect(code).toContain('stage_mcp() {')
    expect(code).toContain('node "$ROOT/packages/cli/scripts/drive-mcp.mjs" "$APP"')
    const driver = readFileSync(path.join(REPO, 'packages/cli/scripts/drive-mcp.mjs'), 'utf8')
    expect(driver).toContain(".mcp.json")
    expect(driver).toContain('StdioClientTransport')
    for (const tool of ['make_schema', 'make_repository', 'make_query', 'make_page', 'check', 'list']) {
      expect(driver).toContain(tool)
    }
    expect(driver).toContain('dry_run')
    expect(driver).toContain('isError')
  })

  it('apaga a pasta temporária num trap de EXIT, também em caso de falha', () => {
    expect(code).toMatch(/trap cleanup EXIT/)
    expect(code).toMatch(/cleanup\(\) \{[\s\S]*rm -rf "\$WORK"[\s\S]*\}/)
    // O trap vem antes de a pasta existir: não há janela em que ela fique sem quem a apague
    expect(code.indexOf('trap cleanup EXIT')).toBeLessThan(code.indexOf('mktemp -d'))
  })

  it('não escreve no app: nenhum redirecionamento, edição no lugar nem cópia para ele', () => {
    const lines = code.split('\n')
    for (const line of lines) {
      if (!line.includes('$APP')) continue
      // Só lê o app (cd) ou o passa como argumento à CLI
      expect(line, line).not.toMatch(/>>?\s*"?\$APP/)
      expect(line, line).not.toMatch(/\b(sed -i|tee|cp|mv|rm|touch|mkdir|ln)\b/)
    }
    expect(code).not.toMatch(/>>?\s*"?\$\{?APP/)
    expect(code).not.toMatch(/\bsed -i\b/)
  })

  it('não usa o navegador nem o GitHub', () => {
    expect(code).not.toMatch(/playwright|chromium|storybook|\bgh\b|git push/i)
  })
})
