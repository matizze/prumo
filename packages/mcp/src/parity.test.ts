import { describeCommands, runInProcess } from '@matizze/prumo-cli/api'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createServer } from './server.ts'
import { makeDir } from './test-support.ts'

/**
 * O oráculo da paridade não é o código do servidor nem o `describeCommands`, de que ele se serve:
 * é a ajuda do `prumo`, o texto que `runCli` escreve ("Comandos:", "Argumentos:", "Opções:" e a
 * linha "Uso:"). Se o servidor e o `describeCommands` errassem juntos, a ajuda os desmentiria.
 */
const cwd = makeDir()

async function helpOf(args: string[]): Promise<string> {
  const result = await runInProcess(args, { cwd })
  expect(result.exitCode, result.stderr).toBe(0)
  return result.stdout
}

/** As linhas de uma seção da ajuda (`Opções:`), até a linha em branco. */
function section(help: string, title: string): string[] {
  const lines = help.split('\n')
  const start = lines.indexOf(`${title}:`)
  if (start === -1) return []
  const end = lines.findIndex((line, at) => at > start && line === '')
  return lines.slice(start + 1, end === -1 ? undefined : end)
}

/** A primeira coluna de cada linha da seção (as colunas se separam por dois espaços ou mais). */
const labelsOf = (lines: string[]) => lines.map((line) => line.trim().split(/\s{2,}/)[0] ?? '')

/** O nome do campo de uma opção da ajuda: `--root <pasta>` é `root`, e `--no-install` é `install`. */
function fieldOfFlag(label: string): string {
  const flag = /--([a-z0-9-]+)/.exec(label)?.[1] ?? ''
  return flag.startsWith('no-') ? flag.slice(3) : flag
}

interface Documented {
  /** Os campos da ajuda, na ordem: os argumentos e as opções, sem o `-h, --help`. */
  fields: string[]
  /** Os campos que a sintaxe da linha "Uso:" dá como obrigatórios (sem colchetes). */
  required: string[]
}

async function documentedCommand(name: string): Promise<Documented> {
  const help = await helpOf([name, '--help'])
  const positionals = labelsOf(section(help, 'Argumentos')).map((label) =>
    label.replace(/\.\.\.$/, ''),
  )
  const options = labelsOf(section(help, 'Opções'))
    .filter((label) => label !== '-h, --help')
    .map(fieldOfFlag)

  // A sintaxe: `<nome>` e `<item>...` são posicionais obrigatórios, `[...]` é opcional, e uma opção
  // fora de colchetes (`--from <tela>`) é obrigatória
  const usage = (help.split('\n')[0] ?? '').replace(/^Uso: \S+ \S+ ?/, '')
  const required: string[] = []
  for (const token of usage.match(/\[[^\]]*\]|\S+(?: <[^>]*>)?/g) ?? []) {
    if (token.startsWith('[')) continue
    const positional = /^<([^>]+)>(\.\.\.)?$/.exec(token)
    if (positional) required.push(positional[1] ?? '')
    else if (token.startsWith('--')) required.push(fieldOfFlag(token))
  }
  return { fields: [...positionals, ...options], required }
}

describe('paridade das ferramentas com a ajuda do prumo', async () => {
  const documented = labelsOf(section(await helpOf([]), 'Comandos'))
  const { tools } = await createServer({ cwd })

  it('a ajuda lista os comandos que o teste espera (o oráculo não está vazio por engano)', () => {
    expect(documented).toEqual(['check', 'doctor'])
  })

  it('o conjunto de ferramentas é o de comandos da ajuda, nem mais nem menos', () => {
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      documented.map((name) => name.replace(/:/g, '_')).sort(),
    )
  })

  it('o nome de cada ferramenta é o do comando com ":" trocado por "_", e a descrição é a da ajuda', async () => {
    for (const tool of tools) {
      expect(tool.name).toBe(tool.command.name.replace(/:/g, '_'))
      expect(await helpOf([tool.command.name, '--help'])).toContain(tool.description)
    }
  })

  it.each(documented)('o comando %s: os campos da ferramenta são os da ajuda', async (command) => {
    const tool = tools.find((candidate) => candidate.command.name === command)
    expect(tool, `o comando '${command}' não tem ferramenta`).toBeDefined()
    const { fields, required } = await documentedCommand(command)

    const json = z.toJSONSchema(tool!.inputSchema) as {
      properties: Record<string, unknown>
      required?: string[]
    }
    expect(Object.keys(json.properties)).toEqual(fields)
    expect([...(json.required ?? [])].sort()).toEqual([...required].sort())
  })

  it('um comando novo na árvore vira ferramenta sem mudar o servidor', async () => {
    // Uma árvore de mentira, só com o que o describeCommands lê (meta, args e subCommands)
    const tree = {
      meta: { name: 'prumo' },
      subCommands: {
        'make:widget': {
          meta: { description: 'Gera um widget.\n\nCom mais detalhes.' },
          args: {
            nome: { type: 'positional', required: true, description: 'O nome.' },
            tamanho: { type: 'enum', options: ['p', 'g'], description: 'O tamanho.' },
            'dry-run': { type: 'boolean', description: 'Simula.' },
          },
        },
        escondido: { meta: { description: 'Não aparece.', hidden: true } },
      },
    }
    const commands = await describeCommands(tree as never)
    const { tools: injected } = await createServer({ cwd, commands })

    expect(injected.map((tool) => tool.name)).toEqual(['make_widget'])
    expect(injected[0]?.description).toBe('Gera um widget.\n\nCom mais detalhes.')
    expect(Object.keys(injected[0]!.inputSchema.shape)).toEqual(['nome', 'tamanho', 'dry-run'])
  })
})
