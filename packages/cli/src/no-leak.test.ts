import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A regra do servidor MCP: nada do cli escreve no stdout ou no stderr do processo fora do
 * `Runtime`. Num servidor MCP o stdout é o protocolo, e uma linha solta o corrompe. Os dois lugares
 * que pode tocar no terminal é o `bin.ts`, que monta o Runtime com ele.
 */
const SRC = import.meta.dirname
const ALLOWED = new Set(['bin.ts'])

/** Os arquivos de código do cli: tudo em `src`, menos testes e apoio de teste. */
function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(file)
    const isCode = entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')
    const isTest = /\.test\.tsx?$/.test(entry.name) || /test-support\.ts$/.test(entry.name)
    return isCode && !isTest ? [file] : []
  })
}

/** As linhas de código: sem as de comentário (`//`, `/*`, `*`), que podem citar o que a regra proíbe. */
function codeLines(text: string): Array<[number, string]> {
  return text
    .split('\n')
    .map((line, at): [number, string] => [at + 1, line])
    .filter(([, line]) => !/^\s*(\/\/|\/\*|\*)/.test(line))
}

const FORBIDDEN: Array<[string, RegExp]> = [
  ["stdio: 'inherit'", /stdio\s*:\s*['"`]inherit['"`]/],
  ["'inherit' num stdio em lista", /['"`]inherit['"`]/],
  ['process.stdout', /\bprocess\.stdout\b/],
  ['process.stderr', /\bprocess\.stderr\b/],
  ['console.', /\bconsole\./],
]

describe('o cli não escreve fora do Runtime', () => {
  const files = sourceFiles()
  const relative = (file: string) => path.relative(SRC, file).split(path.sep).join('/')

  it('o teste enxerga o código do cli (a lista de arquivos não está vazia por engano)', () => {
    const names = files.map(relative)
    expect(names).toEqual(expect.arrayContaining(['bin.ts', 'commands/check.ts', 'run.ts']))
    expect(names.filter((name) => name.endsWith('.test.ts'))).toEqual([])
    expect(files.length).toBeGreaterThan(15)
  })

  it.each(FORBIDDEN)('nenhum arquivo, fora do bin, usa %s', (label, pattern) => {
    const found = files
      .filter((file) => !ALLOWED.has(relative(file)))
      .flatMap((file) =>
        codeLines(readFileSync(file, 'utf8'))
          .filter(([, line]) => pattern.test(line))
          .map(([at, line]) => `${relative(file)}:${at}: ${line.trim()} (${label})`),
      )

    expect(found, found.join('\n')).toEqual([])
  })

  it('o bin é o único que toca no terminal: a escrita dele é o que os comandos chamam', () => {
    const bin = readFileSync(path.join(SRC, 'bin.ts'), 'utf8')
    expect(bin).toContain('out: (text: string) => process.stdout.write(text)')
    expect(bin).toContain('err: (text: string) => process.stderr.write(text)')
  })

  it('o detector acusa o que a regra proíbe (guarda contra uma regex que não casa nada)', () => {
    const offending = [
      "spawnSync('pnpm', ['install'], { stdio: 'inherit' })",
      "spawn('x', [], { stdio: [0, 'inherit', 2] })",
      'process.stdout.write(text)',
      'process.stderr.write(text)',
      "console.log('x')",
    ]
    for (const line of offending) {
      expect(
        FORBIDDEN.some(([, pattern]) => pattern.test(line)),
        line,
      ).toBe(true)
    }
    expect(codeLines('// process.stdout.write\n * console.log\nconst a = 1')).toEqual([
      [3, 'const a = 1'],
    ])
  })
})
