import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { IndentationText, Project as MorphProject, QuoteKind, ts, type SourceFile } from 'ts-morph'
import { ExitError, UsageError } from '../errors.ts'
import type { Project } from './project.ts'

/** O que o plano criaria e alteraria, com caminhos relativos à raiz do projeto, em ordem. */
export interface PlanSummary {
  created: string[]
  modified: string[]
}

/**
 * O plano de mudanças de um comando, todo em memória. Os arquivos de código entram num `Project`
 * do ts-morph sem tsconfig e sem sistema de arquivos: ele só enxerga o que o plano carregou
 * (os arquivos novos e os de costura), nada é lido nem escrito por ele, e a checagem de tipos
 * nunca roda. Os arquivos que não são código (JSON de mensagens) ficam numa lista à parte. Nada
 * vai para o disco até `commit()`, então um erro no meio do caminho não deixa o projeto pela
 * metade, e `summary()` mostra o que seria feito (o `--dry-run`).
 */
export class ChangePlan {
  readonly project: Project
  /** O ts-morph do plano. Só os arquivos tocados entram nele. */
  readonly morph: MorphProject

  readonly #createdSources = new Map<string, SourceFile>()
  readonly #loadedSources = new Map<string, { file: SourceFile; original: string }>()
  readonly #createdFiles = new Map<string, string>()
  readonly #editedTexts = new Map<string, { original: string; content: string }>()

  constructor(project: Project) {
    this.project = project
    this.morph = new MorphProject({
      useInMemoryFileSystem: true,
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: true,
      compilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ES2023,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        noEmit: true,
      },
      manipulationSettings: {
        indentationText: IndentationText.TwoSpaces,
        quoteKind: QuoteKind.Single,
        useTrailingCommas: true,
      },
    })
  }

  /** O arquivo existe no disco ou o plano já vai criá-lo. */
  has(file: string): boolean {
    return this.#createdSources.has(file) || this.#createdFiles.has(file) || existsSync(file)
  }

  /** O plano vai criar o arquivo, ou ele já existe no disco como arquivo (pasta não conta). */
  hasFile(file: string): boolean {
    if (this.#createdSources.has(file) || this.#createdFiles.has(file)) return true
    return existsSync(file) && statSync(file).isFile()
  }

  /** Um arquivo de código novo, com o conteúdo dado. */
  createSource(file: string, text: string): SourceFile {
    this.#assertNew(file)
    const source = this.morph.createSourceFile(file, text)
    this.#createdSources.set(file, source)
    return source
  }

  /** Um arquivo novo que não é código, com o conteúdo dado. */
  createText(file: string, content: string): void {
    this.#assertNew(file)
    this.#createdFiles.set(file, content)
  }

  /** Os arquivos de código criados pelo plano, em ordem de caminho. */
  createdSources(): SourceFile[] {
    return [...this.#createdSources.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, source]) => source)
  }

  /** Um arquivo de código que já existe no projeto, aberto no plano (uma costura). */
  source(file: string): SourceFile {
    const created = this.#createdSources.get(file)
    if (created) return created
    const loaded = this.#loadedSources.get(file)
    if (loaded) return loaded.file
    const original = this.#readExisting(file)
    const sourceFile = this.morph.createSourceFile(file, original)
    this.#loadedSources.set(file, { file: sourceFile, original })
    return sourceFile
  }

  /** O texto atual de um arquivo existente, com as edições do plano. */
  readText(file: string): string {
    return this.#editedTexts.get(file)?.content ?? this.#readExisting(file)
  }

  /** Troca o conteúdo de um arquivo existente que não é código. */
  editText(file: string, content: string): void {
    const original = this.#editedTexts.get(file)?.original ?? this.#readExisting(file)
    this.#editedTexts.set(file, { original, content })
  }

  /** O que o plano criaria e alteraria. Arquivos editados que ficaram iguais não contam. */
  summary(): PlanSummary {
    const relative = (file: string) =>
      path.relative(this.project.root, file).split(path.sep).join('/')
    const created = [...this.#createdSources.keys(), ...this.#createdFiles.keys()].map(relative)
    const modified = [
      ...[...this.#loadedSources]
        .filter(([, s]) => s.file.getFullText() !== s.original)
        .map(([f]) => f),
      ...[...this.#editedTexts].filter(([, t]) => t.content !== t.original).map(([f]) => f),
    ].map(relative)
    return { created: created.sort(), modified: modified.sort() }
  }

  /**
   * Confere o plano sem escrever nada, com as mesmas regras do `commit()`: nenhum arquivo novo
   * apareceu no caminho de um que o plano ia criar, e nenhum arquivo leva a escrita para fora do
   * projeto. O `--dry-run` usa este método, para a simulação falhar onde a execução falharia.
   */
  verify(): PlanSummary {
    const created = [...this.#createdSources.keys(), ...this.#createdFiles.keys()]
    for (const file of created) {
      if (existsSync(file))
        throw new UsageError(`'${this.#display(file)}' já existe: nada foi escrito.`)
    }
    const modified = [
      ...[...this.#loadedSources]
        .filter(([, s]) => s.file.getFullText() !== s.original)
        .map(([f]) => f),
      ...[...this.#editedTexts].filter(([, t]) => t.content !== t.original).map(([f]) => f),
    ]
    this.#assertInside([...created, ...modified])
    return this.summary()
  }

  /**
   * Grava o plano no disco, depois de `verify()`. Os arquivos novos saem primeiro e os alterados
   * depois.
   */
  commit(): PlanSummary {
    const summary = this.verify()
    for (const [file, source] of this.#createdSources) write(file, source.getFullText())
    for (const [file, content] of this.#createdFiles) write(file, content)
    for (const [file, { file: source, original }] of this.#loadedSources) {
      if (source.getFullText() !== original) write(file, source.getFullText())
    }
    for (const [file, { original, content }] of this.#editedTexts) {
      if (content !== original) write(file, content)
    }
    return summary
  }

  /**
   * Cada arquivo que o plano vai escrever fica dentro do projeto também no disco: o caminho real,
   * resolvido pelo sistema (`realpathSync.native`, que segue cada link antes de um `..` e devolve
   * as maiúsculas do disco), não sai da raiz real do projeto. Os nomes já são validados antes, mas
   * um link que já existe no projeto (o próprio `src`, uma pasta dentro dele, o `App.tsx`) levaria
   * a escrita para fora; com o `prumo mcp`, quem escolhe os nomes é um agente. Link dentro do
   * projeto que aponta para dentro dele continua valendo. Link físico (hard link) não é detectado.
   */
  #assertInside(files: string[]): void {
    let root: string
    try {
      root = realPathOf(this.project.root)
    } catch {
      throw new ExitError(
        2,
        `prumo: a pasta do projeto (${this.project.root}) passa por um link simbólico quebrado: nada foi escrito.`,
      )
    }
    for (const file of files) {
      let real: string | undefined
      try {
        real = realPathOf(file)
      } catch {
        real = undefined
      }
      if (real !== undefined && isInside(root, real)) continue
      const link = culpritLink(this.project.root, root, file)
      const reason =
        real === undefined ? 'passa por um link simbólico quebrado' : 'levaria a escrita para fora do projeto'
      const where = link
        ? `'${this.#display(link.path)}' é um link simbólico para '${link.target}'`
        : `o caminho real é ${real ?? 'desconhecido'}`
      throw new ExitError(
        2,
        `prumo: '${this.#display(file)}' ${reason}: ${where}. Troque o link por uma pasta (ou um arquivo) de verdade dentro do projeto, ou abra o projeto na pasta real. Nada foi escrito.`,
      )
    }
  }

  #assertNew(file: string): void {
    if (this.has(file)) throw new UsageError(`'${this.#display(file)}' já existe.`)
  }

  #readExisting(file: string): string {
    if (!existsSync(file) || !statSync(file).isFile()) {
      throw new UsageError(`'${this.#display(file)}' não existe.`)
    }
    return readFileSync(file, 'utf8')
  }

  #display(file: string): string {
    return path.relative(this.project.root, file).split(path.sep).join('/')
  }
}

/** Se o caminho existe no disco, mesmo como link simbólico quebrado (o `existsSync` segue o link). */
function exists(file: string): boolean {
  try {
    lstatSync(file)
    return true
  } catch {
    return false
  }
}

/**
 * O caminho real de `file`, como o sistema o resolve: segue os links simbólicos do trecho que já
 * existe no disco (`realpathSync.native`) e acrescenta o resto, que ainda vai ser criado. Lança se
 * o trecho que existe passa por um link quebrado.
 */
function realPathOf(file: string): string {
  const rest: string[] = []
  let current = path.resolve(file)
  for (;;) {
    if (exists(current)) return path.join(realpathSync.native(current), ...rest.reverse())
    const parent = path.dirname(current)
    if (parent === current) return path.join(current, ...rest.reverse())
    rest.push(path.basename(current))
    current = parent
  }
}

/** Se `real` fica dentro de `root` (os dois já resolvidos), sem ser a própria raiz. */
function isInside(root: string, real: string): boolean {
  const relative = path.relative(root, real)
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

/**
 * O link simbólico que causa o problema no caminho de `file`, a partir da raiz do projeto: o
 * primeiro que está quebrado ou cujo destino sai da raiz real (`root`). Um link legítimo para
 * dentro do projeto, antes dele no caminho, não é o culpado e é pulado.
 */
function culpritLink(
  projectRoot: string,
  root: string,
  file: string,
): { path: string; target: string } | undefined {
  const parts = path.relative(path.resolve(projectRoot), path.resolve(file)).split(path.sep)
  let current = path.resolve(projectRoot)
  for (const part of parts) {
    current = path.join(current, part)
    if (!exists(current)) return undefined
    if (!lstatSync(current).isSymbolicLink()) continue
    const target = readlinkSync(current)
    let real: string
    try {
      real = realpathSync.native(current)
    } catch {
      return { path: current, target }
    }
    if (!isInside(root, real)) return { path: current, target }
  }
  return undefined
}

function write(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}
