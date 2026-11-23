import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { Node, type SourceFile } from 'ts-morph'
import { assertValidName, ChangePlan, usableNames, type Names } from '../codemod/index.ts'
import { applyEdits, replaceInner, type TextEdit, type TextLiteral } from '../codemod/edit.ts'
import { UsageError } from '../errors.ts'
import type { Project } from '../project.ts'

export interface MoveComponentRequest {
  /** O nome do componente, em kebab-case. */
  name: string
  /** A tela de onde ele sai (`src/pages/<tela>/components/`). */
  from: string
  /** O destino é `src/components/shared/`. Por ora é o único destino. */
  shared?: boolean | undefined
}

export interface MoveComponentResult {
  plan: ChangePlan
  names: Names
  page: Names
  /** O componente na tela, relativo à raiz do projeto, em posix. */
  from: string
  /** O componente em `shared`, relativo à raiz do projeto, em posix. */
  file: string
}

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']

/** As chamadas cujo primeiro argumento é um módulo (`vi.mock('./x')` e parentes). */
const MODULE_CALLS = new Set([
  'require',
  'vi.mock',
  'vi.doMock',
  'vi.unmock',
  'vi.importActual',
  'vi.importMock',
  'jest.mock',
])

/** Os arquivos de código de uma pasta, sem entrar em `node_modules`. */
function codeFiles(folder: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') found.push(...codeFiles(full))
    } else if (CODE_EXTENSIONS.includes(path.extname(entry.name))) found.push(full)
  }
  return found
}

/** Os literais que nomeiam um módulo no arquivo: import, export, `import()` e `vi.mock`. */
function moduleLiterals(file: SourceFile): TextLiteral[] {
  const literals: TextLiteral[] = []
  for (const node of file.getDescendants()) {
    if (!Node.isStringLiteral(node) && !Node.isNoSubstitutionTemplateLiteral(node)) continue
    const parent = node.getParent()
    if (Node.isImportDeclaration(parent) || Node.isExportDeclaration(parent)) {
      if (parent.getModuleSpecifier() === node) literals.push(node)
    } else if (Node.isCallExpression(parent) && parent.getArguments()[0] === node) {
      const callee = parent.getExpression()
      if (callee.getText() === 'import' || MODULE_CALLS.has(callee.getText())) literals.push(node)
    }
  }
  return literals
}

/** O caminho absoluto, sem a extensão de código, que o módulo nomeia (só `./`, `../` e `@/`). */
function resolveModule(project: Project, from: string, specifier: string): string | undefined {
  let resolved: string
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    resolved = path.resolve(path.dirname(from), specifier)
  } else if (specifier.startsWith('@/')) {
    resolved = path.join(project.src, specifier.slice(2))
  } else return undefined
  const extension = path.extname(resolved)
  return CODE_EXTENSIONS.includes(extension) ? resolved.slice(0, -extension.length) : resolved
}

/** O texto do módulo no alias `@/`, mantendo a extensão que o specifier de origem tinha. */
function aliasOf(project: Project, target: string, original: string): string {
  const extension = path.extname(original)
  const suffix = CODE_EXTENSIONS.includes(extension) ? extension : ''
  const relative = path.relative(project.src, target).split(path.sep).join('/')
  return `@/${relative}${suffix}`
}

/**
 * Monta o plano que promove um componente de tela a compartilhado: move `<nome>.tsx` e o teste
 * dele (se houver) de `src/pages/<tela>/components/` para `src/components/shared/` e reescreve
 * todo import do componente, em qualquer arquivo de `src`, para `@/components/shared/<nome>`.
 * Nada vai para o disco. O texto do componente e do teste não muda, a não ser nos imports
 * relativos que saíam da pasta (viram `@/...`); se o componente depende de algo da tela, recusa,
 * porque o que está em `shared` não pode importar de uma tela. Erro de uso é `UsageError`.
 */
export function moveComponent(
  project: Project,
  { name, from, shared = false }: MoveComponentRequest,
): MoveComponentResult {
  const names = usableNames(name, 'o nome do componente', { globals: true })
  assertValidName(from, 'o nome da tela')
  const page = usableNames(from, 'o nome da tela')
  if (!shared) {
    throw new UsageError(
      'diga para onde mover o componente: --shared (o destino é src/components/shared/).',
    )
  }

  const pageFolder = path.join(project.pages, page.kebab)
  if (!existsSync(pageFolder)) {
    throw new UsageError(
      `a tela '${page.kebab}' não existe: não há a pasta src/pages/${page.kebab}.`,
    )
  }
  const componentsFolder = path.join(pageFolder, 'components')
  const oldBase = path.join(componentsFolder, names.kebab)
  const oldFile = `${oldBase}.tsx`
  if (!existsSync(oldFile) || !statSync(oldFile).isFile()) {
    const available = existsSync(componentsFolder)
      ? readdirSync(componentsFolder)
          .filter((entry) => entry.endsWith('.tsx') && !entry.endsWith('.test.tsx'))
          .map((entry) => entry.slice(0, -'.tsx'.length))
      : []
    throw new UsageError(
      `o componente '${names.kebab}' não existe na tela '${page.kebab}' (src/pages/${page.kebab}/components/${names.kebab}.tsx). ${available.length > 0 ? `Componentes da tela: ${available.join(', ')}.` : 'A tela não tem componentes.'}`,
    )
  }

  const sharedFolder = path.join(project.src, 'components', 'shared')
  const newBase = path.join(sharedFolder, names.kebab)
  const pairs = [
    { from: `${oldBase}.tsx`, to: `${newBase}.tsx` },
    { from: `${oldBase}.test.tsx`, to: `${newBase}.test.tsx` },
  ].filter(({ from: file }) => existsSync(file))
  for (const { to } of pairs) {
    if (existsSync(to)) {
      throw new UsageError(
        `já existe '${path.relative(project.root, to).split(path.sep).join('/')}' em shared: nada foi movido (escolha outro nome ou junte os dois à mão).`,
      )
    }
  }

  const plan = new ChangePlan(project)
  const moved = new Set(pairs.map(({ from: file }) => file))

  // Os arquivos que se movem: os imports relativos que saíam do par continuam apontando para o
  // mesmo lugar, agora pelo alias; o que é da tela não pode ir para shared
  for (const pair of pairs) {
    const source = plan.moveSource(pair.from, pair.to)
    const edits: TextEdit[] = []
    for (const literal of moduleLiterals(source)) {
      const specifier = literal.getLiteralText()
      if (!specifier.startsWith('.')) continue
      const target = resolveModule(project, pair.from, specifier)
      if (target === undefined || target === oldBase || target === `${oldBase}.test`) continue
      if (target.startsWith(project.pages + path.sep)) {
        throw new UsageError(
          `o componente '${names.kebab}' importa '${specifier}', que é de uma tela: o que está em shared não pode depender de tela. Mova essa parte junto, ou desfaça a dependência, e tente de novo.`,
        )
      }
      edits.push(replaceInner(literal, aliasOf(project, target, specifier)))
    }
    applyEdits(source, edits)
  }

  // Os outros arquivos do projeto que importam o componente
  const sharedSpecifier = `@/components/shared/${names.kebab}`
  for (const file of codeFiles(project.src)) {
    if (moved.has(file)) continue
    if (!readFileSync(file, 'utf8').includes(names.kebab)) continue
    const source = plan.source(file)
    const edits: TextEdit[] = []
    for (const literal of moduleLiterals(source)) {
      const specifier = literal.getLiteralText()
      if (resolveModule(project, file, specifier) !== oldBase) continue
      const extension = path.extname(specifier)
      edits.push(
        replaceInner(
          literal,
          `${sharedSpecifier}${CODE_EXTENSIONS.includes(extension) ? extension : ''}`,
        ),
      )
    }
    applyEdits(source, edits)
  }

  const relative = (file: string) => path.relative(project.root, file).split(path.sep).join('/')
  return {
    plan,
    names,
    page,
    from: relative(oldFile),
    file: relative(`${newBase}.tsx`),
  }
}
