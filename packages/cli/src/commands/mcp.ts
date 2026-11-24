import { readVersion } from '../lib/version.ts'
import { locateProject } from '../lib/project.ts'
import { documentCommand } from './help-text.ts'
import { ROOT_OPTION } from './shared.ts'
import type { RegisterCommand } from './index.ts'

/** O trecho do `.mcp.json` que registra o servidor; sai da ajuda inteiro, para copiar. */
export const MCP_JSON = '  { "mcpServers": { "prumo": { "command": "pnpm", "args": ["exec", "prumo", "mcp"] } } }'

/**
 * `prumo mcp`: o servidor MCP, por stdio. Confere que a pasta é um projeto (saída 2 se não for) e só
 * então carrega o SDK, por `import()`: quem roda os outros comandos não paga por ele. Com o servidor no
 * ar, o stdout é do protocolo, então o `console.log` vai para o stderr.
 */
export const registerMcp: RegisterCommand = (program, io) => {
  const command = program
    .command('mcp')
    .summary('Abre o servidor MCP do projeto, por stdio.')
    .description(
      'Abre o servidor MCP do projeto, por stdio, para um agente de IA usar o Prumo.\n\nÉ o agente que o abre, pelo .mcp.json do projeto: não o rode à mão.',
    )
    .option(...ROOT_OPTION)
    .action(async (options: { root?: string }) => {
      const project = locateProject(io.cwd, options.root)
      // O stdout é do protocolo: o que mais escrevesse no console o corromperia
      console.log = console.error
      console.info = console.error
      console.debug = console.error
      const { serve } = await import('../mcp/stdio.ts')
      await serve({ root: project.root, version: readVersion() })
    })
  documentCommand(command, {
    examples: ['claude mcp add prumo -- pnpm exec prumo mcp'],
    anchor: 'prumo-mcp',
    notes: `Para colar no .mcp.json de um projeto que não saiu do prumo new:\n\n${MCP_JSON}`,
  })
}
