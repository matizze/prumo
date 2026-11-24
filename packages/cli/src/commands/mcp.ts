import path from 'node:path'
import { UsageError } from '../errors.ts'
import { findProject } from '../lib/project.ts'
import { readVersion } from '../lib/version.ts'
import type { RegisterCommand } from './index.ts'

/**
 * `prumo mcp`: o servidor MCP, por stdio. Confere que a pasta é um projeto (saída 2 se não for) e só
 * então carrega o SDK, por `import()`: quem roda os outros comandos não paga por ele. Com o servidor no
 * ar, o stdout é do protocolo, então o `console.log` vai para o stderr.
 */
export const registerMcp: RegisterCommand = (program, io) => {
  program
    .command('mcp')
    .summary('Abre o servidor MCP do projeto, por stdio.')
    .description(
      `Abre o servidor MCP do projeto, por stdio, para um agente de IA usar o Prumo.

O servidor tem uma ferramenta por comando (make_schema, make_repository, make_query, make_page, check e list), com os mesmos parâmetros do comando, e roda no projeto da pasta onde abriu (ou da --root): nenhuma ferramenta escreve fora dele. O stdout é o protocolo e só termina quando o cliente fecha: ligue-o ao agente pelo .mcp.json do projeto, não o rode à mão.

Para colar no .mcp.json de um projeto que não saiu do prumo new:

  { "mcpServers": { "prumo": { "command": "pnpm", "args": ["exec", "prumo", "mcp"] } } }

Sai com 2 quando a pasta não é um projeto (sem package.json e src).`,
    )
    .option('--root <pasta>', 'A pasta do projeto, a que tem o src.', '.')
    .action(async (options: { root: string }) => {
      if (options.root === '') throw new UsageError("a opção '--root' precisa de um valor.")
      const project = findProject(path.resolve(io.cwd, options.root))
      // O stdout é do protocolo: o que mais escrevesse no console o corromperia
      console.log = console.error
      console.info = console.error
      console.debug = console.error
      const { serve } = await import('../mcp/stdio.ts')
      await serve({ root: project.root, version: readVersion() })
    })
}
