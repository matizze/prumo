import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../codemods/test-support.ts'
import { exec } from '../test-support.ts'

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

/** Um projeto de fixture com o schema `clientes` já gerado pelo comando. */
async function withSchema(args: string[] = ['clientes']) {
  const { root } = fixtureProject()
  const made = await exec(['make:schema', ...args], root)
  expect(made.code, made.stderr).toBe(0)
  return root
}

describe('prumo make:repository', () => {
  it('cria o repositório, registra no container e diz o próximo passo', async () => {
    const root = await withSchema()
    const result = await exec(['make:repository', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('prumo make:repository: clientes (entidade cliente, fonte mock).')
    expect(result.stdout).toContain('Campos (lidos do schema): name (string).')
    expect(result.stdout).toContain('Criados (5):\n  src/repositories/clientes/fixtures.ts')
    expect(result.stdout).toContain('Alterados (1):\n  src/repositories/index.ts')
    expect(result.stdout).toContain('Próximo passo: prumo make:query clientes\n')
    expect(read(root, 'src/repositories/clientes/index.ts')).toContain('createClientesRepository')
    expect(read(root, 'src/repositories/index.ts')).toContain('  clientes: createClientesRepository,')
  })

  it('sem o schema: saída 2, a dica, e nada criado', async () => {
    const { root } = fixtureProject()
    const result = await exec(['make:repository', 'paes', '--entity', 'pao'], root)

    expect(result.code).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('falta o schema paes (src/schemas/entities/pao.ts); rode prumo make:schema paes --entity pao.')
    expect(existsSync(path.join(root, 'src/repositories/paes'))).toBe(false)
  })

  it('o mesmo repositório duas vezes: a segunda sai com 2 e não muda nada', async () => {
    const root = await withSchema()
    expect((await exec(['make:repository', 'clientes'], root)).code).toBe(0)
    const container = read(root, 'src/repositories/index.ts')

    const again = await exec(['make:repository', 'clientes'], root)

    expect(again.code).toBe(2)
    expect(again.stderr).toContain("o repositório 'clientes' já existe")
    expect(read(root, 'src/repositories/index.ts')).toBe(container)
  })

  it('--dry-run lista o plano e não escreve nada', async () => {
    const root = await withSchema()
    const result = await exec(['make:repository', 'clientes', '--dry-run'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('(simulação)')
    expect(result.stdout).toContain('Seriam criados (5):')
    expect(result.stdout).toContain('Seriam alterados (1):')
    expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(existsSync(path.join(root, 'src/repositories/clientes'))).toBe(false)
  })

  it('um campo novo de tipo reconhecido, posto à mão no schema (objeto, pick e SortKey), entra no mock (a compilação está em repository.compile.test.ts)', async () => {
    const root = await withSchema()
    const file = path.join(root, 'src/schemas/entities/cliente.ts')
    writeFileSync(file, read(root, 'src/schemas/entities/cliente.ts').replace('  name: z.string(),', '  name: z.string(),\n  idade: z.number().int(),').replace('.pick({ ', '.pick({ idade: true, ').replace(/(export type ClienteSortKey =[^\n]*)/, "$1 | 'idade'"))

    const result = await exec(['make:repository', 'clientes'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('Campos (lidos do schema): name (string), idade (int).')
    expect(read(root, 'src/repositories/clientes/fixtures.ts')).toContain('idade:')
    expect(read(root, 'src/repositories/clientes/repository.mock.ts')).toContain('idade: input.idade,')
  })

  it('avisa quando o app não tem o errors.json, e acrescenta a chave quando tem', async () => {
    const root = await withSchema()
    const warned = await exec(['make:repository', 'clientes', '--dry-run'], root)
    expect(warned.stdout).toContain('Aviso: o texto de CLIENTE_NOT_FOUND não foi acrescentado')

    writeFileSync(path.join(root, 'src/messages/pt-BR/errors.json'), '{}\n')
    writeFileSync(path.join(root, 'src/messages/en/errors.json'), '{}\n')
    const done = await exec(['make:repository', 'clientes'], root)
    expect(done.code, done.stderr).toBe(0)
    expect(done.stdout).not.toContain('Aviso')
    expect(done.stdout).toContain('src/messages/pt-BR/errors.json')
    expect(JSON.parse(read(root, 'src/messages/en/errors.json'))).toEqual({ CLIENTE_NOT_FOUND: 'Record not found.' })
  })

  it('recusa --entity e --root vazios, opção desconhecida e fonte desconhecida, com 2', async () => {
    const root = await withSchema()
    expect((await exec(['make:repository', 'clientes', '--entity', ' '], root)).code).toBe(2)
    expect((await exec(['make:repository', 'clientes', '--root', ''], root)).code).toBe(2)
    expect((await exec(['make:repository', 'clientes', '--nada'], root)).code).toBe(2)
    expect((await exec(['make:repository'], root)).code).toBe(2)
    const graphql = await exec(['make:repository', 'clientes', '--data-source', 'graphql'], root)
    expect(graphql.code).toBe(2)
    expect(graphql.stderr).toContain("valor inválido para a opção '--data-source <fonte>': 'graphql'")
    expect(graphql.stderr).toContain('Valores aceitos: mock, http, storage.')
    expect(existsSync(path.join(root, 'src/repositories/clientes'))).toBe(false)
  })

  it('--data-source mock é o padrão: cria o repositório e a segunda vez sai com 2', async () => {
    const root = await withSchema()
    const result = await exec(['make:repository', 'clientes', '--data-source', 'mock'], root)
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('fonte mock)')
    expect(existsSync(path.join(root, 'src/repositories/clientes/repository.http.ts'))).toBe(false)
    const again = await exec(['make:repository', 'clientes', '--data-source', 'mock'], root)
    expect(again.code).toBe(2)
    expect(again.stderr).toContain("o repositório 'clientes' já existe")
  })

  it('--root aponta para o projeto', async () => {
    const root = await withSchema()
    const outside = path.dirname(root)
    const result = await exec(['make:repository', 'clientes', '--root', root], outside)
    expect(result.code, result.stderr).toBe(0)
    expect(existsSync(path.join(root, 'src/repositories/clientes/index.ts'))).toBe(true)
  })

  describe('--data-source http e storage', () => {
    it('http num repositório que não existe: cria tudo, o cliente, a fonte e a fábrica', async () => {
      const root = await withSchema()
      const result = await exec(['make:repository', 'clientes', '--data-source', 'http'], root)

      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain('fonte http)')
      expect(result.stdout).toContain('Criados (9):')
      for (const file of [
        'src/repositories/clientes/repository.http.ts',
        'src/repositories/http.ts',
        'src/repositories/api.ts',
        'src/vite-env.d.ts',
      ]) {
        expect(result.stdout, file).toContain(`  ${file}`)
        expect(existsSync(path.join(root, file)), file).toBe(true)
      }
      expect(result.stdout).toContain('src/repositories/options.ts')
      expect(result.stdout).toContain('VITE_DATA_SOURCE=http e VITE_API_URL=')
      expect(read(root, 'src/repositories/options.ts')).toContain("DATA_SOURCES = ['mock', 'http'] as const")
      const factory = read(root, 'src/repositories/clientes/index.ts')
      expect(factory).toContain("import { api } from '../api'")
      expect(factory).toContain("if (dataSource === 'http') return new HttpClientesRepository(api)")
      expect(factory).toContain("export { HttpClientesRepository } from './repository.http'")
      expect(read(root, 'src/repositories/clientes/repository.contract.test.ts')).toContain(
        'describe.skipIf(!apiTestUrl)',
      )
    })

    it('storage num repositório que já existe: acrescenta só a fonte', async () => {
      const root = await withSchema()
      expect((await exec(['make:repository', 'clientes'], root)).code).toBe(0)
      const container = read(root, 'src/repositories/index.ts')
      const mock = read(root, 'src/repositories/clientes/repository.mock.ts')

      const result = await exec(['make:repository', 'clientes', '--data-source', 'storage'], root)

      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain('fonte storage, repositório que já existia)')
      expect(result.stdout).toContain('Criados (2):\n  src/repositories/clientes/repository.storage.ts\n  src/vite-env.d.ts')
      expect(result.stdout).toContain('Alterados (4):')
      // O container só muda para ler a fonte do ambiente; o domínio continua registrado igual
      expect(read(root, 'src/repositories/index.ts')).toBe(
        container.replace(
          "resolveDataSource(undefined, DATA_SOURCES, 'mock')",
          "resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')",
        ),
      )
      expect(read(root, 'src/repositories/clientes/repository.mock.ts')).toBe(mock)
      expect(existsSync(path.join(root, 'src/repositories/http.ts'))).toBe(false)
      expect(read(root, 'src/repositories/options.ts')).toContain("['mock', 'storage']")
      expect(read(root, 'src/repositories/clientes/repository.storage.ts')).toContain(
        "STORAGE_KEY = 'app:clientes'",
      )
      expect(read(root, 'src/repositories/clientes/index.ts')).toContain(
        "if (dataSource === 'storage') return new StorageClientesRepository({ latencyMs })",
      )
    })

    it('a mesma fonte duas vezes: a segunda sai com 2 e não muda nada', async () => {
      const root = await withSchema()
      expect((await exec(['make:repository', 'clientes', '--data-source', 'http'], root)).code).toBe(0)
      const before = [
        'src/repositories/options.ts',
        'src/repositories/clientes/index.ts',
        'src/repositories/clientes/repository.contract.test.ts',
      ].map((file) => read(root, file))

      const again = await exec(['make:repository', 'clientes', '--data-source', 'http'], root)

      expect(again.code).toBe(2)
      expect(again.stderr).toContain("o repositório 'clientes' já tem a fonte http")
      expect(
        [
          'src/repositories/options.ts',
          'src/repositories/clientes/index.ts',
          'src/repositories/clientes/repository.contract.test.ts',
        ].map((file) => read(root, file)),
      ).toEqual(before)
    })

    it('as duas fontes juntas, e o segundo domínio reaproveita o cliente http', async () => {
      const root = await withSchema()
      expect((await exec(['make:schema', 'pedidos'], root)).code).toBe(0)
      expect((await exec(['make:repository', 'clientes', '--data-source', 'http'], root)).code).toBe(0)
      const second = await exec(['make:repository', 'pedidos', '--data-source', 'http'], root)

      expect(second.code, second.stderr).toBe(0)
      expect(second.stdout).toContain('Criados (6):')
      expect(second.stdout).not.toContain('src/repositories/http.ts')
      expect(second.stdout).not.toContain('src/repositories/api.ts')
      expect((await exec(['make:repository', 'clientes', '--data-source', 'storage'], root)).code).toBe(0)
      expect(read(root, 'src/repositories/options.ts')).toContain("['mock', 'http', 'storage']")
      const factory = read(root, 'src/repositories/clientes/index.ts')
      expect(factory.indexOf("'http'")).toBeLessThan(factory.indexOf("'storage'"))
      expect(factory).toContain('return new MockClientesRepository({ latencyMs })')
    })

    it('--dry-run com http num app sem o cliente lista o http.ts, o api.ts e o options.ts', async () => {
      const root = await withSchema()
      expect((await exec(['make:repository', 'clientes'], root)).code).toBe(0)
      const result = await exec(['make:repository', 'clientes', '--data-source', 'http', '--dry-run'], root)

      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain('Seriam criados (4):')
      expect(result.stdout).toContain('  src/repositories/http.ts\n')
      expect(result.stdout).toContain('  src/repositories/api.ts\n')
      expect(result.stdout).toContain('  src/repositories/options.ts\n')
      expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
      expect(existsSync(path.join(root, 'src/repositories/http.ts'))).toBe(false)
      expect(read(root, 'src/repositories/options.ts')).not.toContain('http')
    })

    it('sem o options.ts ou com a fábrica mudada: sai com 2 e não escreve nada', async () => {
      const root = await withSchema()
      expect((await exec(['make:repository', 'clientes'], root)).code).toBe(0)
      const factory = path.join(root, 'src/repositories/clientes/index.ts')
      writeFileSync(factory, read(root, 'src/repositories/clientes/index.ts').replace('createClientesRepository', 'outroNome'))
      const result = await exec(['make:repository', 'clientes', '--data-source', 'http'], root)
      expect(result.code).toBe(2)
      expect(result.stderr).toContain("não tem a função 'createClientesRepository'")
      expect(existsSync(path.join(root, 'src/repositories/clientes/repository.http.ts'))).toBe(false)
      expect(existsSync(path.join(root, 'src/repositories/http.ts'))).toBe(false)
      expect(read(root, 'src/repositories/options.ts')).not.toContain('http')
    })

    it('avisa, sem falhar, quando o teste de contrato foi apagado', async () => {
      const root = await withSchema()
      expect((await exec(['make:repository', 'clientes'], root)).code).toBe(0)
      rmSync(path.join(root, 'src/repositories/clientes/repository.contract.test.ts'))
      const result = await exec(['make:repository', 'clientes', '--data-source', 'storage'], root)
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain('Aviso: o teste de contrato da fonte storage não foi acrescentado')
    })
    it('storage acrescenta o texto de <ENTIDADE>_INVALID ao errors.json de cada idioma', async () => {
      const root = await withSchema()
      writeFileSync(path.join(root, 'src/messages/pt-BR/errors.json'), '{}\n')
      writeFileSync(path.join(root, 'src/messages/en/errors.json'), '{}\n')
      expect((await exec(['make:repository', 'clientes'], root)).code).toBe(0)
      const result = await exec(['make:repository', 'clientes', '--data-source', 'storage'], root)
      expect(result.code, result.stderr).toBe(0)
      expect(JSON.parse(read(root, 'src/messages/pt-BR/errors.json'))).toEqual({
        CLIENTE_NOT_FOUND: 'Registro não encontrado.',
        CLIENTE_INVALID: 'Dados inválidos.',
      })
      expect(JSON.parse(read(root, 'src/messages/en/errors.json')).CLIENTE_INVALID).toBe('Invalid data.')
    })

    it('app de antes deste passo: troca o resolveDataSource(undefined, ...) pelo que lê a VITE_DATA_SOURCE', async () => {
      const root = await withSchema()
      const container = 'src/repositories/index.ts'
      expect(read(root, container)).toContain("resolveDataSource(undefined, DATA_SOURCES, 'mock')")
      const result = await exec(['make:repository', 'clientes', '--data-source', 'http'], root)
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).not.toContain('Aviso: o container')
      expect(read(root, container)).toContain(
        "resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')",
      )
      expect(read(root, container)).not.toContain('undefined')
    })

    it('container que não é o do modelo: avisa como ligar e não o toca', async () => {
      const root = await withSchema()
      const container = 'src/repositories/index.ts'
      const custom = read(root, container).replace(
        "resolveDataSource(undefined, DATA_SOURCES, 'mock')",
        "resolveDataSource(window.location.hash, DATA_SOURCES, 'mock')",
      )
      writeFileSync(path.join(root, container), custom)
      const result = await exec(['make:repository', 'clientes', '--data-source', 'storage'], root)
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toContain('Aviso: o container src/repositories/index.ts não lê a VITE_DATA_SOURCE')
      expect(result.stdout).toContain("resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')")
      expect(read(root, container)).toContain('window.location.hash')
    })

    it('container que já lê a VITE_DATA_SOURCE (app novo) não muda nem avisa', async () => {
      const root = await withSchema()
      const container = 'src/repositories/index.ts'
      writeFileSync(
        path.join(root, container),
        read(root, container).replace(
          "resolveDataSource(undefined, DATA_SOURCES, 'mock')",
          "resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')",
        ),
      )
      const result = await exec(['make:repository', 'clientes', '--data-source', 'storage'], root)
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).not.toContain('Aviso: o container')
      expect(read(root, container)).toContain('VITE_DATA_SOURCE')
    })
  })
})
