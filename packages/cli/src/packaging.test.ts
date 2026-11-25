import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { makeDir } from './test/fs.ts'

/** A raiz do monorepo: o empacotamento é um script da raiz, e o teste o roda e confere os tarballs. */
const REPO = path.resolve(import.meta.dirname, '../../..')
const SCRIPT = path.join(REPO, 'scripts', 'pack-packages.sh')

const PACKAGES = ['core', 'rules', 'testing', 'cli'] as const
type PackageName = (typeof PACKAGES)[number]

type Manifest = {
  name: string
  version: string
  private?: boolean
  keywords?: string[]
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
  work = makeDir('prumo-packaging-')
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
    expect(files).toContain('LICENSE')
  })

  it('só leva o dist, o package.json, o README e a licença (e os modelos, no cli): sem código-fonte, teste, fixture nem tsconfig', () => {
    const files = entries(name)
    const outside = files.filter(
      (file) =>
        !(
          file === 'package.json' ||
          file === 'README.md' ||
          file === 'LICENSE' ||
          file.startsWith('dist/') ||
          (name === 'cli' && file.startsWith('templates/'))
        ),
    )
    expect(outside).toEqual([])
    const unwanted = files.filter((file) =>
      /(\.test\.|dist\/test\/|rule-tester|__fixtures__|tsconfig|\.tsbuildinfo)/.test(file),
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
      expect(manifest).toMatchObject({
        license: 'MIT',
        homepage: 'https://docs.prumo.matizze.com.br',
        bugs: { url: 'https://github.com/matizze/prumo/issues' },
        engines: { node: '>=24' },
      })
      expect(manifest.keywords?.length, 'faltam palavras-chave').toBeGreaterThan(0)
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

  it('leva o dist/bin.js e os templates/', () => {
    const files = entries('cli')
    expect(files).toContain('dist/bin.js')
    expect(files.some((file) => file.startsWith('templates/'))).toBe(true)
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

    beforeAll(() => {
      // Um produto vazio, fora do monorepo: o cli e o rules vêm dos tarballs, e as dependências de
      // terceiros, do node_modules do cli (um atalho para a mesma pasta, que o Node resolve pelo caminho real)
      product = path.join(work, 'product')
      const modules = path.join(product, 'node_modules')
      mkdirSync(path.join(modules, '@matizze'), { recursive: true })
      writeFileSync(path.join(product, 'package.json'), '{ "name": "produto", "type": "module" }\n')
      cpSync(extracted('cli'), path.join(modules, '@matizze', 'prumo-cli'), { recursive: true })
      cpSync(extracted('rules'), path.join(modules, '@matizze', 'prumo-rules'), { recursive: true })
      const dependencies = Object.keys(packedManifest('cli').dependencies ?? {})
      for (const dependency of dependencies.filter((entry) => !entry.startsWith('@matizze/'))) {
        const link = path.join(modules, dependency)
        if (existsSync(link)) continue
        mkdirSync(path.dirname(link), { recursive: true })
        symlinkSync(realpathSync(path.join(REPO, 'packages', 'cli', 'node_modules', dependency)), link)
      }
      bin = path.join(modules, '@matizze', 'prumo-cli', 'dist', 'bin.js')
    })

    it('roda o --help com o node, a partir de uma pasta fora do monorepo', () => {
      const result = spawnSync(process.execPath, [bin, '--help'], {
        cwd: product,
        encoding: 'utf8',
      })
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Uso: prumo')
      expect(result.stdout).toContain('Mostra esta ajuda.')
    })

    it('imprime a versão do package.json que fica acima do dist/', () => {
      const result = spawnSync(process.execPath, [bin, '--version'], {
        cwd: product,
        encoding: 'utf8',
      })
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(result.stdout).toBe(`${workspaceManifest('cli').version}\n`)
    })

    it('sai com 2 e a mensagem em português para um comando desconhecido', () => {
      const result = spawnSync(process.execPath, [bin, 'foo'], { cwd: product, encoding: 'utf8' })
      expect(result.status).toBe(2)
      expect(result.stderr).toContain("prumo: comando desconhecido: 'foo'.")
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
      expect(result.stdout.trim()).toBe('@matizze/prumo-rules 4')
    })

    it('tem o dist do rules e do cli onde o exports aponta', () => {
      expect(
        existsSync(path.join(product, 'node_modules/@matizze/prumo-rules/dist/check/index.js')),
      ).toBe(true)
    })
  })
})
