import path from 'node:path'
import { Node, SyntaxKind, type ExportDeclaration, type FunctionDeclaration, type ImportDeclaration } from 'ts-morph'
import { UsageError } from '../errors.ts'
import type { DomainNames } from '../lib/names.ts'
import type { ChangePlan } from '../lib/plan.ts'
import { applyEdits, indentOf, isTextLiteral, type TextEdit } from './edit.ts'
import { insertSorted, specifierOf, styleOf } from './register-repository.ts'

/** As fontes que o `make:repository --data-source` acrescenta ao mock. */
export type RepositorySource = 'http' | 'storage'

/** O que muda de uma fonte para a outra no código da fábrica e do teste de contrato. */
interface SourceShape {
  /** A classe: `HttpClientesRepository`. */
  className: (names: DomainNames) => string
  /** O módulo da classe, ao lado da fábrica: `./repository.http`. */
  module: string
  /** O que a fábrica passa ao construtor. */
  argument: (latencyMs: string) => string
  /** Os nomes que a fábrica precisa receber das opções. */
  options: readonly string[]
}

const SOURCES: Record<RepositorySource, SourceShape> = {
  http: {
    className: (names) => `Http${names.plural.pascal}Repository`,
    module: './repository.http',
    argument: () => 'api',
    options: ['dataSource'],
  },
  storage: {
    className: (names) => `Storage${names.plural.pascal}Repository`,
    module: './repository.storage',
    argument: (latencyMs) => latencyMs === 'latencyMs' ? '{ latencyMs }' : `{ latencyMs: ${latencyMs} }`,
    options: ['dataSource', 'latencyMs'],
  },
}

/**
 * Junta as inserções que caem na mesma posição numa só, na ordem em que vieram: o `applyEdits`
 * poria a segunda antes da primeira.
 */
function mergeInsertions(edits: TextEdit[]): TextEdit[] {
  const merged: TextEdit[] = []
  for (const edit of edits) {
    const same = edit.pos === edit.end ? merged.find((e) => e.pos === edit.pos && e.end === edit.pos) : undefined
    if (same) same.text += edit.text
    else merged.push({ ...edit })
  }
  return merged
}

/** O arquivo, relativo à raiz, para as mensagens. */
function display(plan: ChangePlan, file: string): string {
  return path.relative(plan.project.root, file).split(path.sep).join('/')
}

/**
 * Acrescenta `source` ao `DATA_SOURCES` de `src/repositories/options.ts`, se ainda não está lá. O
 * arquivo e o `export const DATA_SOURCES = [...] as const` precisam existir.
 */
export function addDataSource(plan: ChangePlan, source: RepositorySource): void {
  const file = path.join(plan.project.src, 'repositories', 'options.ts')
  const where = display(plan, file)
  if (!plan.hasFile(file)) throw new UsageError(`o projeto não tem ${where}.`)
  const options = plan.source(file)
  const initializer = options.getVariableDeclaration('DATA_SOURCES')?.getInitializer()
  const array = initializer && Node.isAsExpression(initializer) ? initializer.getExpression() : initializer
  if (!array || !Node.isArrayLiteralExpression(array)) {
    throw new UsageError(`${where} não tem o 'export const DATA_SOURCES = [...] as const'.`)
  }
  const elements = array.getElements()
  if (elements.some((element) => isTextLiteral(element) && element.getLiteralText() === source)) {
    return
  }
  const last = elements[elements.length - 1]
  const quote = elements.find(isTextLiteral)?.getText().charAt(0) ?? "'"
  const literal = `${quote}${source}${quote}`
  let edit: TextEdit
  if (!last) {
    edit = { pos: array.getStart() + 1, end: array.getStart() + 1, text: literal }
  } else if (last.getStartLineNumber() === array.getStartLineNumber()) {
    edit = { pos: last.getEnd(), end: last.getEnd(), text: `, ${literal}` }
  } else {
    // Uma entrada por linha: a nova entra na linha de baixo, com o mesmo recuo e a mesma vírgula
    const text = options.getFullText()
    const indent = indentOf(text, last.getStart())
    const after = /^\s*,/.exec(text.slice(last.getEnd()))
    const end = last.getEnd() + (after ? after[0].length : 0)
    edit = { pos: end, end, text: `${after ? '' : ','}\n${indent}${literal}${after ? ',' : ''}` }
  }
  applyEdits(options, [edit])
}

/**
 * O que a fábrica `create<Domínio>Repository` precisa para escolher a fonte: o nome por onde ela
 * lê o `dataSource` e o `latencyMs` (os que faltam entram na desestruturação do parâmetro) e onde
 * o parâmetro começa.
 */
function factoryParameter(
  fn: FunctionDeclaration,
  needed: readonly string[],
  where: string,
): { locals: Record<string, string>; edits: TextEdit[] } {
  const parameter = fn.getParameters()[0]
  if (!parameter) throw new UsageError(`a fábrica de ${where} não recebe as opções do repositório.`)
  const pattern = parameter.getNameNode()
  if (Node.isIdentifier(pattern)) {
    const name = pattern.getText()
    return { locals: Object.fromEntries(needed.map((n) => [n, `${name}.${n}`])), edits: [] }
  }
  if (!Node.isObjectBindingPattern(pattern)) {
    throw new UsageError(`não entendi o parâmetro da fábrica de ${where}.`)
  }
  const elements = pattern.getElements()
  const locals: Record<string, string> = {}
  for (const element of elements) {
    const property = element.getPropertyNameNode()?.getText() ?? element.getName()
    locals[property] = element.getName()
  }
  const missing = needed.filter((name) => !(name in locals))
  for (const name of missing) locals[name] = name
  const first = elements[0]
  const edits: TextEdit[] = []
  if (missing.length > 0) {
    edits.push(
      first
        ? { pos: first.getStart(), end: first.getStart(), text: `${missing.join(', ')}, ` }
        : { pos: pattern.getStart(), end: pattern.getEnd(), text: `{ ${missing.join(', ')} }` },
    )
  }
  return { locals, edits }
}

/**
 * Faz a fábrica do domínio (`src/repositories/<domínio>/index.ts`) escolher a fonte: o `import` da
 * classe (e, no http, do `api`), o `export` dela e a linha `if (dataSource === '<fonte>') return
 * new ...` logo antes do `return` final, que continua devolvendo o mock. Sem o `dataSource` nas
 * opções da fábrica, ele entra.
 */
export function registerFactorySource(
  plan: ChangePlan,
  names: DomainNames,
  source: RepositorySource,
): void {
  const file = path.join(plan.project.src, 'repositories', names.plural.kebab, 'index.ts')
  const where = display(plan, file)
  if (!plan.hasFile(file)) throw new UsageError(`falta ${where}, a fábrica do domínio.`)
  const index = plan.source(file)
  const factory = `create${names.plural.pascal}Repository`
  const fn = index.getFunction(factory)
  const body = fn?.getBody()
  if (!fn || !body || !Node.isBlock(body)) {
    throw new UsageError(`${where} não tem a função '${factory}'.`)
  }
  const returns = body.getStatements()
  const final = returns[returns.length - 1]
  if (!final || !Node.isReturnStatement(final)) {
    throw new UsageError(`a função '${factory}' de ${where} não termina com um return.`)
  }

  const shape = SOURCES[source]
  const className = shape.className(names)
  const imports = index.getImportDeclarations()
  if (imports.some((declaration) => specifierOf(declaration) === shape.module)) {
    throw new UsageError(`${where} já importa '${shape.module}'.`)
  }
  const relative = imports.filter((declaration) => specifierOf(declaration).startsWith('.'))
  const exports = index
    .getExportDeclarations()
    .filter((declaration) => declaration.hasModuleSpecifier() && specifierOf(declaration).startsWith('./'))
  const { quote, semicolon } = styleOf(relative[0] ?? imports[0])
  const lastImport = imports[imports.length - 1]
  const importLine = (name: string, from: string) =>
    `import { ${name} } from ${quote}${from}${quote}${semicolon}`

  const { locals, edits } = factoryParameter(fn, shape.options, where)
  const indent = indentOf(index.getFullText(), final.getStart())
  const ifLine = `if (${locals.dataSource} === ${quote}${source}${quote}) return new ${className}(${shape.argument(locals.latencyMs ?? 'latencyMs')})${semicolon}`

  const importEdits: TextEdit[] = []
  if (source === 'http') {
    importEdits.push(insertSorted<ImportDeclaration>(relative, '../api', importLine('api', '../api'), lastImport, where))
  }
  importEdits.push(
    insertSorted<ImportDeclaration>(relative, shape.module, importLine(className, shape.module), lastImport, where),
  )
  const exportLine = `export { ${className} } from ${quote}${shape.module}${quote}${semicolon}`
  const exportEdit = insertSorted<ExportDeclaration>(exports, shape.module, exportLine, lastImport, where)

  applyEdits(
    index,
    mergeInsertions([
      ...importEdits,
      exportEdit,
      ...edits,
      { pos: final.getStart(), end: final.getStart(), text: `${ifLine}\n${indent}` },
    ]),
  )
}

/**
 * Acrescenta ao `repository.contract.test.ts` a chamada do `runContractSuite` da fonte: o storage
 * limpa a chave do `localStorage` antes de cada repositório novo, e o http só roda com
 * `API_TEST_URL` (sem ela, o `describe` fica pulado, com o motivo no título). Devolve um aviso, em
 * vez de falhar, quando o arquivo falta ou foi mudado a ponto de o codemod não achar o contrato.
 */
export function registerContractSource(
  plan: ChangePlan,
  names: DomainNames,
  source: RepositorySource,
): string | undefined {
  const file = path.join(
    plan.project.src,
    'repositories',
    names.plural.kebab,
    'repository.contract.test.ts',
  )
  const where = display(plan, file)
  const skipped = `o teste de contrato da fonte ${source} não foi acrescentado`
  if (!plan.hasFile(file)) return `${skipped}: falta ${where}. Acrescente o runContractSuite à mão.`
  const test = plan.source(file)
  const contract = `${names.plural.camel}Contract`
  if (!test.getVariableDeclaration(contract)) {
    return `${skipped}: ${where} não tem o '${contract}'. Acrescente o runContractSuite à mão.`
  }
  const statements = test.getStatements()
  const last = statements[statements.length - 1]
  const imports = test.getImportDeclarations()
  if (!last || imports.length === 0) {
    return `${skipped}: não entendi o arquivo ${where}. Acrescente o runContractSuite à mão.`
  }

  const className = SOURCES[source].className(names)
  const { quote, semicolon } = styleOf(imports.find((i) => specifierOf(i).startsWith('.')) ?? imports[0])
  const relative = imports.filter((declaration) => specifierOf(declaration).startsWith('.'))
  const lastImport = imports[imports.length - 1]
  const importLine = (name: string, from: string) =>
    `import { ${name} } from ${quote}${from}${quote}${semicolon}`
  const edits: TextEdit[] = []
  let block: string
  if (source === 'http') {
    edits.push(insertSorted<ImportDeclaration>(relative, '../http', importLine('createHttp', '../http'), lastImport, where))
    edits.push(insertSorted<ImportDeclaration>(relative, SOURCES.http.module, importLine(className, SOURCES.http.module), lastImport, where))
    const vitest = imports.find((declaration) => specifierOf(declaration) === 'vitest')
    const named = vitest?.getNamedImports() ?? []
    if (vitest && !named.some((item) => item.getName() === 'describe')) {
      const first = named[0]
      edits.push(
        first
          ? { pos: first.getStart(), end: first.getStart(), text: 'describe, ' }
          : { pos: vitest.getStart(), end: vitest.getEnd(), text: importLine('describe', 'vitest') },
      )
    } else if (!vitest) {
      edits.push({ pos: lastImport!.getEnd(), end: lastImport!.getEnd(), text: `\n${importLine('describe', 'vitest')}` })
    }
    block = `// Contra uma API de teste de verdade: aponte API_TEST_URL para ela (por exemplo, http://localhost:3000).
// Parte dos casos depende das fixtures e escreve na API, então ela precisa partir dos mesmos dados a
// cada teste: volte-a ao estado inicial no dispose. Sem API_TEST_URL, estes casos ficam pulados.
const apiTestUrl = process.env.API_TEST_URL

describe.skipIf(!apiTestUrl)('${className} contra a API de teste (pulado: defina API_TEST_URL)', () => {
  runContractSuite(${contract}, {
    name: '${className}',
    create: () => new ${className}(createHttp({ baseUrl: apiTestUrl ?? '' })),
    // dispose: () => resetApiDeTeste(), // volta a API às fixtures depois de cada teste
  })
})`
  } else {
    edits.push(
      insertSorted<ImportDeclaration>(
        relative,
        SOURCES.storage.module,
        importLine(`STORAGE_KEY, ${className}`, SOURCES.storage.module),
        lastImport,
        where,
      ),
    )
    block = `// O storage grava no localStorage (o jsdom do app tem um): a chave é limpa antes de cada repositório novo.
runContractSuite(${contract}, {
  name: '${className}',
  create: () => {
    localStorage.removeItem(STORAGE_KEY)
    return new ${className}({ latencyMs: 0 })
  },
})`
  }
  edits.push({ pos: last.getEnd(), end: last.getEnd(), text: `\n\n${block}` })
  applyEdits(test, mergeInsertions(edits))
  return undefined
}

/** A chamada em uma linha, sem a vírgula do fim: a que o modelo escreve, mesmo quebrada em linhas. */
const normalized = (text: string) =>
  text.replace(/\s+/g, ' ').replace('( ', '(').replace(/,? \)$/, ')')

const OLD_RESOLVE = "resolveDataSource(undefined, DATA_SOURCES, 'mock')"
const NEW_RESOLVE =
  "resolveDataSource(import.meta.env.VITE_DATA_SOURCE, DATA_SOURCES, 'mock', 'VITE_DATA_SOURCE')"

/**
 * Faz o container `src/repositories/index.ts` ler a fonte da `VITE_DATA_SOURCE`. Um app criado antes
 * disso tem `resolveDataSource(undefined, DATA_SOURCES, 'mock')`, que é trocado pela versão do
 * ambiente. Container que já lê a variável fica como está; qualquer outra forma não é tocada, e o
 * retorno é um aviso de como ligar à mão.
 */
export function readDataSourceFromEnv(plan: ChangePlan): string | undefined {
  const file = path.join(plan.project.src, 'repositories', 'index.ts')
  const where = display(plan, file)
  const how = `Troque a chamada do resolveDataSource por ${NEW_RESOLVE}.`
  if (!plan.hasFile(file)) {
    return `não achei ${where}, então não sei se o container lê a VITE_DATA_SOURCE. ${how}`
  }
  const index = plan.source(file)
  if (index.getFullText().includes('import.meta.env.VITE_DATA_SOURCE')) return undefined
  const call = index
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((candidate) => normalized(candidate.getText()) === OLD_RESOLVE)
  if (!call) {
    return `o container ${where} não lê a VITE_DATA_SOURCE: a fonte escolhida no .env não vale. ${how}`
  }
  applyEdits(index, [{ pos: call.getStart(), end: call.getEnd(), text: NEW_RESOLVE }])
  return undefined
}
