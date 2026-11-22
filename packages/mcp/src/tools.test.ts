import { describe, expect, it } from 'vitest'
import { createServer } from './server.ts'
import { makeProject, textOf } from './test-support.ts'

/** As ferramentas chamadas direto, sem passar pelo esquema do SDK: o que o handler faz sozinho. */
async function toolsOfProject() {
  const { tools } = await createServer({ cwd: makeProject() })
  const tool = (name: string) => {
    const found = tools.find((candidate) => candidate.name === name)
    if (!found) throw new Error(`sem a ferramenta ${name}`)
    return found
  }
  return { tool }
}

describe('toolsOf', () => {
  it('um valor de outro tipo, que o toArgv recusa, vira isError com a mensagem e [saída 2], sem rodar nada', async () => {
    const { tool } = await toolsOfProject()
    const result = await tool('check').call({ root: 1 })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe("'root' precisa ser um texto.\n[saída 2]")
  })

  it('um campo que o comando não tem é recusado com a lista dos que ele tem', async () => {
    const { tool } = await toolsOfProject()
    const result = await tool('check').call({ pasta: 'x' })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain("o comando 'check' não tem o campo 'pasta' (campos: root)")
  })

  it('o texto é o stdout e depois o stderr, sem moldura; o código só aparece se não é 0', async () => {
    const { tool } = await toolsOfProject()

    const ok = await tool('check').call({})
    expect(ok.isError).toBe(false)
    expect(textOf(ok)).toBe('prumo check: nenhuma violação.\n')

    const bad = await tool('check').call({ root: 'nao-existe' })
    expect(bad.isError).toBe(true)
    expect(textOf(bad)).toMatch(/^prumo check: a pasta .* não existe\./)
    expect(textOf(bad)).toMatch(/\[saída 2\]$/)
  })

  it('o nome, a descrição e o esquema vêm do comando', async () => {
    const { tool } = await toolsOfProject()
    const check = tool('check')

    expect(check.name).toBe(check.command.toolName)
    expect(check.description).toBe(check.command.description)
    expect(Object.keys(check.inputSchema.shape)).toEqual(
      check.command.options.map((option) => option.name),
    )
  })
})
