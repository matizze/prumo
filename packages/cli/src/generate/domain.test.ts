import { readFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { findProject } from '../project.ts'
import { fixtureProject } from '../codemod/test-support.ts'
import { makeProject } from '../test-support.ts'
import { generateDomain, queriesExports } from './domain.ts'

/** O texto de um arquivo do plano (novo ou de costura), pelo caminho relativo à raiz. */
function textOf(plan: ReturnType<typeof generateDomain>['plan'], file: string): string {
  const full = path.join(plan.project.root, file)
  return plan.source(full).getFullText()
}

describe('generateDomain', () => {
  it('lista os sete arquivos novos e as três costuras', () => {
    const { plan, names } = generateDomain(fixtureProject(), { name: 'clientes' })

    expect(names.plural.kebab).toBe('clientes')
    expect(names.singular.kebab).toBe('cliente')
    expect(plan.summary()).toEqual({
      created: [
        'src/queries/clientes.ts',
        'src/repositories/clientes/fixtures.ts',
        'src/repositories/clientes/index.ts',
        'src/repositories/clientes/repository.contract.test.ts',
        'src/repositories/clientes/repository.contract.ts',
        'src/repositories/clientes/repository.mock.ts',
        'src/schemas/entities/cliente.ts',
      ],
      modified: ['src/queries/index.ts', 'src/repositories/index.ts', 'src/schemas/index.ts'],
    })
  })

  it('não escreve nada: só o commit grava', () => {
    const project = fixtureProject()
    const before = readFileSync(path.join(project.src, 'schemas', 'index.ts'), 'utf8')

    generateDomain(project, { name: 'clientes' })

    expect(readFileSync(path.join(project.src, 'schemas', 'index.ts'), 'utf8')).toBe(before)
  })

  it('o schema tem id, name e createdAt, o tipo, a entrada de formulário e a consulta da lista', () => {
    const { plan } = generateDomain(fixtureProject(), { name: 'clientes' })

    expect(textOf(plan, 'src/schemas/entities/cliente.ts')).toBe(`import { z } from 'zod'
import type { PageQuery, Sort } from '@matizze/prumo-core/data'

export const clienteSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
})

export type ClienteSchema = z.infer<typeof clienteSchema>

/** O que se envia para criar ou editar: o \`id\` e a data são do repositório. */
export const clienteInputSchema = clienteSchema.pick({ name: true })

export type ClienteInput = z.infer<typeof clienteInputSchema>

export type ClienteSortKey = 'name' | 'createdAt'

export interface ClienteListQuery extends PageQuery {
  /** Busca pelo nome, sem diferenciar maiúsculas e acentos. */
  search?: string
  sort?: Sort<ClienteSortKey>
}
`)
  })

  it('o repositório tem contrato, mock com a latência do core, fixtures, index e teste de contrato', () => {
    const { plan } = generateDomain(fixtureProject(), { name: 'clientes' })

    expect(textOf(plan, 'src/repositories/clientes/repository.contract.ts')).toContain(
      'export interface IClientesRepository {',
    )
    for (const method of ['list(', 'get(', 'create(', 'update(', 'remove(']) {
      expect(textOf(plan, 'src/repositories/clientes/repository.contract.ts')).toContain(
        `  ${method}`,
      )
    }

    const mock = textOf(plan, 'src/repositories/clientes/repository.mock.ts')
    expect(mock).toContain(
      "import { matchesSearch, paginate, sortBy, wait } from '@matizze/prumo-core/mock'",
    )
    expect(mock).toContain("import { UIError } from '@matizze/prumo-core/errors'")
    expect(mock).toContain('export class MockClientesRepository implements IClientesRepository {')
    expect(mock).toContain('constructor({ latencyMs = 300 }: MockClientesRepositoryOptions = {})')
    expect(mock).toContain("new UIError('CLIENTE_NOT_FOUND', 'Registro não encontrado.')")

    expect(textOf(plan, 'src/repositories/clientes/fixtures.ts')).toContain(
      "export const MOCK_CLIENTES: ClienteSchema[] = [\n  { id: 'cliente-1', name: 'Exemplo 1'",
    )

    expect(textOf(plan, 'src/repositories/clientes/index.ts'))
      .toBe(`import type { RepositoryOptions } from '../options'
import type { IClientesRepository } from './repository.contract'
import { MockClientesRepository } from './repository.mock'

export type { IClientesRepository } from './repository.contract'
export { MockClientesRepository, type MockClientesRepositoryOptions } from './repository.mock'
export { MOCK_CLIENTES } from './fixtures'

export function createClientesRepository({ latencyMs }: RepositoryOptions): IClientesRepository {
  // Só mock por enquanto; a implementação real (API) entra aqui
  return new MockClientesRepository({ latencyMs })
}
`)

    const contract = textOf(plan, 'src/repositories/clientes/repository.contract.test.ts')
    expect(contract).toContain(
      "import { defineContractSuite, runContractSuite } from '@matizze/prumo-testing/contract'",
    )
    expect(contract).toContain('const clientesContract = defineContractSuite<IClientesRepository>(')
    expect(contract).toContain('runContractSuite(clientesContract, {')
    expect(contract).toContain('create: () => new MockClientesRepository({ latencyMs: 0 }),')
  })

  it('as queries têm as keys do core, as queries e os hooks de lista, detalhe e mutations', () => {
    const { plan } = generateDomain(fixtureProject(), { name: 'clientes' })
    const queries = textOf(plan, 'src/queries/clientes.ts')

    expect(queries).toContain("import { createQueryKeys } from '@matizze/prumo-core/query'")
    expect(queries).toContain("export const clienteKeys = createQueryKeys('clientes', {")
    expect(queries).toContain('export const clienteQueries = {')
    for (const hook of [
      'useClientesList(',
      'useClienteDetail(id: string)',
      'useCreateCliente()',
      'useUpdateCliente()',
      'useRemoveCliente()',
    ]) {
      expect(queries).toContain(`export function ${hook}`)
    }
    expect(queries).toContain('useRepositories().clientes')
    // criar e editar invalidam o domínio; remover tira o detalhe do cache e invalida só as listas
    expect(queries.match(/invalidateQueries\(\{ queryKey: clienteKeys\.all \}\)/g)).toHaveLength(2)
    expect(queries).toContain('queryClient.removeQueries({ queryKey: clienteKeys.detail(id) })')
    expect(queries).toContain('invalidateQueries({ queryKey: clienteKeys.lists })')
    // a lista aceita opções e mantém os dados anteriores por padrão
    expect(queries).toContain('options: ClientesListOptions = {}')
    expect(queries).toContain('placeholderData: keepPreviousData')
  })

  it('registra o domínio nos três índices, no lugar certo de cada um', () => {
    const { plan } = generateDomain(fixtureProject(), { name: 'clientes' })

    expect(textOf(plan, 'src/schemas/index.ts')).toMatch(
      /export \* from '\.\/entities\/ai'\nexport \* from '\.\/entities\/cliente'\n$/,
    )

    const repositories = textOf(plan, 'src/repositories/index.ts')
    expect(repositories).toContain(
      "import { createAccountRepository } from './account'\nimport { createClientesRepository } from './clientes'\nimport { createCustomersRepository } from './customers'",
    )
    expect(repositories).toContain(
      "export * from './account'\nexport * from './clientes'\nexport * from './customers'",
    )
    expect(repositories).toContain(
      '  account: createAccountRepository,\n  clientes: createClientesRepository,\n  customers: createCustomersRepository,',
    )

    expect(textOf(plan, 'src/queries/index.ts')).toContain(
      "export { accountKeys, accountQueries } from './account'\nexport { clienteKeys, clienteQueries, useClientesList, useClienteDetail, useCreateCliente, useUpdateCliente, useRemoveCliente } from './clientes'\nexport { customerKeys",
    )
  })

  it('o que o índice de queries exporta é o que o arquivo das queries declara', () => {
    const { plan, names } = generateDomain(fixtureProject(), { name: 'clientes' })
    const queries = textOf(plan, 'src/queries/clientes.ts')

    for (const name of queriesExports(names)) {
      expect(queries, name).toMatch(new RegExp(`export (const|function) ${name}\\b`))
    }
  })

  it('com a entidade e um nome composto, os nomes saem da estrutura do código', () => {
    const { plan } = generateDomain(fixtureProject(), {
      name: 'pedidos-recentes',
      entity: 'pedido-recente',
    })

    expect(plan.summary().created).toContain('src/schemas/entities/pedido-recente.ts')
    expect(plan.summary().created).toContain('src/queries/pedidos-recentes.ts')
    expect(textOf(plan, 'src/schemas/entities/pedido-recente.ts')).toContain(
      'export type PedidoRecenteSchema = z.infer<typeof pedidoRecenteSchema>',
    )
    const repository = textOf(plan, 'src/repositories/pedidos-recentes/repository.mock.ts')
    expect(repository).toContain('export class MockPedidosRecentesRepository')
    expect(repository).toContain("'PEDIDO_RECENTE_NOT_FOUND'")
    expect(repository).toContain('id: `pedido-recente-${this.sequence}`')
    expect(textOf(plan, 'src/repositories/pedidos-recentes/index.ts')).toContain(
      'export function createPedidosRecentesRepository(',
    )
    expect(textOf(plan, 'src/repositories/index.ts')).toContain(
      '  pedidosRecentes: createPedidosRecentesRepository,',
    )
    const queries = textOf(plan, 'src/queries/pedidos-recentes.ts')
    expect(queries).toContain("createQueryKeys('pedidos-recentes', {")
    expect(queries).toContain('export function usePedidosRecentesList(')
    expect(queries).toContain('useRepositories().pedidosRecentes')
  })

  it('não deixa marcador nem undefined em nenhum arquivo gerado', () => {
    const { plan } = generateDomain(fixtureProject(), { name: 'clientes' })

    for (const source of plan.createdSources()) {
      expect(source.getFilePath(), source.getFilePath()).not.toMatch(/\{\{|undefined/)
      expect(source.getFullText(), source.getFilePath()).not.toMatch(/\{\{|undefined/)
    }
  })

  it('o plano grava no disco e o domínio fica registrado, sem sobrescrever', () => {
    const project = fixtureProject()
    const { plan } = generateDomain(project, { name: 'clientes' })

    const summary = plan.commit()

    expect(summary.created).toHaveLength(7)
    expect(
      readFileSync(path.join(project.src, 'repositories/clientes/index.ts'), 'utf8'),
    ).toContain('createClientesRepository')
    // O domínio já existe: a pasta está no projeto, e a segunda tentativa recusa
    expect(() => generateDomain(findProject(project.root), { name: 'clientes' })).toThrow(
      "o domínio 'clientes' já existe: a pasta src/repositories/clientes está no projeto.",
    )
  })
})

describe('generateDomain, recusas (UsageError, saída 2)', () => {
  const attempt = (request: Parameters<typeof generateDomain>[1], project = fixtureProject()) =>
    generateDomain(project, request)

  it.each([['Clientes'], ['clientes_novos'], ['1clientes'], ['']])(
    'recusa o nome %j que não é kebab-case',
    (name) => {
      expect(() => attempt({ name })).toThrow(UsageError)
      expect(() => attempt({ name })).toThrow(/é inválido/)
    },
  )

  it('recusa o nome que vira palavra reservada e o nome global', () => {
    expect(() => attempt({ name: 'new', entity: 'novo' })).toThrow(/palavra reservada/)
    expect(() => attempt({ name: 'dates', entity: 'date' })).toThrow(/nome global/)
  })

  it('recusa o plural que a regra do s erra, e pede a entidade', () => {
    expect(() => attempt({ name: 'categories' })).toThrow(/--entity category/)
    expect(() => attempt({ name: 'status' })).toThrow(/já estar no singular/)
    expect(() => attempt({ name: 'clientes', entity: 'clientes' })).toThrow(
      /igual ao nome do domínio/,
    )
  })

  it('recusa o domínio que já está registrado nos índices', () => {
    expect(() => attempt({ name: 'customers' })).toThrow(/já exporta '.\/entities\/customer'/)
  })

  it('recusa um índice que falta, dizendo qual', () => {
    for (const index of ['schemas', 'repositories', 'queries']) {
      const root = makeProject({
        'src/schemas/index.ts': "export * from './entities/a'\n",
        'src/repositories/index.ts': "import { x } from '@x/y'\nconst factories = {}\n",
        'src/queries/index.ts': '',
      })
      unlinkSync(path.join(root, `src/${index}/index.ts`))

      expect(() => attempt({ name: 'clientes' }, findProject(root))).toThrow(
        `o projeto não tem src/${index}/index.ts.`,
      )
    }
  })
})

describe('generateDomain com fields', () => {
  const FIELDS = 'titulo:string,autor:string,ano:number,disponivel:boolean,publicadoEm:date,apelido?:string'

  it('o schema, a entrada e a chave de ordem têm os campos, no lugar do name', () => {
    const { plan, fields } = generateDomain(fixtureProject(), { name: 'livros', fields: FIELDS })
    const schema = textOf(plan, 'src/schemas/entities/livro.ts')

    expect(fields.map((field) => field.name)).toEqual([
      'titulo',
      'autor',
      'ano',
      'disponivel',
      'publicadoEm',
      'apelido',
    ])
    expect(schema).toContain(`export const livroSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  autor: z.string(),
  ano: z.number(),
  disponivel: z.boolean(),
  publicadoEm: z.iso.date(),
  apelido: z.string().optional(),
  createdAt: z.string(),
})`)
    expect(schema).toContain(
      'livroSchema.pick({ titulo: true, autor: true, ano: true, disponivel: true, publicadoEm: true, apelido: true })',
    )
    expect(schema).toContain("export type LivroSortKey = 'titulo' | 'autor' | 'ano' | 'publicadoEm' | 'apelido' | 'createdAt'")
    expect(schema).toContain('/** Busca pelos campos titulo, autor, apelido, sem')
    expect(schema).not.toContain('name')
  })

  it('as fixtures, o mock e o contrato seguem os campos', () => {
    const { plan } = generateDomain(fixtureProject(), { name: 'livros', fields: FIELDS })
    const fixtures = textOf(plan, 'src/repositories/livros/fixtures.ts')
    const mock = textOf(plan, 'src/repositories/livros/repository.mock.ts')
    const contract = textOf(plan, 'src/repositories/livros/repository.contract.test.ts')

    expect(fixtures).toContain("titulo: 'Titulo 1'")
    expect(fixtures).toContain('ano: 30')
    expect(fixtures).toContain('disponivel: true')
    expect(fixtures).toContain("publicadoEm: '2026-01-14'")
    expect(mock).toContain("matchesSearch([item.titulo, item.autor, item.apelido ?? ''], query.search)")
    expect(mock).toContain('      ano: (item) => item.ano,')
    expect(mock).toContain("      apelido: (item) => item.apelido ?? '',")
    expect(mock).not.toContain('disponivel: (item)')
    expect(mock).toContain('      disponivel: input.disponivel,')
    expect(contract).toContain("search: 'TITULO 2'")
    expect(contract).toContain("key: 'titulo'")
    expect(contract).toContain("repo.create({ titulo: 'Titulo 4', autor: 'Autor 4'")
    expect(contract).toContain("{ titulo: 'Titulo editado' }")
    expect(contract).not.toContain('Exemplo')
  })

  it('o contrato de um domínio sem texto busca pelo id e ordena pelo createdAt', () => {
    const { plan } = generateDomain(fixtureProject(), { name: 'avisos', fields: 'ativo:boolean' })
    const contract = textOf(plan, 'src/repositories/avisos/repository.contract.test.ts')

    expect(contract).toContain("search: 'AVISO-2'")
    expect(contract).toContain('item.id)).toEqual([\'aviso-2\'])')
    expect(contract).toContain("key: 'createdAt'")
  })

  it('campos inválidos são erro de uso e não escrevem nada', () => {
    const project = fixtureProject()
    const before = readFileSync(path.join(project.src, 'schemas', 'index.ts'), 'utf8')

    expect(() => generateDomain(project, { name: 'livros', fields: 'id:string' })).toThrow(UsageError)
    expect(() => generateDomain(project, { name: 'livros', fields: '' })).toThrow(UsageError)
    expect(readFileSync(path.join(project.src, 'schemas', 'index.ts'), 'utf8')).toBe(before)
  })

  it('sem fields devolve o campo name', () => {
    const { fields } = generateDomain(fixtureProject(), { name: 'clientes' })

    expect(fields).toEqual([{ name: 'name', type: 'string', optional: false }])
  })
})
