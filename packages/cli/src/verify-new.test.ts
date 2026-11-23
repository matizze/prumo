import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * O portão local do app novo (`pnpm verify:new`) pesa e roda fora do verify da raiz (que roda os
 * testes dos pacotes), então o teste confere só a estrutura do script: as etapas, o trap que apaga a
 * pasta temporária e a regra de que o script não escreve no app, só a CLI e o MCP.
 */
const REPO = path.resolve(import.meta.dirname, '../../..')
const script = readFileSync(path.join(REPO, 'scripts', 'verify-new.sh'), 'utf8')
const driver = readFileSync(path.join(REPO, 'packages/mcp/scripts/drive-mcp.mjs'), 'utf8')

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

  it('gera pela CLI um domínio, uma tela com --domain e um componente', () => {
    expect(code).toContain('prumo make:domain clientes')
    expect(code).toContain('prumo make:page clientes --domain clientes')
    expect(code).toContain('prumo make:page cliente --domain clientes --path /clientes/:id')
    expect(code).toContain('prumo make:component resumo --page clientes')
    expect(code).toContain('prumo move:component resumo --from clientes --shared --dry-run')
    expect(code).toContain('prumo make:domain livros --fields "titulo:string')
    expect(code).toContain('prumo make:page livros --domain livros')
    expect(code).toContain('prumo make:page livro --domain livros --path /livros/:id')
  })

  it('gera o resto por um cliente MCP, com uma tela de rota com parâmetro', () => {
    expect(driver).toContain("path: '/fornecedores/:codigo'")
    expect(driver).toContain('fields:')
    expect(code).toContain('packages/mcp/scripts/drive-mcp.mjs')
    expect(driver).toContain('StdioClientTransport')
    for (const tool of ['make_domain', 'make_page', 'make_component', 'move_component', 'check']) {
      expect(driver).toContain(`'${tool}'`)
    }
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
      // Só lê o app (cd) ou o passa como argumento à CLI e ao cliente MCP
      expect(line, line).not.toMatch(/>>?\s*"?\$APP/)
      expect(line, line).not.toMatch(/\b(sed -i|tee|cp|mv|rm|touch|mkdir|ln)\b/)
    }
    expect(code).not.toMatch(/>>?\s*"?\$\{?APP/)
    expect(code).not.toMatch(/\bsed -i\b/)
    // O que o cliente MCP faz também: só chama ferramentas, sem escrever arquivo
    expect(driver).not.toMatch(/writeFile|appendFile|rmSync|mkdirSync|copyFile|rename/)
  })

  it('não usa o navegador nem o GitHub', () => {
    expect(code).not.toMatch(/playwright|chromium|storybook|\bgh\b|git push/i)
  })
})
