import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { domainIdSample, domainShapeOf, type DomainShape } from './fields/index.ts'
import type { Project } from './project.ts'

/** Lê o arquivo, ou `undefined` se não existe. */
export function readIfExists(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

/** `Livro` vira `livro`: o nome do schema, que é um identificador (o kebab da entidade não se refaz dele). */
export function camelOf(pascal: string): string {
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/**
 * O arquivo do schema da entidade, relativo à raiz: o de `src/schemas/entities/` que exporta o
 * `<camel>Schema`. Não refaz o nome do arquivo a partir do PascalCase (`Fase2` pode ser `fase-2`).
 */
export function schemaFileOf(project: Project, entity: string): string | undefined {
  const dir = path.join(project.src, 'schemas', 'entities')
  if (!existsSync(dir)) return undefined
  const declaration = new RegExp(`\\bexport\\s+const\\s+${camelOf(entity)}Schema\\b`)
  const found = readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .find((file) => declaration.test(readFileSync(path.join(dir, file), 'utf8')))
  return found ? `src/schemas/entities/${found}` : undefined
}

/** Onde estão os dados de exemplo da tela: o arquivo (para as mensagens) e o texto dele, se existe. */
export interface Fixtures {
  file: string
  text: string | undefined
}

/**
 * O que a tela mostra do registro: o primeiro campo de texto do schema que o projeto tem hoje
 * (lido de um jeito tolerante, veja `domainShapeOf`), ou o `id`, com um aviso. Com `needSample` (a
 * tela de detalhe, cujo teste confere o texto), um campo sem valor nas fixtures também cai no `id`.
 */
export function shapeOf(
  project: Project,
  entity: string | undefined,
  fixtures: Fixtures,
  needSample: boolean,
): DomainShape {
  const found = entity ? schemaFileOf(project, entity) : undefined
  const shape = domainShapeOf(
    {
      file: found ?? 'src/schemas/entities/<entidade>.ts',
      source: found ? readIfExists(path.join(project.root, found)) : undefined,
      camel: entity ? camelOf(entity) : undefined,
    },
    fixtures.text,
  )
  if (!needSample || shape.field === 'id' || shape.sample !== undefined) return shape
  return {
    field: 'id',
    ...domainIdSample(fixtures.text),
    warning: `não achei o valor de '${shape.field}' no primeiro registro de ${fixtures.file}: a tela mostra o id do registro. Troque pelo campo certo na view (e no teste).`,
  }
}
