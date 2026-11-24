import { describe, expect, it } from 'vitest'
import type { Io } from '../io.ts'
import { run } from '../program.ts'
import { MCP_JSON } from './mcp.ts'

async function help(argv: string[], columns?: number): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const io: Io = { cwd: '/tmp', columns, out: (t) => void (out += t), err: (t) => void (err += t) }
  const code = await run(argv, io)
  return { code, out, err }
}

const ANCHORS: Record<string, string> = {
  new: 'prumo-new',
  'make:schema': 'prumo-makeschema',
  'make:repository': 'prumo-makerepository',
  'make:query': 'prumo-makequery',
  'make:page': 'prumo-makepage',
  check: 'prumo-check',
  list: 'prumo-list',
  mcp: 'prumo-mcp',
}

describe('a ajuda dos comandos', () => {
  it.each(Object.entries(ANCHORS))('%s: descrição curta, exemplos e a referência', async (name, anchor) => {
    const { code, out, err } = await help([name, '--help'])
    expect(code).toBe(0)
    expect(err).toBe('')
    const examples = out.split('Exemplos:\n')[1]?.split('\n\n')[0]?.split('\n') ?? []
    expect(examples.length, out).toBeGreaterThanOrEqual(2)
    expect(examples.length, out).toBeLessThanOrEqual(4)
    for (const line of examples) expect(line).toMatch(/^ {2}(pnpm exec )?prumo /)
    expect(out.trimEnd().split('\n').at(-1)).toBe(
      `Referência: https://docs.prumo.matizze.com.br/reference/cli#${anchor}`,
    )
    expect(out.split('\n').length, out).toBeLessThan(40)
  })

  it('a raiz termina com o link do site', async () => {
    const { out } = await help(['--help'])
    expect(out.trimEnd().split('\n').at(-1)).toBe('Documentação: https://docs.prumo.matizze.com.br/reference/cli')
  })
})

describe('prumo new --packages', () => {
  it('não aparece na ajuda', async () => {
    const { out } = await help(['new', '--help'])
    expect(out).not.toContain('--packages')
  })
})

describe('prumo mcp --help', () => {
  it.each([20, 40, 80, 200])('com %i colunas, o trecho do .mcp.json sai inteiro e é JSON válido', async (columns) => {
    const { out } = await help(['mcp', '--help'], columns)
    expect(out).toContain(`${MCP_JSON}\n`)
    expect(JSON.parse(MCP_JSON)).toEqual({
      mcpServers: { prumo: { command: 'pnpm', args: ['exec', 'prumo', 'mcp'] } },
    })
  })
})
