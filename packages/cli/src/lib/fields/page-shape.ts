import { Node, Project as MorphProject } from 'ts-morph'

/** O que uma tela de use case mostra do registro, lido do que o projeto tem. */
export interface DomainShape {
  /** O campo que a tela mostra: o primeiro de texto, ou `id`. */
  field: string
  /** O texto desse campo no primeiro registro das fixtures, se deu para ler. */
  sample?: string
  /** Por que a tela usa o `id`, quando o campo de texto não foi descoberto. */
  warning?: string
}

/**
 * Os campos de texto do `z.object({ ... })` do `<camel>Schema`, só os do nível de cima (um objeto
 * aninhado não conta), lidos da árvore do ts-morph. `undefined` se não acha o schema ou se o objeto
 * tem algo que não dá para ler (propriedade espalhada, nome calculado).
 */
function textFields(source: string, camel: string): { name: string; optional: boolean }[] | undefined {
  const morph = new MorphProject({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  })
  const file = morph.createSourceFile('schema.ts', source)
  const initializer = file.getVariableDeclaration(`${camel}Schema`)?.getInitializer()
  if (!initializer || !Node.isCallExpression(initializer)) return undefined
  if (initializer.getExpression().getText().replace(/\s+/g, '') !== 'z.object') return undefined
  const [argument] = initializer.getArguments()
  if (!argument || !Node.isObjectLiteralExpression(argument)) return undefined
  const fields: { name: string; optional: boolean }[] = []
  for (const property of argument.getProperties()) {
    if (!Node.isPropertyAssignment(property)) return undefined
    const nameNode = property.getNameNode()
    if (Node.isComputedPropertyName(nameNode)) return undefined
    // Só identificador simples serve de `i.<campo>` na view: chave entre aspas ou numérica fica de fora
    if (!Node.isIdentifier(nameNode)) continue
    const value = property.getInitializer()?.getText().replace(/\s+/g, '') ?? ''
    const match = /^z\.string\(\)(.*)$/s.exec(value)
    if (!match) continue
    fields.push({ name: property.getName(), optional: /\.optional\(\)|\.nullish\(\)/.test(match[1] ?? '') })
  }
  return fields
}

/** O primeiro valor entre aspas de `campo:` no texto das fixtures (`id: 'a-1'`). */
function firstValue(fixtures: string | undefined, field: string): string | undefined {
  if (fixtures === undefined) return undefined
  const match = new RegExp(`\\b${field}\\s*:\\s*(?:'((?:[^'\\\\\\n])*)'|"((?:[^"'\\\\\\n])*)")`).exec(
    fixtures,
  )
  return match ? (match[1] ?? match[2]) : undefined
}

/** O `id` do primeiro registro das fixtures, se deu para ler. */
export function domainIdSample(fixtures: string | undefined): { sample?: string } {
  const sample = firstValue(fixtures, 'id')
  return sample === undefined ? {} : { sample }
}

/**
 * Descobre o que mostrar de um registro do domínio, do schema e das fixtures que existem hoje (o app
 * pode ter editado os dois depois de gerados). O campo é o primeiro de texto obrigatório
 * (`z.string()`, fora `id` e `createdAt`), ou o primeiro de texto opcional; sem nenhum, ou sem achar o
 * schema, é o `id`, com um aviso.
 */
export function domainShapeOf(
  schema: { file: string; source: string | undefined; camel: string | undefined },
  fixtures: string | undefined,
): DomainShape {
  const found = schema.source && schema.camel ? textFields(schema.source, schema.camel) : undefined
  const idSample = firstValue(fixtures, 'id')
  const withId = (reason: string): DomainShape => ({
    field: 'id',
    ...(idSample === undefined ? {} : { sample: idSample }),
    warning: `${reason}: a tela mostra o id do registro. Troque pelo campo certo na view (e no teste).`,
  })
  if (found === undefined) return withId(`não consegui ler o schema do domínio (${schema.file})`)

  const texts = found.filter((text) => text.name !== 'id' && text.name !== 'createdAt')
  const chosen = texts.find((text) => !text.optional) ?? texts[0]
  if (!chosen) return withId(`o schema do domínio (${schema.file}) não tem campo de texto`)
  const sample = firstValue(fixtures, chosen.name)
  return { field: chosen.name, ...(sample === undefined ? {} : { sample }) }
}
