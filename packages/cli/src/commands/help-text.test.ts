import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { run } from '../program.ts'
import { captureIo } from '../test/run.ts'
import { MCP_JSON } from './mcp.ts'

async function help(argv: string[], columns?: number): Promise<{ code: number; out: string; err: string }> {
  const { io, stdout, stderr } = captureIo('/tmp', { columns })
  const code = await run(argv, io)
  return { code, out: stdout(), err: stderr() }
}

const ANCHORS: Record<string, string> = {
  new: 'prumo-new',
  'make:schema': 'prumo-makeschema',
  'make:page': 'prumo-makepage',
  check: 'prumo-check',
  list: 'prumo-list',
  mcp: 'prumo-mcp',
}

/** Os ids que o Docusaurus gera para os títulos de `docs/reference/cli.md` (o slug do github-slugger). */
function headingIds(): Set<string> {
  const markdown = readFileSync(new URL('../../../../docs/reference/cli.md', import.meta.url), 'utf8')
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '')
  const titles = [...withoutCode.matchAll(/^#{2,4} (.+)$/gm)].map((match) => match[1] ?? '')
  return new Set(
    titles.map((title) =>
      title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s/g, '-'),
    ),
  )
}

describe('a ajuda dos comandos', () => {
  it.each(Object.entries(ANCHORS))('%s: descrição curta, exemplos e a referência', async (name, anchor) => {
    const { code, out, err } = await help([name, '--help'])
    expect(code).toBe(0)
    expect(err).toBe('')
    const examples = out.split('Exemplos:\n')[1]?.split('\n\n')[0]?.split('\n') ?? []
    expect(examples.length, out).toBeGreaterThanOrEqual(1)
    expect(examples.length, out).toBeLessThanOrEqual(4)
    for (const line of examples) expect(line).toMatch(/^ {2}(prumo|pnpm exec prumo|claude mcp add prumo -- pnpm exec prumo) /)
    // Sem linha em branco no fim: o texto do commander já termina com a quebra de linha
    const lines = out.split('\n')
    expect(lines.at(-1)).toBe('')
    expect(lines.at(-2)).toBe(`Referência: https://docs.prumo.matizze.com.br/reference/cli#${anchor}`)
    expect(lines.length, out).toBeLessThan(40)
  })

  it('cada âncora é o id de um título de docs/reference/cli.md', () => {
    const ids = headingIds()
    for (const anchor of Object.values(ANCHORS)) expect(ids, anchor).toContain(anchor)
    expect(ids).toContain('a-busca-do-projeto')
  })

  it('a raiz termina com o link do site, sem linha em branco', async () => {
    const { out } = await help(['--help'])
    expect(out.endsWith('\nDocumentação: https://docs.prumo.matizze.com.br/reference/cli\n')).toBe(true)
  })
})

describe('prumo help', () => {
  it('help make:page mostra a ajuda do comando, com saída 0', async () => {
    const viaHelp = await help(['help', 'make:page'])
    expect(viaHelp.code).toBe(0)
    expect(viaHelp.out).toContain('Uso: prumo make:page [opções] <nome>')
    expect(viaHelp).toEqual(await help(['make:page', '--help']))
  })

  it('help nada e help make:pag saem com 2 e a mensagem, sem a ajuda da raiz', async () => {
    const nada = await help(['help', 'nada'])
    expect(nada).toEqual({
      code: 2,
      out: '',
      err: "prumo: comando desconhecido: 'nada'.\n\nUso: prumo [opções] [comando]\nVeja 'prumo --help'.\n",
    })
    const typo = await help(['help', 'make:pag'])
    expect(typo.code).toBe(2)
    expect(typo.err).toContain("prumo: comando desconhecido: 'make:pag'. Você quis dizer make:page?")
    expect(typo.err).toContain("Veja 'prumo --help'.")
  })
})

describe('prumo new --packages', () => {
  it('não aparece na ajuda', async () => {
    const { out } = await help(['new', '--help'])
    expect(out).not.toContain('--packages')
  })
})

describe('prumo mcp --help', () => {
  it.each([20, 40, 80, 200])('com %i colunas, o trecho do .mcp.json sai inteiro', async (columns) => {
    const { out } = await help(['mcp', '--help'], columns)
    expect(out).toContain(`${MCP_JSON}\n`)
  })

  it('o trecho é um .mcp.json válido', () => {
    expect(JSON.parse(MCP_JSON)).toEqual({
      mcpServers: { prumo: { command: 'pnpm', args: ['exec', 'prumo', 'mcp'] } },
    })
  })
})
