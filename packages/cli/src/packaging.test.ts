import { spawn, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/** A raiz do monorepo: o empacotamento é um script da raiz, e o teste o roda e confere os tarballs. */
const REPO = path.resolve(import.meta.dirname, '../../..')
const SCRIPT = path.join(REPO, 'scripts', 'pack-packages.sh')

const PACKAGES = ['core', 'rules', 'testing', 'cli', 'mcp'] as const
type PackageName = (typeof PACKAGES)[number]

type Manifest = {
  name: string
  version: string
  private?: boolean
  repository?: { type?: string; url?: string; directory?: string }
  bin?: Record<string, string>
  exports: Record<string, { types: string; default: string }>
  types?: string
  publishConfig?: { registry?: string; access?: string }
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function workspaceManifest(name: PackageName): Manifest {
  return JSON.parse(readFileSync(path.join(REPO, 'packages', name, 'package.json'), 'utf8'))
}

let work: string
let packs: string

/** O tarball de um pacote: o `pnpm pack` o nomeia com o escopo, o nome e a versão. */
function tarball(name: PackageName): string {
  return path.join(packs, `matizze-prumo-${name}-${workspaceManifest(name).version}.tgz`)
}

/** Os caminhos do tarball (`tar -tzf`), sem o `package/` que o npm põe na frente de tudo. */
function entries(name: PackageName): string[] {
  const result = spawnSync('tar', ['-tzf', tarball(name)], { encoding: 'utf8' })
  expect(result.status, result.stderr).toBe(0)
  return result.stdout
    .split('\n')
    .filter((line) => line !== '' && !line.endsWith('/'))
    .map((line) => {
      expect(line.startsWith('package/'), `${line} fora de package/`).toBe(true)
      return line.slice('package/'.length)
    })
}

/** A pasta onde o tarball foi extraído (a mesma coisa que o gerenciador de pacotes põe em node_modules). */
function extracted(name: PackageName): string {
  return path.join(work, 'extracted', name)
}

function packedManifest(name: PackageName): Manifest {
  return JSON.parse(readFileSync(path.join(extracted(name), 'package.json'), 'utf8'))
}

/** Todo caminho que o `exports` do pacote publicado aponta, com o tipo e o código de cada subcaminho. */
function exportedFiles(manifest: Manifest): string[] {
  return Object.values(manifest.exports).flatMap((entry) => [entry.types, entry.default])
}

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), 'prumo-packaging-'))
  packs = path.join(work, 'packs')
  const result = spawnSync('bash', [SCRIPT, packs], { encoding: 'utf8' })
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0)
  for (const name of PACKAGES) {
    mkdirSync(extracted(name), { recursive: true })
    const untar = spawnSync(
      'tar',
      ['-xzf', tarball(name), '-C', extracted(name), '--strip-components=1'],
      { encoding: 'utf8' },
    )
    expect(untar.status, untar.stderr).toBe(0)
  }
}, 240_000)

afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true })
})

describe('empacotamento (scripts/pack-packages.sh)', () => {
  it('deixa um tarball por pacote publicável na pasta, e só eles', () => {
    expect(readdirSync(packs).sort()).toEqual(
      PACKAGES.map((name) => path.basename(tarball(name))).sort(),
    )
  })

  it('para com código 2 e a sintaxe de uso quando recebe argumento demais', () => {
    const result = spawnSync('bash', [SCRIPT, 'a', 'b'], { encoding: 'utf8' })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('uso: scripts/pack-packages.sh')
  })

  it('está no package.json da raiz como pack:all, e o build da raiz compila os pacotes', () => {
    const { scripts } = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(scripts['pack:all']).toBe('scripts/pack-packages.sh')
    expect(scripts.build).toBe('pnpm --filter "./packages/*" run build')
  })
})

describe.each(PACKAGES)('tarball de @matizze/prumo-%s', (name) => {
  it('tem o dist/ com o .js e o .d.ts de cada subcaminho do exports', () => {
    const files = entries(name)
    const packed = packedManifest(name)
    expect(Object.keys(packed.exports)).toEqual(Object.keys(workspaceManifest(name).exports))
    for (const file of exportedFiles(packed)) {
      expect(file.startsWith('./dist/'), `${file} fora do dist/`).toBe(true)
      expect(files, `${file} está no exports mas não no tarball`).toContain(file.slice(2))
    }
    expect(files).toContain('package.json')
    expect(files).toContain('README.md')
  })

  it('só leva o dist, o package.json e o README (e os modelos, no cli): sem código-fonte, teste, fixture nem tsconfig', () => {
    const files = entries(name)
    const outside = files.filter(
      (file) =>
        !(
          file === 'package.json' ||
          file === 'README.md' ||
          file.startsWith('dist/') ||
          (name === 'cli' && file.startsWith('templates/'))
        ),
    )
    expect(outside).toEqual([])
    const unwanted = files.filter((file) =>
      /(\.test\.|test-support|rule-tester|__fixtures__|tsconfig|\.tsbuildinfo)/.test(file),
    )
    expect(unwanted).toEqual([])
    // Código de teste não vai: um .js só importa o vitest se o pacote o declara (o testing, que é
    // feito para ele). Do contrário, é um helper de teste que escapou para o tarball.
    const manifest = packedManifest(name)
    const declaresVitest = Boolean(
      manifest.dependencies?.vitest ?? manifest.peerDependencies?.vitest,
    )
    const importsVitest = files.filter(
      (file) =>
        file.endsWith('.js') &&
        /(from\s*|import\s*\(?\s*)(['"])(vitest|@vitest\/[^'"]*)\2/.test(
          readFileSync(path.join(extracted(name), file), 'utf8'),
        ),
    )
    expect(declaresVitest ? [] : importsVitest).toEqual([])
    // O .ts do código-fonte não vai, só o .d.ts
    expect(files.filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))).toEqual([])
  })

  it('aponta exports e types para o dist/ no pacote, e o workspace continua em src/', () => {
    const workspace = workspaceManifest(name)
    for (const target of Object.values(workspace.exports)) {
      expect(target, 'o exports do workspace é o código-fonte').toMatch(/^\.\/src\/.*\.tsx?$/)
    }
    const packed = packedManifest(name)
    expect(packed.types === undefined || packed.types.startsWith('./dist/')).toBe(true)
    expect(packed.publishConfig).toMatchObject({
      registry: 'https://registry.npmjs.org',
      access: 'public',
    })
  })

  it('não tem import de .ts nos .d.ts: o produto que o consome não liga allowImportingTsExtensions', () => {
    const declarations = entries(name).filter((file) => file.endsWith('.d.ts'))
    expect(declarations.length).toBeGreaterThan(0)
    for (const file of declarations) {
      const text = readFileSync(path.join(extracted(name), file), 'utf8')
      expect(text, file).not.toMatch(/(from\s*|import\s*\(?\s*)(['"])\.{1,2}\/[^'"]*\.tsx?\2/)
    }
  })

  it('não tem import de .ts nos .js: o Node não faz type stripping dentro de node_modules', () => {
    const scripts = entries(name).filter((file) => file.endsWith('.js'))
    expect(scripts.length).toBeGreaterThan(0)
    for (const file of scripts) {
      const text = readFileSync(path.join(extracted(name), file), 'utf8')
      expect(text, file).not.toMatch(/(from\s*|import\s*\(?\s*)(['"])\.{1,2}\/[^'"]*\.tsx?\2/)
    }
  })

  it('troca o workspace:* das dependências pela versão do pacote', () => {
    const packed = packedManifest(name)
    for (const group of [packed.dependencies, packed.peerDependencies]) {
      for (const [dependency, range] of Object.entries(group ?? {})) {
        expect(range, `${dependency} ficou com a faixa ${range}`).not.toMatch(/^workspace:/)
      }
    }
  })

  it('está pronto para o npm público: sem private, com repository e publishConfig público', () => {
    // A publicação em si é de uma pessoa (com o token do npm); aqui só se confere que o pacote pode sair.
    for (const manifest of [workspaceManifest(name), packedManifest(name)]) {
      expect(manifest.private, 'um pacote private não publica').toBeUndefined()
      // O repository liga o pacote ao repositório
      expect(manifest.repository).toEqual({
        type: 'git',
        url: 'git+https://github.com/matizze/prumo.git',
        directory: `packages/${name}`,
      })
      expect(manifest.publishConfig).toMatchObject({
        registry: 'https://registry.npmjs.org',
        access: 'public',
      })
    }
  })
})

describe('@matizze/prumo-mcp empacotado', () => {
  it('depende da versão exata que o pacote cli tem, e não do workspace', () => {
    const packed = packedManifest('mcp')
    expect(workspaceManifest('mcp').dependencies?.['@matizze/prumo-cli']).toBe('workspace:*')
    expect(packed.dependencies?.['@matizze/prumo-cli']).toBe(workspaceManifest('cli').version)
  })

  it('tem o bin prumo-mcp em dist/bin.js, com o shebang e executável', () => {
    const packed = packedManifest('mcp')
    expect(packed.bin).toEqual({ 'prumo-mcp': './dist/bin.js' })
    expect(workspaceManifest('mcp').bin).toEqual({ 'prumo-mcp': './src/bin.ts' })
    const bin = path.join(extracted('mcp'), 'dist', 'bin.js')
    expect(readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node\n')).toBe(true)
    expect(statSync(bin).mode & 0o111).not.toBe(0)
  })

  it('exporta só a entrada principal, e o package-info lê o package.json que fica acima do dist/', () => {
    const packed = packedManifest('mcp')
    expect(Object.keys(packed.exports)).toEqual(['.'])
    expect(packed.dependencies).toMatchObject({
      '@modelcontextprotocol/server': expect.any(String),
      zod: expect.any(String),
    })
    // O cliente do SDK é só dos testes: não vai para o produto
    expect(packed.dependencies?.['@modelcontextprotocol/client']).toBeUndefined()
  })
})

describe('@matizze/prumo-cli empacotado', () => {
  it('depende da versão que o pacote rules tem', () => {
    expect(packedManifest('cli').dependencies?.['@matizze/prumo-rules']).toBe(
      workspaceManifest('rules').version,
    )
  })

  it('tem o bin em dist/bin.js, com o shebang e executável', () => {
    const packed = packedManifest('cli')
    expect(packed.bin).toEqual({ prumo: './dist/bin.js' })
    expect(workspaceManifest('cli').bin).toEqual({ prumo: './src/bin.ts' })
    const bin = path.join(extracted('cli'), 'dist', 'bin.js')
    expect(readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node\n')).toBe(true)
    expect(statSync(bin).mode & 0o111).not.toBe(0)
  })

  it('leva os modelos dos geradores, os mesmos arquivos de templates/, e nenhum outro', () => {
    const templates = path.join(REPO, 'packages', 'cli', 'templates')
    const source = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? source(path.join(dir, entry.name)).map((file) => `${entry.name}/${file}`)
          : [entry.name],
      )
    const expected = source(templates).map((file) => `templates/${file}`)

    expect(expected.length).toBeGreaterThan(0)
    expect(
      entries('cli')
        .filter((file) => file.startsWith('templates/'))
        .sort(),
    ).toEqual(expected.sort())
    for (const file of expected) {
      expect(readFileSync(path.join(extracted('cli'), file), 'utf8'), file).toBe(
        readFileSync(path.join(REPO, 'packages', 'cli', file), 'utf8'),
      )
    }
    expect(workspaceManifest('cli')).toMatchObject({ files: ['dist', 'templates'] })
  })

  describe('instalado como o gerenciador de pacotes instala (em node_modules, sem type stripping)', () => {
    let product: string
    let bin: string
    let mcpBin: string

    beforeAll(() => {
      // Um produto vazio, fora do monorepo: o cli e o rules vêm dos tarballs, e as dependências de
      // terceiros, do node_modules do cli (um atalho para a mesma pasta, que o Node resolve pelo caminho real)
      product = path.join(work, 'product')
      const modules = path.join(product, 'node_modules')
      mkdirSync(path.join(modules, '@matizze'), { recursive: true })
      writeFileSync(path.join(product, 'package.json'), '{ "name": "produto", "type": "module" }\n')
      cpSync(extracted('cli'), path.join(modules, '@matizze', 'prumo-cli'), { recursive: true })
      cpSync(extracted('rules'), path.join(modules, '@matizze', 'prumo-rules'), { recursive: true })
      cpSync(extracted('mcp'), path.join(modules, '@matizze', 'prumo-mcp'), { recursive: true })
      for (const owner of ['cli', 'mcp'] as const) {
        const dependencies = Object.keys(packedManifest(owner).dependencies ?? {})
        for (const dependency of dependencies.filter((entry) => !entry.startsWith('@matizze/'))) {
          const link = path.join(modules, dependency)
          if (existsSync(link)) continue
          mkdirSync(path.dirname(link), { recursive: true })
          symlinkSync(
            realpathSync(path.join(REPO, 'packages', owner, 'node_modules', dependency)),
            link,
          )
        }
      }
      bin = path.join(modules, '@matizze', 'prumo-cli', 'dist', 'bin.js')
      mcpBin = path.join(modules, '@matizze', 'prumo-mcp', 'dist', 'bin.js')
    })

    it('roda o --help com o node, a partir de uma pasta fora do monorepo', () => {
      const result = spawnSync(process.execPath, [bin, '--help'], {
        cwd: product,
        encoding: 'utf8',
      })
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('check')
      expect(result.stdout).toContain('doctor')
      expect(result.stdout).toContain('make:domain')
    })

    it('roda o check num projeto, com a análise do rules empacotado', () => {
      const project = path.join(work, 'project')
      mkdirSync(project)
      writeFileSync(path.join(project, 'package.json'), '{ "name": "projeto" }\n')
      cpSync(
        path.join(REPO, 'packages', 'rules', 'src', 'check', '__fixtures__', 'valid', 'src'),
        path.join(project, 'src'),
        { recursive: true },
      )
      const result = spawnSync(process.execPath, [bin, 'check', '--root', project], {
        cwd: product,
        encoding: 'utf8',
      })
      expect(`${result.stdout}${result.stderr}`).not.toContain('[')
      expect(result.status).toBe(0)
    })

    it('gera um domínio com os modelos do tarball, a partir do dist/, e o check do fim passa', () => {
      const project = path.join(work, 'domain-project')
      const write = (file: string, content: string) => {
        mkdirSync(path.dirname(path.join(project, file)), { recursive: true })
        writeFileSync(path.join(project, file), content)
      }
      write('package.json', '{ "name": "projeto" }\n')
      write('src/schemas/index.ts', "export * from '@matizze/prumo-core/data'\n")
      write('src/queries/index.ts', '// Queries, uma por domínio.\n')
      write(
        'src/repositories/index.ts',
        "import { createRepositoryContainer } from '@matizze/prumo-core/repositories'\nconst factories = {}\nexport const container = createRepositoryContainer(factories, { dataSource: 'memory' })\n",
      )

      const result = spawnSync(
        process.execPath,
        [bin, 'make:domain', 'clientes', '--root', project],
        {
          cwd: product,
          encoding: 'utf8',
        },
      )

      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Criados (7):')
      expect(result.stdout).toContain('prumo check: nenhuma violação.')
      const mock = readFileSync(
        path.join(project, 'src/repositories/clientes/repository.mock.ts'),
        'utf8',
      )
      expect(mock).toContain('export class MockClientesRepository implements IClientesRepository')
      expect(mock).not.toContain('{{')
      expect(readFileSync(path.join(project, 'src/repositories/index.ts'), 'utf8')).toContain(
        '  clientes: createClientesRepository,',
      )
    })

    it('lê a própria versão no doctor, do package.json que fica acima do dist/', () => {
      // O doctor lê '../../package.json' a partir do dist/commands: confere que o caminho vale no pacote
      // (a faixa esperada do cli é a da versão que está rodando)
      const result = spawnSync(process.execPath, [bin, 'doctor', '--root', product], {
        cwd: product,
        encoding: 'utf8',
      })
      const { version } = workspaceManifest('cli')
      expect(result.stdout).toContain(`@matizze/prumo-cli: ${version} (esperado: >=${version} <`)
    })

    it('carrega o plugin de ESLint do rules, que lê o próprio package.json', () => {
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          "const { default: plugin } = await import('@matizze/prumo-rules/eslint'); console.log(plugin.meta.name, Object.keys(plugin.rules).length)",
        ],
        { cwd: product, encoding: 'utf8' },
      )
      expect(result.stderr).toBe('')
      expect(result.stdout.trim()).toBe('@matizze/prumo-rules 2')
    })

    it('exporta a API em processo em @matizze/prumo-cli/api, e roda um comando sem escrever no stdout', () => {
      const packed = packedManifest('cli')
      expect(Object.keys(packed.exports)).toEqual(['.', './api'])
      expect(packed.exports['./api']).toEqual({
        types: './dist/api.d.ts',
        default: './dist/api.js',
      })
      const script = `
        const { describeCommands, createRoot, runInProcess, toArgv } = await import('@matizze/prumo-cli/api')
        const root = createRoot({ out() {}, err() {}, cwd: '.', env: {} })
        const commands = await describeCommands(root)
        const check = commands.find((c) => c.name === 'check')
        const result = await runInProcess([...check.path, ...toArgv(check, { root: process.cwd() })], { cwd: process.cwd() })
        process.stderr.write(JSON.stringify({ names: commands.map((c) => c.toolName), code: result.exitCode, out: result.stdout, err: result.stderr }))
      `
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: product,
        encoding: 'utf8',
      })
      // O stdout do processo fica vazio: o que o comando escreveu veio no resultado, e o que o
      // teste lê vem do stderr só porque é o que o script escolheu para devolver os dados
      expect(result.stdout).toBe('')
      const data = JSON.parse(result.stderr) as { names: string[]; code: number; err: string }
      expect(data.names).toEqual([
        'check',
        'doctor',
        'make_component',
        'make_domain',
        'make_page',
        'move_component',
        'new',
      ])
      // O produto vazio não tem src: o check recusa com 2, e a mensagem veio pelo resultado
      expect(data.code).toBe(2)
      expect(data.err).toContain('não tem src')
    })

    it('o prumo-mcp roda o --help e o --version com o node, de uma pasta fora do monorepo', () => {
      const help = spawnSync(process.execPath, [mcpBin, '--help'], {
        cwd: product,
        encoding: 'utf8',
      })
      expect(help.stderr).toBe('')
      expect(help.status).toBe(0)
      expect(help.stdout).toContain('Uso: prumo-mcp')

      const version = spawnSync(process.execPath, [mcpBin, '--version'], {
        cwd: product,
        encoding: 'utf8',
      })
      expect(version.status).toBe(0)
      expect(version.stdout).toBe(`${workspaceManifest('mcp').version}\n`)
    })

    it('o prumo-mcp responde ao initialize e lista as ferramentas por stdio, a partir de dist/', async () => {
      // O servidor de verdade, o do tarball: o cliente é um JSON-RPC por linha, escrito à mão, para o
      // teste não depender de como o SDK carrega (o do monorepo seria o src/, não o pacote)
      const child = spawn(process.execPath, [mcpBin], { cwd: product })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk: Buffer) => (stdout += String(chunk)))
      child.stderr.on('data', (chunk: Buffer) => (stderr += String(chunk)))
      const exited = new Promise<number | null>((resolve) => child.on('close', resolve))
      const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`)
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'teste', version: '0.0.0' },
        },
      })
      send({ jsonrpc: '2.0', method: 'notifications/initialized' })
      send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
      const deadline = Date.now() + 30_000
      while (stdout.split('\n').filter(Boolean).length < 2 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      child.stdin.end()
      expect(await exited, stderr).toBe(0)

      const [initialize, list] = stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { result: Record<string, unknown> })
      expect(initialize?.result).toMatchObject({
        serverInfo: { name: 'prumo', version: workspaceManifest('mcp').version },
      })
      const tools = (list?.result.tools as Array<{ name: string }>).map((tool) => tool.name)
      expect(tools).toEqual([
        'check',
        'doctor',
        'make_component',
        'make_domain',
        'make_page',
        'move_component',
        'new',
      ])
    }, 60_000)

    it('tem o dist do rules e do cli onde o exports aponta', () => {
      expect(
        existsSync(path.join(product, 'node_modules/@matizze/prumo-rules/dist/check/index.js')),
      ).toBe(true)
    })
  })
})
