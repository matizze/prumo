#!/usr/bin/env node
// O cliente MCP do portão (`pnpm verify:new`): liga ao servidor prumo do app gerado do jeito que o
// agente liga (o comando do .mcp.json do app, por stdio, com o app como pasta de trabalho), confere as
// ferramentas e gera, só por elas, um domínio (schema e os cinco use cases do CRUD), mais dois use cases
// (uma leitura com a entidade como Output e uma escrita) e as telas (lista, detalhe, uma em subpasta e
// duas de use case, a lista e o formulário), confere os erros de uso e roda o check e o list. Sai com 0 se
// tudo deu certo e com 1 no primeiro erro. Não escreve nada: quem escreve é o servidor.
//
// O SDK do MCP vem do monorepo (devDependency da cli), não do app: o script resolve o cliente pela
// pasta dele, e não pela do app.
//
// Uso: node packages/cli/scripts/drive-mcp.mjs <pasta do app>
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

/** Chama uma ferramenta e mostra o texto dela; devolve o resultado e o texto. */
async function invoke(name, args) {
  const result = await client.callTool({ name, arguments: args })
  const text = (result.content ?? [])
    .map((block) => (block.type === 'text' ? block.text : `[${block.type}]`))
    .join('')
  console.log(`--> ${name} ${JSON.stringify(args)}\n${text.trimEnd()}`)
  return { result, text }
}

/** Chama uma ferramenta e falha se ela acusou erro. */
async function call(name, args) {
  const out = await invoke(name, args)
  if (out.result.isError) throw new Error(`a ferramenta ${name} falhou`)
  return out
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  await client.connect(transport)
  const { tools } = await client.listTools()
  const names = tools.map((tool) => tool.name).sort()
  const expected = ['check', 'list', 'make_page', 'make_schema', 'make_usecase']
  assert(
    JSON.stringify(names) === JSON.stringify(expected),
    `as ferramentas do servidor são ${names.join(', ')} (esperado: ${expected.join(', ')})`,
  )

  // Um domínio novo, camada por camada, e duas telas. O singular automático daria 'autore': o
  // entity exercita o parâmetro pelo MCP
  await call('make_schema', {
    dominio: 'autores',
    entity: 'autor',
    fields: 'nome:string,pais:string,nascimento:date,ativo:boolean,obras?:int',
  })
  await call('make_usecase', { nome: 'autores', entity: 'autor', crud: true })
  // Os use cases do domínio: uma leitura que devolve a lista de autores e uma escrita com campos
  await call('make_usecase', { nome: 'catalogo.get-autores', output: 'autor[]' })
  await call('make_usecase', {
    nome: 'catalogo/registrar-autor',
    input: 'nome:string,pais:string',
    output: 'id:string',
    endpoint: 'PUT /catalogo/autores',
  })
  const simulatedUseCase = await call('make_usecase', { nome: 'catalogo.get-obras', dry_run: true })
  assert(simulatedUseCase.text.includes('Simulação'), 'o dry_run do make_usecase não disse que simulou')
  // As telas de use case: a lista do que o catalogo.get-autores devolve e o formulário do registrar-autor
  const usecaseList = await call('make_page', { nome: 'catalogo-autores', usecase: 'catalogo.get-autores' })
  assert(usecaseList.text.includes('use case catalogo.get-autores, lista'), 'o make_page --usecase não disse que a tela é uma lista')
  await call('make_page', { nome: 'catalogo/registrar', usecase: 'catalogo.registrar-autor' })
  await call('make_page', { nome: 'autores', usecase: 'autores.list-autores' })
  await call('make_page', { nome: 'autor', usecase: 'autores.get-autor', path: '/autores/:id' })
  // Uma tela em subpasta, pelo nome com ponto: a rota, a pasta e o nome do list levam a barra
  await call('make_page', { nome: 'conta.perfil' })
  // Uma simulação: não escreve, e a tela não existe depois
  const dry = await call('make_page', { nome: 'simulada', dry_run: true })
  assert(dry.text.trim() !== '', 'o dry_run não disse o que faria')

  // Um erro de uso volta como erro da ferramenta, com a mensagem de uso (não um erro inesperado)
  const repeated = await invoke('make_usecase', { nome: 'outro.get-autores' })
  assert(
    repeated.result.isError === true && repeated.text.includes("a chave 'getAutores' do registro já é do use case"),
    'o make_usecase com uma chave repetida deveria voltar com isError e a mensagem da chave',
  )
  const missing = await invoke('make_page', { nome: 'editoras', usecase: 'editoras.list-editoras' })
  assert(missing.result.isError === true, 'make_page de um use case que não existe deveria voltar com isError')
  assert(
    missing.text.includes("o use case 'editoras.list-editoras' não existe") && !missing.text.includes('erro inesperado'),
    'o erro de uso não trouxe a mensagem esperada (o use case não existe)',
  )

  const checked = await call('check', {})
  assert(checked.text.includes('nenhuma violação'), 'o check não disse "nenhuma violação"')

  const listed = await call('list', {})
  const listing = JSON.parse(listed.text)

  // O schema tem os campos pedidos, com tipo e opcionalidade
  const schema = listing.schemas?.find((item) => item.file.endsWith('/autor.ts'))
  assert(schema, 'o list não mostra o schema autores')
  const got = (schema.fields ?? []).map((f) => `${f.name}:${f.type}${f.optional ? '?' : ''}`).join(',')
  const wanted = 'nome:string,pais:string,nascimento:date,ativo:boolean,obras:int?'
  assert(got === wanted, `os campos do schema autores são ${got} (esperado: ${wanted})`)

  const useCases = Object.fromEntries(
    (listing.useCases ?? []).map((u) => [`${u.domain}.${u.name}`, `${u.key} ${u.kind} ${u.endpoint}`]),
  )
  assert(
    useCases['catalogo.get-autores'] === 'getAutores read GET /catalogo/get-autores',
    `o use case catalogo.get-autores é ${useCases['catalogo.get-autores']}`,
  )
  assert(
    useCases['catalogo.registrar-autor'] === 'registrarAutor write PUT /catalogo/autores',
    `o use case catalogo.registrar-autor é ${useCases['catalogo.registrar-autor']}`,
  )
  assert(!('catalogo.get-obras' in useCases), 'o dry_run criou o use case get-obras')

  for (const key of ['listAutores', 'getAutor', 'createAutor', 'updateAutor', 'removeAutor']) {
    assert(
      Object.values(useCases).some((text) => text.startsWith(`${key} `)),
      `o list não mostra o use case ${key} do CRUD de autores`,
    )
  }
  assert(!('repositories' in listing) && !('queries' in listing), 'o list ainda traz repositórios ou queries')

  const pages = Object.fromEntries((listing.pages ?? []).map((p) => [p.name, p]))
  const summary = (p) => (p ? `${p.variation} ${p.route} useCase=${p.useCase}` : 'ausente')
  const list = pages.autores
  assert(
    list?.variation === 'list' && list.route === '/autores' && list.useCase === 'autores.list-autores',
    `a tela autores deveria ser lista em /autores do use case autores.list-autores (${summary(list)})`,
  )
  const detail = pages.autor
  assert(
    detail?.variation === 'detail' && detail.route === '/autores/:id' && detail.useCase === 'autores.get-autor',
    `a tela autor deveria ser detalhe em /autores/:id do use case autores.get-autor (${summary(detail)})`,
  )
  const nested = pages['conta/perfil']
  assert(
    nested?.variation === 'title' && nested.route === '/conta/perfil',
    `a tela conta/perfil deveria ser título em /conta/perfil (${summary(nested)})`,
  )
  const byUseCase = pages['catalogo-autores']
  assert(
    byUseCase?.variation === 'list' && byUseCase.useCase === 'catalogo.get-autores',
    `a tela catalogo-autores deveria ser lista do use case catalogo.get-autores (${summary(byUseCase)})`,
  )
  const form = pages['catalogo/registrar']
  assert(
    form?.variation === 'form' && form.route === '/catalogo/registrar' && form.useCase === 'catalogo.registrar-autor',
    `a tela catalogo/registrar deveria ser formulário do use case catalogo.registrar-autor (${summary(form)})`,
  )
  assert(!('simulada' in pages), 'o dry_run criou a tela simulada')
} catch (error) {
  console.error(`drive-mcp: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await client.close()
}
