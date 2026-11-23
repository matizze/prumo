#!/usr/bin/env node
// O cliente MCP do portão (`pnpm verify:new`): liga ao servidor prumo do app gerado do jeito que o
// agente liga (o comando do .mcp.json do app, por stdio, com o app como pasta de trabalho), confere as
// ferramentas e gera, só por elas, um domínio, uma tela com --domain e um componente, e roda o check.
// Sai com 0 se tudo deu certo e com 1 no primeiro erro. Não escreve nada: quem escreve é o servidor.
//
// Uso: node packages/mcp/scripts/drive-mcp.mjs <pasta do app>
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const appDir = process.argv[2]
if (!appDir) {
  console.error('uso: drive-mcp.mjs <pasta do app>')
  process.exit(2)
}
const app = path.resolve(appDir)

// O servidor que o app declara, o mesmo que um agente abriria
const config = JSON.parse(readFileSync(path.join(app, '.mcp.json'), 'utf8'))
const server = config.mcpServers?.prumo
if (!server?.command) {
  console.error(`o .mcp.json de ${app} não declara o servidor 'prumo'.`)
  process.exit(1)
}

const client = new Client({ name: 'verify-new', version: '0.0.0' })
const transport = new StdioClientTransport({
  command: server.command,
  args: server.args ?? [],
  cwd: app,
  stderr: 'inherit',
})

/** Chama uma ferramenta, mostra o texto dela e falha se ela acusou erro. */
async function call(name, args) {
  const result = await client.callTool({ name, arguments: args })
  const text = (result.content ?? [])
    .map((block) => (block.type === 'text' ? block.text : `[${block.type}]`))
    .join('')
  console.log(`--> ${name} ${JSON.stringify(args)}\n${text.trimEnd()}`)
  if (result.isError) throw new Error(`a ferramenta ${name} falhou`)
}

try {
  await client.connect(transport)
  const { tools } = await client.listTools()
  const names = tools.map((tool) => tool.name)
  for (const expected of ['make_page', 'make_domain', 'make_component', 'check']) {
    if (!names.includes(expected)) {
      throw new Error(`o servidor não expõe a ferramenta ${expected} (expõe: ${names.join(', ')})`)
    }
  }
  await call('make_domain', {
    nome: 'fornecedores',
    fields: 'razaoSocial:string,cnpj:string,ativo:boolean,desde:date,nota?:number',
  })
  await call('make_page', { nome: 'fornecedores', domain: 'fornecedores' })
  await call('make_page', { nome: 'ficha', path: '/fornecedores/:codigo' })
  await call('make_component', { nome: 'detalhe', page: 'fornecedores' })
  await call('check', {})
} catch (error) {
  console.error(`drive-mcp: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await client.close()
}
