import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { IndentationText, Project as MorphProject, QuoteKind, ts, type SourceFile } from 'ts-morph'
import { UsageError } from '../errors.ts'
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
   * Grava o plano no disco. Antes de escrever, confere de novo que nenhum arquivo novo apareceu
   * no caminho de um que o plano ia criar. Os arquivos novos saem primeiro e os alterados depois.
   */
  commit(): PlanSummary {
    const summary = this.summary()
    for (const file of [...this.#createdSources.keys(), ...this.#createdFiles.keys()]) {
      if (existsSync(file))
        throw new UsageError(`'${this.#display(file)}' já existe: nada foi escrito.`)
    }
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

function write(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}
